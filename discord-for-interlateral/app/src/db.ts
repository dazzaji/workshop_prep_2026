import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Phase } from "./types.js";

export type RunResult = { changes: number };

export type Statement = {
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): RunResult;
};

export type Db = {
  prepare(sql: string): Statement;
  exec(sql: string): void;
  close(): void;
};

export function openDb(filePath: string): Db {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new DatabaseSync(filePath) as Db;
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS setup_codes (
      code_hash TEXT PRIMARY KEY,
      discord_user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      agent_label TEXT NOT NULL,
      runtime TEXT NOT NULL,
      pinned_team TEXT,
      expires_at INTEGER NOT NULL,
      used_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      lookup_hash TEXT NOT NULL UNIQUE,
      discord_user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      agent_label TEXT NOT NULL,
      runtime TEXT NOT NULL,
      pinned_team TEXT,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS posts (
      credential_id TEXT NOT NULL,
      client_request_id TEXT NOT NULL,
      surface TEXT NOT NULL,
      discord_message_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (credential_id, client_request_id)
    );
    CREATE TABLE IF NOT EXISTS post_times (
      credential_id TEXT NOT NULL,
      posted_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_times (
      credential_id TEXT NOT NULL PRIMARY KEY,
      last_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at INTEGER NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      request_id TEXT,
      discord_message_id TEXT
    );
  `);
  return db;
}

export function getSetting(db: Db, key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(db: Db, key: string, value: string): void {
  db.prepare(
    "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}

export function getPhase(db: Db, fallback: Phase): Phase {
  const value = getSetting(db, "phase");
  if (value === "team" || value === "questions" || value === "both") return value;
  return fallback;
}

export function audit(
  db: Db,
  actor: string,
  action: string,
  requestId?: string,
  discordMessageId?: string,
): void {
  db.prepare(
    "INSERT INTO audit(at, actor, action, request_id, discord_message_id) VALUES(?, ?, ?, ?, ?)",
  ).run(Date.now(), actor, action, requestId ?? null, discordMessageId ?? null);
}
