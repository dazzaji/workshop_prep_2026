import path from "node:path";
import type { AppConfig, Phase, TeamKey } from "./types.js";

function env(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

function csv(name: string): string[] {
  return env(name)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parsePhase(raw: string): Phase {
  if (raw === "questions" || raw === "both" || raw === "team") return raw;
  return "team";
}

function parseTeams(): AppConfig["teams"] {
  const raw = env("TEAM_SURFACES_JSON");
  if (!raw) {
    return [
      {
        key: "test-team-a",
        roleId: env("TEAM_A_ROLE_ID", "role-a"),
        channelId: env("TEAM_A_CHANNEL_ID", "channel-a"),
        label: "test-team-a",
      },
      {
        key: "test-team-b",
        roleId: env("TEAM_B_ROLE_ID", "role-b"),
        channelId: env("TEAM_B_CHANNEL_ID", "channel-b"),
        label: "test-team-b",
      },
    ];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("TEAM_SURFACES_JSON must be valid JSON");
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 25) {
    throw new Error("TEAM_SURFACES_JSON must contain 1-25 teams");
  }
  const teams = parsed.map((value, index) => {
    if (!value || typeof value !== "object") throw new Error(`Invalid team at index ${index}`);
    const item = value as Record<string, unknown>;
    const key = typeof item.key === "string" ? item.key.trim() : "";
    const roleId = typeof item.roleId === "string" ? item.roleId.trim() : "";
    const channelId = typeof item.channelId === "string" ? item.channelId.trim() : "";
    const label = typeof item.label === "string" ? item.label.trim() : key;
    if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(key) || !roleId || !channelId || !label) {
      throw new Error(`Invalid team fields at index ${index}`);
    }
    return { key, roleId, channelId, label };
  });
  if (new Set(teams.map((team) => team.key)).size !== teams.length) throw new Error("Duplicate team key");
  if (new Set(teams.map((team) => team.roleId)).size !== teams.length) throw new Error("Duplicate team role ID");
  if (new Set(teams.map((team) => team.channelId)).size !== teams.length) throw new Error("Duplicate team channel ID");
  return teams;
}

export function configFromEnv(overrides: Partial<AppConfig> = {}): AppConfig {
  const base: AppConfig = {
    port: Number(env("PORT", "8787")) || 8787,
    publicOrigin: env("PUBLIC_ORIGIN", "http://127.0.0.1:8787").replace(/\/$/, ""),
    sqlitePath: env("SQLITE_PATH", path.resolve("data/bridge.sqlite")),
    pepper: env("BRIDGE_PEPPER", "dev-only-pepper-change-me"),
    guildId: env("DISCORD_GUILD_ID", "guild-test"),
    operatorRoleIds: csv("OPERATOR_ROLE_IDS"),
    teams: parseTeams(),
    questionsChannelId: env("QUESTIONS_CHANNEL_ID", "channel-questions"),
    credentialTtlMs: (Number(env("CREDENTIAL_TTL_HOURS", "8")) || 8) * 3600_000,
    setupCodeTtlMs: 5 * 60_000,
    defaultPhase: parsePhase(env("PHASE", "team")),
    questionsPostEnabled: env("QUESTIONS_POST_ENABLED", "false") === "true",
  };
  return { ...base, ...overrides };
}

export function assertProductionConfig(config: AppConfig, secrets: { token: string; clientId: string }): void {
  const failures: string[] = [];
  if (!secrets.token) failures.push("DISCORD_TOKEN");
  if (!secrets.clientId) failures.push("DISCORD_CLIENT_ID");
  if (!config.publicOrigin.startsWith("https://")) failures.push("PUBLIC_ORIGIN must use HTTPS");
  if (config.pepper === "dev-only-pepper-change-me" || config.pepper.length < 32) failures.push("BRIDGE_PEPPER");
  if (config.guildId === "guild-test") failures.push("DISCORD_GUILD_ID");
  if (config.operatorRoleIds.length === 0) failures.push("OPERATOR_ROLE_IDS");
  for (const team of config.teams) {
    if (!/^\d{16,22}$/.test(team.roleId)) failures.push(`${team.key} role ID`);
    if (!/^\d{16,22}$/.test(team.channelId)) failures.push(`${team.key} channel ID`);
  }
  if (config.questionsChannelId === "channel-questions") failures.push("QUESTIONS_CHANNEL_ID");
  if (failures.length) throw new Error(`Unsafe production configuration: ${failures.join(", ")}`);
}

export function teamByKey(config: AppConfig, key: string) {
  return config.teams.find((t) => t.key === key) ?? null;
}

export function teamByRole(config: AppConfig, roleId: string) {
  return config.teams.find((t) => t.roleId === roleId) ?? null;
}
