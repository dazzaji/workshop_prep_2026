import { randomUUID } from "node:crypto";
import { hashSecret, randomToken } from "./crypto.js";
import { jsonError } from "./errors.js";
import { audit, getSetting, type Db } from "./db.js";
import type { AppConfig, CredentialRecord, Runtime, SetupCodeRecord, TeamKey } from "./types.js";

export function issueSetupCode(
  db: Db,
  config: AppConfig,
  record: Omit<SetupCodeRecord, "expiresAt">,
  now = Date.now(),
): string {
  const code = randomToken(16);
  db.prepare(
    `INSERT INTO setup_codes(code_hash, discord_user_id, guild_id, agent_label, runtime, pinned_team, expires_at)
     VALUES(?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    hashSecret(config.pepper, code),
    record.discordUserId,
    record.guildId,
    record.agentLabel,
    record.runtime,
    record.pinnedTeam,
    now + config.setupCodeTtlMs,
  );
  audit(db, record.discordUserId, "setup_code_issued");
  return code;
}

export function exchangeCode(
  db: Db,
  config: AppConfig,
  code: string,
  now = Date.now(),
): { token: string; credential: CredentialRecord } {
  const hash = hashSecret(config.pepper, code);
  const row = db
    .prepare(
      `SELECT discord_user_id, guild_id, agent_label, runtime, pinned_team, expires_at, used_at
       FROM setup_codes WHERE code_hash = ?`,
    )
    .get(hash) as
    | {
        discord_user_id: string;
        guild_id: string;
        agent_label: string;
        runtime: Runtime;
        pinned_team: TeamKey | null;
        expires_at: number;
        used_at: number | null;
      }
    | undefined;
  if (!row) throw jsonError("invalid_code", 400);
  if (row.used_at) throw jsonError("code_used", 400);
  if (row.expires_at <= now) throw jsonError("code_expired", 400);

  const used = db.prepare("UPDATE setup_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL").run(now, hash);
  if (used.changes !== 1) throw jsonError("code_used", 400);

  const token = randomToken(32);
  const id = randomUUID();
  db.prepare(
    `INSERT INTO credentials(id, lookup_hash, discord_user_id, guild_id, agent_label, runtime, pinned_team, expires_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    hashSecret(config.pepper, token),
    row.discord_user_id,
    row.guild_id,
    row.agent_label,
    row.runtime,
    row.pinned_team,
    now + config.credentialTtlMs,
  );
  audit(db, row.discord_user_id, "credential_issued", id);
  return {
    token,
    credential: {
      id,
      discordUserId: row.discord_user_id,
      guildId: row.guild_id,
      agentLabel: row.agent_label,
      runtime: row.runtime,
      pinnedTeam: row.pinned_team,
      expiresAt: now + config.credentialTtlMs,
      revokedAt: null,
    },
  };
}

export function loadCredential(db: Db, config: AppConfig, bearer: string, now = Date.now()): CredentialRecord {
  const row = db
    .prepare(
      `SELECT id, discord_user_id, guild_id, agent_label, runtime, pinned_team, expires_at, revoked_at
       FROM credentials WHERE lookup_hash = ?`,
    )
    .get(hashSecret(config.pepper, bearer)) as
    | {
        id: string;
        discord_user_id: string;
        guild_id: string;
        agent_label: string;
        runtime: Runtime;
        pinned_team: TeamKey | null;
        expires_at: number;
        revoked_at: number | null;
      }
    | undefined;
  if (!row) throw jsonError("expired", 401);
  if (row.revoked_at) throw jsonError("revoked", 403);
  if (row.expires_at <= now) throw jsonError("expired", 401);
  return {
    id: row.id,
    discordUserId: row.discord_user_id,
    guildId: row.guild_id,
    agentLabel: row.agent_label,
    runtime: row.runtime,
    pinnedTeam: row.pinned_team,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

export function assertNotPaused(db: Db, teamKey: string | null, surface: "team" | "questions" | "status"): void {
  if (getSetting(db, "bridge_paused") === "on") throw jsonError("bridge_paused", 503);
  if (surface === "status") return;
  if (surface === "team" && teamKey && getSetting(db, `team_paused:${teamKey}`) === "on") {
    throw jsonError("team_paused", 503);
  }
}

export function rememberPost(
  db: Db,
  credentialId: string,
  clientRequestId: string,
  surface: string,
  discordMessageId: string,
  now: number,
): { created: boolean; discordMessageId: string } {
  const existing = db
    .prepare("SELECT discord_message_id FROM posts WHERE credential_id = ? AND client_request_id = ?")
    .get(credentialId, clientRequestId) as { discord_message_id: string } | undefined;
  if (existing) return { created: false, discordMessageId: existing.discord_message_id };
  db.prepare(
    "INSERT INTO posts(credential_id, client_request_id, surface, discord_message_id, created_at) VALUES(?, ?, ?, ?, ?)",
  ).run(credentialId, clientRequestId, surface, discordMessageId, now);
  db.prepare("INSERT INTO post_times(credential_id, posted_at) VALUES(?, ?)").run(credentialId, now);
  return { created: true, discordMessageId };
}

export function assertPostRate(db: Db, credentialId: string, now: number): void {
  const last = db
    .prepare("SELECT posted_at FROM post_times WHERE credential_id = ? ORDER BY posted_at DESC LIMIT 1")
    .get(credentialId) as { posted_at: number } | undefined;
  if (last && now - last.posted_at < 10_000) throw jsonError("rate_limited", 429);
  const hourAgo = now - 3600_000;
  const count = db
    .prepare("SELECT COUNT(*) AS n FROM post_times WHERE credential_id = ? AND posted_at > ?")
    .get(credentialId, hourAgo) as { n: number };
  if (count.n >= 30) throw jsonError("rate_limited", 429);
}

export function assertSyncRate(db: Db, credentialId: string, now: number): void {
  const row = db.prepare("SELECT last_at FROM sync_times WHERE credential_id = ?").get(credentialId) as
    | { last_at: number }
    | undefined;
  if (row && now - row.last_at < 1000) throw jsonError("rate_limited", 429);
  db.prepare(
    "INSERT INTO sync_times(credential_id, last_at) VALUES(?, ?) ON CONFLICT(credential_id) DO UPDATE SET last_at = excluded.last_at",
  ).run(credentialId, now);
}

export function revokeUser(db: Db, discordUserId: string, now = Date.now()): number {
  const result = db
    .prepare("UPDATE credentials SET revoked_at = ? WHERE discord_user_id = ? AND revoked_at IS NULL")
    .run(now, discordUserId);
  audit(db, discordUserId, "revoke_user");
  return result.changes;
}

export function revokeCredential(db: Db, id: string, now = Date.now()): number {
  const result = db.prepare("UPDATE credentials SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").run(now, id);
  audit(db, id, "revoke_credential");
  return result.changes;
}
