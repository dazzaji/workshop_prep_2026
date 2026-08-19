import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { afterEach, test } from "node:test";
import { assertProductionConfig, configFromEnv } from "../src/config.ts";
import { openDb, setSetting } from "../src/db.ts";
import { FakeDiscord } from "../src/discord.ts";
import { createHttpApp } from "../src/http.ts";
import { decideConnectPin } from "../src/authorize.ts";
import { issueSetupCode } from "../src/store.ts";
import { agentConnectCommand } from "../src/bot.ts";
import { assignExclusiveTeam, removeConfiguredTeams, type DiscordMemberRecord, type TeamRoleApi } from "../src/team-admin.ts";
import { assertPostableMessage } from "../src/content.ts";
import type { AppConfig } from "../src/types.ts";

type Clock = { now: number };

function tempDb(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "byoa-")), "bridge.sqlite");
}

function makeConfig(): AppConfig {
  return configFromEnv({
    pepper: "test-pepper",
    guildId: "guild-1",
    sqlitePath: tempDb(),
    publicOrigin: "http://127.0.0.1:8787",
    operatorRoleIds: ["role-op"],
    teams: [
      { key: "test-team-a", roleId: "role-a", channelId: "channel-a", label: "test-team-a" },
      { key: "test-team-b", roleId: "role-b", channelId: "channel-b", label: "test-team-b" },
    ],
    questionsChannelId: "channel-q",
    defaultPhase: "team",
    questionsPostEnabled: false,
    credentialTtlMs: 8 * 3600_000,
    setupCodeTtlMs: 5 * 60_000,
  });
}

async function listen(app: ReturnType<typeof createHttpApp>): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no bind");
  return {
    url: `http://127.0.0.1:${addr.port}`,
    close: () =>
      new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

function seedUser(discord: FakeDiscord, id: string, name: string, roles: string[], administrator = false) {
  discord.putMember({ id, displayName: name, roleIds: roles, administrator });
}

async function connectAgent(
  url: string,
  db: ReturnType<typeof openDb>,
  config: AppConfig,
  user: { id: string; label: string; runtime: "claude" | "codex"; team: "test-team-a" | "test-team-b" },
  clock: Clock,
) {
  const code = issueSetupCode(
    db,
    config,
    {
      discordUserId: user.id,
      guildId: config.guildId,
      agentLabel: user.label,
      runtime: user.runtime,
      pinnedTeam: user.team,
    },
    clock.now,
  );
  const res = await fetch(`${url}/v1/connect`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const body = (await res.json()) as { token?: string; error?: string };
  return { status: res.status, body, code };
}

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (closers.length) await closers.pop()?.();
});

test("health and skill are public", async () => {
  const config = makeConfig();
  const db = openDb(config.sqlitePath);
  const discord = new FakeDiscord();
  const http = await listen(createHttpApp({ db, config, discord }));
  closers.push(http.close);
  const health = await (await fetch(`${http.url}/health`)).json();
  assert.equal(health.ok, true);
  assert.equal(health.discord, "ready");
  const skill = await (await fetch(`${http.url}/SKILL.md`)).text();
  assert.match(skill, /POST \{ORIGIN\}\/v1\/post/);
  assert.match(skill, /Do not poll/);
});

test("health fails while Discord is not ready", async () => {
  const db = openDb(":memory:");
  const config = makeConfig();
  const discord = new FakeDiscord();
  const http = await listen(createHttpApp({ db, config, discord, ready: () => false }));

  const response = await fetch(`${http.url}/health`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, db: "ok", discord: "not_ready" });

  await http.close();
  db.close();
});

test("production configuration rejects placeholders and accepts complete HTTPS configuration", () => {
  assert.equal(configFromEnv().setupCodeTtlMs, 20 * 60_000);
  assert.throws(
    () => assertProductionConfig(configFromEnv(), { token: "", clientId: "" }),
    /Unsafe production configuration/,
  );
  const config = makeConfig();
  config.publicOrigin = "https://agents.example.test";
  config.pepper = "a-production-pepper-with-at-least-32-characters";
  config.guildId = "123456789012345678";
  config.operatorRoleIds = ["223456789012345678"];
  config.teams = [
    { key: "test-team-a", roleId: "323456789012345678", channelId: "423456789012345678", label: "test-team-a" },
    { key: "test-team-b", roleId: "523456789012345678", channelId: "623456789012345678", label: "test-team-b" },
  ];
  config.questionsChannelId = "723456789012345678";
  assert.doesNotThrow(() =>
    assertProductionConfig(config, { token: "test-token-present", clientId: "823456789012345678" }),
  );
});

test("slash command exposes every configured team choice", () => {
  const config = makeConfig();
  config.teams.push({ key: "test-team-c", roleId: "role-c", channelId: "channel-c", label: "Test Team C" });
  const command = agentConnectCommand(config).toJSON();
  const teamOption = command.options?.find((option) => option.name === "team");
  assert.deepEqual(
    teamOption && "choices" in teamOption ? teamOption.choices?.map((choice) => choice.value) : [],
    ["test-team-a", "test-team-b", "test-team-c"],
  );
  const runtimeOption = command.options?.find((option) => option.name === "runtime");
  const agentNameOption = command.options?.find((option) => option.name === "agent_name");
  assert.equal(runtimeOption?.required, true);
  assert.equal(agentNameOption?.required, false);
  assert.equal(teamOption?.required, false);
});

class FakeTeamRoleApi implements TeamRoleApi {
  member: DiscordMemberRecord = {
    id: "123456789012345678",
    username: "tester",
    globalName: "Test User",
    nick: null,
    roleIds: ["role-b", "role-op"],
  };
  changed: Array<{ action: "add" | "remove"; roleId: string }> = [];

  async getMember(): Promise<DiscordMemberRecord> {
    return { ...this.member, roleIds: [...this.member.roleIds] };
  }
  async searchMembers(): Promise<DiscordMemberRecord[]> {
    return [{ ...this.member, roleIds: [...this.member.roleIds] }];
  }
  async addRole(_guildId: string, _userId: string, roleId: string): Promise<void> {
    this.changed.push({ action: "add", roleId });
    if (!this.member.roleIds.includes(roleId)) this.member.roleIds.push(roleId);
  }
  async removeRole(_guildId: string, _userId: string, roleId: string): Promise<void> {
    this.changed.push({ action: "remove", roleId });
    this.member.roleIds = this.member.roleIds.filter((value) => value !== roleId);
  }
}

test("team administration modifies only configured team roles", async () => {
  const config = makeConfig();
  const api = new FakeTeamRoleApi();

  const assigned = await assignExclusiveTeam(config, api, api.member.id, "test-team-a");
  assert.equal(assigned.changed, true);
  assert.deepEqual(assigned.removedTeams, ["test-team-b"]);
  assert.deepEqual(api.changed, [
    { action: "remove", roleId: "role-b" },
    { action: "add", roleId: "role-a" },
  ]);
  assert.deepEqual(api.member.roleIds.sort(), ["role-a", "role-op"]);
  await assert.rejects(() => assignExclusiveTeam(config, api, api.member.id, "Interlateral Operator"), /Unknown team key/);
  assert.deepEqual(api.member.roleIds.sort(), ["role-a", "role-op"]);

  const removed = await removeConfiguredTeams(config, api, api.member.id);
  assert.deepEqual(removed.removedTeams, ["test-team-a"]);
  assert.deepEqual(api.member.roleIds, ["role-op"]);
});

test("exchange, status, sync, post happy path with attribution", async () => {
  const config = makeConfig();
  const db = openDb(config.sqlitePath);
  const discord = new FakeDiscord();
  seedUser(discord, "u-a", "Dazza", ["role-a"]);
  discord.seedMessage({
    channelId: "channel-a",
    authorId: "u-a",
    authorLabel: "Dazza",
    bot: false,
    content: "hello team",
    createdAt: 1,
  });
  const clock: Clock = { now: 1_000_000 };
  const http = await listen(createHttpApp({ db, config, discord, now: () => clock.now }));
  closers.push(http.close);
  const connected = await connectAgent(
    http.url,
    db,
    config,
    { id: "u-a", label: "dazza-claude", runtime: "claude", team: "test-team-a" },
    clock,
  );
  assert.equal(connected.status, 200);
  const token = connected.body.token!;
  const status = await (await fetch(`${http.url}/v1/status`, { headers: { authorization: `Bearer ${token}` } })).json();
  assert.equal(status.team_label, "test-team-a");
  assert.deepEqual(status.allowed_surfaces, ["team"]);
  const sync = await (
    await fetch(`${http.url}/v1/sync?surface=team`, { headers: { authorization: `Bearer ${token}` } })
  ).json();
  assert.equal(sync.messages[0].origin, "human");
  assert.equal(sync.untrusted, true);
  const post = await fetch(`${http.url}/v1/post`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      client_request_id: "11111111-1111-1111-1111-111111111111",
      surface: "team",
      message: "Human-approved contribution",
    }),
  });
  assert.equal(post.status, 200);
  assert.match(discord.posted[0].content, /^\[AGENT FOR DAZZA \/ CLAUDE\]\nHuman-approved contribution$/);
});

test("expired and reused setup codes fail", async () => {
  const config = makeConfig();
  const db = openDb(config.sqlitePath);
  const discord = new FakeDiscord();
  seedUser(discord, "u-a", "Ada", ["role-a"]);
  const clock: Clock = { now: 1_000_000 };
  const http = await listen(createHttpApp({ db, config, discord, now: () => clock.now }));
  closers.push(http.close);

  const stale = issueSetupCode(
    db,
    config,
    { discordUserId: "u-a", guildId: config.guildId, agentLabel: "a", runtime: "claude", pinnedTeam: "test-team-a" },
    clock.now,
  );
  clock.now += 6 * 60_000;
  const expired = await fetch(`${http.url}/v1/connect`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: stale }),
  });
  assert.equal(expired.status, 400);
  assert.equal(((await expired.json()) as { error: string }).error, "code_expired");

  clock.now = 1_000_000;
  const first = await connectAgent(
    http.url,
    db,
    config,
    { id: "u-a", label: "a", runtime: "codex", team: "test-team-a" },
    clock,
  );
  assert.equal(first.status, 200);
  const reuse = await fetch(`${http.url}/v1/connect`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: first.code }),
  });
  assert.equal(reuse.status, 400);
  assert.equal(((await reuse.json()) as { error: string }).error, "code_used");
});

test("team isolation: A cannot sync or post to B", async () => {
  const config = makeConfig();
  const db = openDb(config.sqlitePath);
  const discord = new FakeDiscord();
  seedUser(discord, "u-a", "Ann", ["role-a"]);
  seedUser(discord, "u-b", "Bob", ["role-b"]);
  discord.seedMessage({
    channelId: "channel-b",
    authorId: "u-b",
    authorLabel: "Bob",
    bot: false,
    content: "secret b",
    createdAt: 1,
  });
  const clock: Clock = { now: 2_000_000 };
  const http = await listen(createHttpApp({ db, config, discord, now: () => clock.now }));
  closers.push(http.close);
  const a = await connectAgent(
    http.url,
    db,
    config,
    { id: "u-a", label: "ann", runtime: "claude", team: "test-team-a" },
    clock,
  );
  const sync = await fetch(`${http.url}/v1/sync?surface=team`, {
    headers: { authorization: `Bearer ${a.body.token}` },
  });
  const syncBody = (await sync.json()) as { messages: { text: string }[] };
  assert.equal(sync.status, 200);
  assert.equal(
    syncBody.messages.some((m) => m.text.includes("secret b")),
    false,
  );
  // raw channel/guild ids are ignored: surface names only
  const bad = await fetch(`${http.url}/v1/sync?surface=channel-b`, {
    headers: { authorization: `Bearer ${a.body.token}` },
  });
  assert.equal(bad.status, 403);
  assert.equal(((await bad.json()) as { error: string }).error, "forbidden_surface");
});

test("role removal and phase change recompute surfaces", async () => {
  const config = makeConfig();
  const db = openDb(config.sqlitePath);
  const discord = new FakeDiscord();
  seedUser(discord, "u-a", "Ann", ["role-a"]);
  const clock: Clock = { now: 3_000_000 };
  const http = await listen(createHttpApp({ db, config, discord, now: () => clock.now }));
  closers.push(http.close);
  const a = await connectAgent(
    http.url,
    db,
    config,
    { id: "u-a", label: "ann", runtime: "claude", team: "test-team-a" },
    clock,
  );
  seedUser(discord, "u-a", "Ann", []);
  const denied = await fetch(`${http.url}/v1/sync?surface=team`, {
    headers: { authorization: `Bearer ${a.body.token}` },
  });
  assert.equal(denied.status, 403);
  setSetting(db, "phase", "questions");
  const questionsDenied = await fetch(`${http.url}/v1/sync?surface=questions`, {
    headers: { authorization: `Bearer ${a.body.token}` },
  });
  assert.equal(questionsDenied.status, 403);
  seedUser(discord, "u-a", "Ann", ["role-a"]);
  const teamBlocked = await fetch(`${http.url}/v1/sync?surface=team`, {
    headers: { authorization: `Bearer ${a.body.token}` },
  });
  assert.equal(teamBlocked.status, 403);
  const q = await fetch(`${http.url}/v1/sync?surface=questions`, {
    headers: { authorization: `Bearer ${a.body.token}` },
  });
  assert.equal(q.status, 200);
  const qPost = await fetch(`${http.url}/v1/post`, {
    method: "POST",
    headers: { authorization: `Bearer ${a.body.token}`, "content-type": "application/json" },
    body: JSON.stringify({
      client_request_id: "22222222-2222-2222-2222-222222222222",
      surface: "questions",
      message: "should be denied by default",
    }),
  });
  assert.equal(qPost.status, 403);
});

test("global pause, team pause, and revoke", async () => {
  const config = makeConfig();
  const db = openDb(config.sqlitePath);
  const discord = new FakeDiscord();
  seedUser(discord, "u-a", "Ann", ["role-a"]);
  const clock: Clock = { now: 4_000_000 };
  const http = await listen(createHttpApp({ db, config, discord, now: () => clock.now }));
  closers.push(http.close);
  const a = await connectAgent(
    http.url,
    db,
    config,
    { id: "u-a", label: "ann", runtime: "codex", team: "test-team-a" },
    clock,
  );
  setSetting(db, "bridge_paused", "on");
  const paused = await fetch(`${http.url}/v1/sync?surface=team`, {
    headers: { authorization: `Bearer ${a.body.token}` },
  });
  assert.equal(paused.status, 503);
  assert.equal(((await paused.json()) as { error: string }).error, "bridge_paused");
  setSetting(db, "bridge_paused", "off");
  setSetting(db, "team_paused:test-team-a", "on");
  const teamPaused = await fetch(`${http.url}/v1/sync?surface=team`, {
    headers: { authorization: `Bearer ${a.body.token}` },
  });
  assert.equal(teamPaused.status, 503);
  setSetting(db, "team_paused:test-team-a", "off");
  db.prepare("UPDATE credentials SET revoked_at = ?").run(clock.now);
  const revoked = await fetch(`${http.url}/v1/sync?surface=team`, {
    headers: { authorization: `Bearer ${a.body.token}` },
  });
  assert.equal(revoked.status, 403);
  assert.equal(((await revoked.json()) as { error: string }).error, "revoked");
});

test("idempotent post retries do not create a second message", async () => {
  const config = makeConfig();
  const db = openDb(config.sqlitePath);
  const discord = new FakeDiscord();
  seedUser(discord, "u-a", "Ann", ["role-a"]);
  const clock: Clock = { now: 5_000_000 };
  const http = await listen(createHttpApp({ db, config, discord, now: () => clock.now }));
  closers.push(http.close);
  const a = await connectAgent(
    http.url,
    db,
    config,
    { id: "u-a", label: "ann", runtime: "claude", team: "test-team-a" },
    clock,
  );
  const payload = {
    client_request_id: "33333333-3333-3333-3333-333333333333",
    surface: "team",
    message: "once only",
  };
  const first = await fetch(`${http.url}/v1/post`, {
    method: "POST",
    headers: { authorization: `Bearer ${a.body.token}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  clock.now += 15_000;
  const second = await fetch(`${http.url}/v1/post`, {
    method: "POST",
    headers: { authorization: `Bearer ${a.body.token}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const firstBody = (await first.json()) as { discord_message_id: string; duplicate: boolean };
  const secondBody = (await second.json()) as { discord_message_id: string; duplicate: boolean };
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(secondBody.duplicate, true);
  assert.equal(firstBody.discord_message_id, secondBody.discord_message_id);
  assert.equal(discord.posted.length, 1);
});

test("concurrent idempotent posts create exactly one Discord message", async () => {
  const config = makeConfig();
  const db = openDb(config.sqlitePath);
  const discord = new FakeDiscord();
  seedUser(discord, "u-a", "Ann", ["role-a"]);
  const clock: Clock = { now: 5_500_000 };
  const http = await listen(createHttpApp({ db, config, discord, now: () => clock.now }));
  closers.push(http.close);
  const a = await connectAgent(
    http.url,
    db,
    config,
    { id: "u-a", label: "ann", runtime: "claude", team: "test-team-a" },
    clock,
  );
  const payload = JSON.stringify({
    client_request_id: "35353535-3535-4353-8353-353535353535",
    surface: "team",
    message: "once under concurrency",
  });
  const request = () =>
    fetch(`${http.url}/v1/post`, {
      method: "POST",
      headers: { authorization: `Bearer ${a.body.token}`, "content-type": "application/json" },
      body: payload,
    });
  const [first, second] = await Promise.all([request(), request()]);
  const bodies = await Promise.all([first.json(), second.json()]) as Array<{ duplicate: boolean }>;
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.deepEqual(bodies.map((body) => body.duplicate).sort(), [false, true]);
  assert.equal(discord.posted.length, 1);
});

test("concurrent distinct posts obey the per-credential rate limit", async () => {
  const config = makeConfig();
  const db = openDb(config.sqlitePath);
  const discord = new FakeDiscord();
  seedUser(discord, "u-a", "Ann", ["role-a"]);
  const clock: Clock = { now: 5_600_000 };
  const http = await listen(createHttpApp({ db, config, discord, now: () => clock.now }));
  closers.push(http.close);
  const a = await connectAgent(
    http.url,
    db,
    config,
    { id: "u-a", label: "ann", runtime: "claude", team: "test-team-a" },
    clock,
  );
  const request = (clientRequestId: string) =>
    fetch(`${http.url}/v1/post`, {
      method: "POST",
      headers: { authorization: `Bearer ${a.body.token}`, "content-type": "application/json" },
      body: JSON.stringify({ client_request_id: clientRequestId, surface: "team", message: clientRequestId }),
    });
  const responses = await Promise.all([
    request("56565656-5656-4565-8565-565656565656"),
    request("57575757-5757-4575-8575-575757575757"),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 429]);
  assert.equal(discord.posted.length, 1);
});

test("pause is enforced before returning an idempotent retry", async () => {
  const config = makeConfig();
  const db = openDb(config.sqlitePath);
  const discord = new FakeDiscord();
  seedUser(discord, "u-a", "Ann", ["role-a"]);
  const clock: Clock = { now: 5_750_000 };
  const http = await listen(createHttpApp({ db, config, discord, now: () => clock.now }));
  closers.push(http.close);
  const a = await connectAgent(
    http.url,
    db,
    config,
    { id: "u-a", label: "ann", runtime: "codex", team: "test-team-a" },
    clock,
  );
  const payload = JSON.stringify({
    client_request_id: "57575757-5757-4757-8757-575757575757",
    surface: "team",
    message: "approved once",
  });
  const headers = { authorization: `Bearer ${a.body.token}`, "content-type": "application/json" };
  const first = await fetch(`${http.url}/v1/post`, { method: "POST", headers, body: payload });
  assert.equal(first.status, 200);
  setSetting(db, "bridge_paused", "on");
  const retry = await fetch(`${http.url}/v1/post`, { method: "POST", headers, body: payload });
  assert.equal(retry.status, 503);
  assert.equal(((await retry.json()) as { error: string }).error, "bridge_paused");
  assert.equal(discord.posted.length, 1);
});

test("mentions and discord invites are rejected", async () => {
  const config = makeConfig();
  const db = openDb(config.sqlitePath);
  const discord = new FakeDiscord();
  seedUser(discord, "u-a", "Ann", ["role-a"]);
  const clock: Clock = { now: 6_000_000 };
  const http = await listen(createHttpApp({ db, config, discord, now: () => clock.now }));
  closers.push(http.close);
  const a = await connectAgent(
    http.url,
    db,
    config,
    { id: "u-a", label: "ann", runtime: "claude", team: "test-team-a" },
    clock,
  );
  for (const message of ["hello @everyone", "see discord.gg/abc123", "hi <@123>"]) {
    const res = await fetch(`${http.url}/v1/post`, {
      method: "POST",
      headers: { authorization: `Bearer ${a.body.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        client_request_id: `44444444-4444-4444-4444-44444444444${message.length}`,
        surface: "team",
        message,
      }),
    });
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as { error: string }).error, "unapproved_mention");
  }
  assert.equal(discord.posted.length, 0);
});

test("post body accepts 1,500 characters and rejects 1,501", () => {
  assert.equal(assertPostableMessage("a".repeat(1_500)).length, 1_500);
  assert.throws(() => assertPostableMessage("a".repeat(1_501)), /invalid_request/);
});

test("operators without an explicit team are refused; pin does not inherit both teams", async () => {
  const config = makeConfig();
  const db = openDb(config.sqlitePath);
  const discord = new FakeDiscord();
  seedUser(discord, "op", "Ops", ["role-op", "role-a", "role-b"]);
  discord.seedMessage({
    channelId: "channel-b",
    authorId: "u-b",
    authorLabel: "Bob",
    bot: false,
    content: "only b",
    createdAt: 1,
  });
  assert.throws(() => decideConnectPin(config, discord.members.get("op")!, null), /connect_refused/);
  const pin = decideConnectPin(config, discord.members.get("op")!, "test-team-a");
  assert.equal(pin, "test-team-a");
  const clock: Clock = { now: 7_000_000 };
  const http = await listen(createHttpApp({ db, config, discord, now: () => clock.now }));
  closers.push(http.close);
  const connected = await connectAgent(
    http.url,
    db,
    config,
    { id: "op", label: "ops-bot", runtime: "codex", team: "test-team-a" },
    clock,
  );
  const sync = await (
    await fetch(`${http.url}/v1/sync?surface=team`, {
      headers: { authorization: `Bearer ${connected.body.token}` },
    })
  ).json();
  assert.equal(
    (sync.messages as { text: string }[]).some((m) => m.text === "only b"),
    false,
  );
});

test("unassigned and mismatched users cannot select a team", () => {
  const config = makeConfig();
  assert.throws(
    () => decideConnectPin(config, { id: "none", displayName: "None", roleIds: [], administrator: false }, "test-team-a"),
    /connect_refused/,
  );
  assert.throws(
    () =>
      decideConnectPin(
        config,
        { id: "a", displayName: "A", roleIds: ["role-a"], administrator: false },
        "test-team-b",
      ),
    /connect_refused/,
  );
});

test("invalid and cross-surface cursors are rejected", async () => {
  const config = makeConfig();
  const db = openDb(config.sqlitePath);
  const discord = new FakeDiscord();
  seedUser(discord, "u-a", "Ann", ["role-a"]);
  const clock: Clock = { now: 8_000_000 };
  const http = await listen(createHttpApp({ db, config, discord, now: () => clock.now }));
  closers.push(http.close);
  const a = await connectAgent(
    http.url,
    db,
    config,
    { id: "u-a", label: "ann", runtime: "claude", team: "test-team-a" },
    clock,
  );
  const invalid = await fetch(`${http.url}/v1/sync?surface=team&after=not-a-signed-cursor`, {
    headers: { authorization: `Bearer ${a.body.token}` },
  });
  assert.equal(invalid.status, 400);
  assert.equal(((await invalid.json()) as { error: string }).error, "invalid_request");
});
