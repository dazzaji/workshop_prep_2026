import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Request, type Response } from "express";
import { resolveAccess } from "./authorize.js";
import { classifyOrigin, assertPostableMessage, composeAgentPost } from "./content.js";
import type { AppConfig, DiscordAdapter, SurfaceName } from "./types.js";
import { readCursor, signCursor } from "./crypto.js";
import type { Db } from "./db.js";
import { getPhase, getSetting, audit } from "./db.js";
import { BridgeError } from "./errors.js";
import {
  assertNotPaused,
  assertPostRate,
  assertSyncRate,
  exchangeCode,
  loadCredential,
  rememberPost,
} from "./store.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function skillPath(): string {
  const candidates = [
    path.resolve(here, "../SKILL.md"),
    path.resolve(process.cwd(), "SKILL.md"),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

function bearer(req: Request): string {
  const header = req.header("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) throw new BridgeError("expired", 401);
  return match[1];
}

function surfaceOf(value: unknown): SurfaceName {
  if (value === "team" || value === "questions") return value;
  throw new BridgeError("forbidden_surface", 403);
}

function sendError(res: Response, err: unknown): void {
  if (err instanceof BridgeError) {
    res.status(err.status).json({ error: err.code });
    return;
  }
  res.status(500).json({ error: "internal" });
}

export function createHttpApp(opts: {
  db: Db;
  config: AppConfig;
  discord: DiscordAdapter;
  now?: () => number;
  ready?: () => boolean;
}) {
  const now = opts.now ?? (() => Date.now());
  const postLocks = new Map<string, Promise<unknown>>();
  const serializePost = async <T>(key: string, work: () => Promise<T>): Promise<T> => {
    const previous = postLocks.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(work);
    postLocks.set(key, current);
    try {
      return await current;
    } finally {
      if (postLocks.get(key) === current) postLocks.delete(key);
    }
  };
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));

  app.get("/health", (_req, res) => {
    try {
      opts.db.prepare("SELECT 1").get();
      const discordReady = opts.ready?.() ?? true;
      if (!discordReady) {
        res.status(503).json({ ok: false, db: "ok", discord: "not_ready" });
        return;
      }
      res.json({ ok: true, db: "ok", discord: "ready" });
    } catch {
      res.status(503).json({ ok: false, db: "error" });
    }
  });

  app.get(["/SKILL.md", "/skill.md"], (_req, res) => {
    res.type("text/markdown").send(fs.readFileSync(skillPath(), "utf8"));
  });

  app.post("/v1/connect", (req, res) => {
    try {
      const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
      if (!code) throw new BridgeError("invalid_code", 400);
      const exchanged = exchangeCode(opts.db, opts.config, code, now());
      res.json({
        token: exchanged.token,
        expires_at: new Date(exchanged.credential.expiresAt).toISOString(),
        credential_id: exchanged.credential.id,
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get("/v1/status", async (req, res) => {
    try {
      const cred = loadCredential(opts.db, opts.config, bearer(req), now());
      assertNotPaused(opts.db, cred.pinnedTeam, "status");
      const { member, access } = await resolveAccess(opts.db, opts.config, opts.discord, {
        discordUserId: cred.discordUserId,
        guildId: cred.guildId,
        pinnedTeam: cred.pinnedTeam,
      });
      res.json({
        human_display_label: member.displayName,
        agent_display_label: cred.agentLabel,
        runtime: cred.runtime,
        allowed_surfaces: access.surfaces,
        team_label: access.team?.label ?? null,
        credential_expiration: new Date(cred.expiresAt).toISOString(),
        bridge_paused: getSetting(opts.db, "bridge_paused") === "on",
        phase: getPhase(opts.db, opts.config.defaultPhase),
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get("/v1/sync", async (req, res) => {
    try {
      const cred = loadCredential(opts.db, opts.config, bearer(req), now());
      const surface = surfaceOf(req.query.surface);
      const { member, access, channelId } = await resolveAccess(opts.db, opts.config, opts.discord, {
        discordUserId: cred.discordUserId,
        guildId: cred.guildId,
        pinnedTeam: cred.pinnedTeam,
        surface,
      });
      assertNotPaused(opts.db, access.team?.key ?? cred.pinnedTeam, surface);
      assertSyncRate(opts.db, cred.id, now());
      if (!channelId) throw new BridgeError("forbidden_surface", 403);

      const afterRaw = typeof req.query.after === "string" ? req.query.after : "";
      const cursor = afterRaw ? readCursor(opts.config.pepper, afterRaw) : null;
      if (afterRaw && (!cursor || cursor.surface !== surface)) throw new BridgeError("invalid_request", 400);
      const afterId = cursor?.lastId;
      const messages = await opts.discord.fetchMessages(channelId, afterId, 50);
      const last = messages[messages.length - 1];
      res.json({
        surface,
        team_label: access.team?.label ?? null,
        human_display_label: member.displayName,
        untrusted: true,
        messages: messages.map((m) => ({
          id: m.id,
          origin: classifyOrigin(m),
          author_label: m.authorLabel,
          created_at: new Date(m.createdAt).toISOString(),
          text: m.content,
        })),
        cursor: last ? signCursor(opts.config.pepper, { surface, lastId: last.id }) : afterRaw || null,
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post("/v1/post", async (req, res) => {
    try {
      const cred = loadCredential(opts.db, opts.config, bearer(req), now());
      const surface = surfaceOf(req.body?.surface);
      const clientRequestId = typeof req.body?.client_request_id === "string" ? req.body.client_request_id.trim() : "";
      if (!/^[0-9a-fA-F-]{8,64}$/.test(clientRequestId)) throw new BridgeError("invalid_request", 400);
      const body = assertPostableMessage(String(req.body?.message ?? ""));

      const { member, access, channelId } = await resolveAccess(opts.db, opts.config, opts.discord, {
        discordUserId: cred.discordUserId,
        guildId: cred.guildId,
        pinnedTeam: cred.pinnedTeam,
        surface,
      });
      assertNotPaused(opts.db, access.team?.key ?? cred.pinnedTeam, surface);
      if (surface === "questions" && !access.questionsPost) throw new BridgeError("forbidden_surface", 403);
      if (!channelId) throw new BridgeError("forbidden_surface", 403);

      const result = await serializePost(cred.id, async () => {
        const existing = opts.db
          .prepare("SELECT discord_message_id FROM posts WHERE credential_id = ? AND client_request_id = ?")
          .get(cred.id, clientRequestId) as { discord_message_id: string } | undefined;
        if (existing) return { surface, discord_message_id: existing.discord_message_id, duplicate: true };

        assertPostRate(opts.db, cred.id, now());
        const content = composeAgentPost(member.displayName, cred.runtime, body);
        const posted = await opts.discord.postMessage(channelId, content);
        rememberPost(opts.db, cred.id, clientRequestId, surface, posted.id, now());
        audit(opts.db, cred.discordUserId, "post", clientRequestId, posted.id);
        return { surface, discord_message_id: posted.id, duplicate: false };
      });
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  return app;
}
