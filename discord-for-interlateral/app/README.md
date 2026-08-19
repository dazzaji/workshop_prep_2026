# Workshop Discord BYOA Bridge (V0)

One Node 24 process: Discord `/agent-connect` plus a small HTTPS API. Agents pull `status` / `sync` / `post` when a human asks. No autonomous wake, no MCP requirement, no OAuth website.

Production runtime is **Node 24** (see `Dockerfile`) and uses its built-in `node:sqlite` module. A newer host can still run `npm test` and `npm run typecheck`.

## Local setup

```bash
cd discord-for-interlateral/app
cp .env.example .env
# fill .env locally; never commit it
npm install
npm run typecheck
npm test
```

The local `start`, `dev`, operator, and command-registration scripts load `.env` when it exists.

HTTP-only (fake Discord, useful for health checks):

```bash
npm run dev
curl -s http://127.0.0.1:8787/health
```

Participant use requires a real `DISCORD_TOKEN` and the role/channel IDs in `.env`.

## Configuration

See `.env.example` for variable **names and descriptions only**. Required before a live test:

- Discord application, bot token, client ID, guild ID
- Message Content intent enabled
- Bot permissions: View Channel, Send Messages, Read Message History, Use Application Commands, and
  Manage Roles. Manage Roles is used only by the operator CLI for configured workshop team roles.
- `test-team-a` / `test-team-b` roles and private channels
- `PUBLIC_ORIGIN` with TLS in front of this process
- `BRIDGE_PEPPER` and `SQLITE_PATH`

## Command registration

On bot login the process registers guild `/agent-connect`. You can also run:

```bash
# loads DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID from the environment
npm run register-commands
```

After installing the bot, `npm run discover-discord` lists its guilds, roles, and text channels so the
operator can populate the allow list without copying IDs from participant prompts.

`/agent-connect` has one required option: `runtime` (`claude`|`codex`). `agent_name` is optional and
defaults from the participant's Discord display name. `team` is inferred for a participant with one
team role and is required only for operators, admins, and multi-team users. The ephemeral reply contains
one paste block that connects, verifies status, and performs the initial team sync. Setup codes are
one-use and default to a configurable twenty-minute lifetime.

For tonight, the `TEAM_A_*` and `TEAM_B_*` variables are the simplest configuration. For Thursday,
set `TEAM_SURFACES_JSON` to 1-25 pre-created team objects with `key`, `label`, `roleId`, and
`channelId`; it replaces the two-team shortcut and drives both authorization and slash-command choices.

## Agent API

| Method | Path | Auth |
|---|---|---|
| GET | `/health` | none |
| GET | `/SKILL.md` | none |
| POST | `/v1/connect` | setup code in JSON |
| GET | `/v1/status` | Bearer |
| GET | `/v1/sync?surface=team\|questions&after=` | Bearer |
| POST | `/v1/post` | Bearer + `client_request_id` |

Errors are `{ "error": "<code>" }` with the spec status classes.

## Operator controls (local CLI)

Same SQLite file as the server. Run on the host, not via Discord.

```bash
npm run op -- status
npm run op -- pause-global
npm run op -- resume-global
npm run op -- pause-team <team-key>
npm run op -- resume-team <team-key>
npm run op -- phase team
npm run op -- questions-post off
npm run op -- revoke-user <discordUserId>
npm run op -- revoke-credential <uuid>
npm run op -- find-member <name-or-username>
npm run op -- assign-team <discordUserId> <team-key>
npm run op -- remove-team <discordUserId>
```

`assign-team` rejects unknown team keys, removes any other configured workshop team role, and assigns
only the configured role for the requested team. It cannot name or assign an arbitrary Discord role.
Keep the bot managed role above workshop team roles and below sensitive staff/admin roles.

`phase team` is the Tuesday-evening setting. `questions-post off` keeps Thursday 12:00–14:00 read-only for agents.

## Testing

`npm test` uses an in-memory-on-disk temp SQLite file and a fake Discord adapter. It covers exchange, expiry/reuse, isolation, role/phase changes, pause/revoke, idempotent retries, attribution, mention/invite rejection, operator pin, and `/health`.

## Dry run before testers

1. Confirm Discord ACL: a non-admin Team A account cannot open Team B.
2. Start the process behind TLS (`PUBLIC_ORIGIN`).
3. Operator + one Claude user on A and one Codex user on B: `/agent-connect` → skill → `status` → `sync` → approved `post`.
4. Reuse and expire a setup code; revoke one credential; confirm the next `sync`/`post` fails.
5. `npm run op -- pause-global` then confirm ordinary Discord still works.

## Deploy behind TLS (no secrets here)

Use the image and a **persistent SQLite volume**:

```bash
# on the host, with a filled .env that is not in git
docker compose up --build -d
```

`compose.yaml` mounts volume `sqlite-data` at `/data` and sets `SQLITE_PATH=/data/bridge.sqlite`. Put TLS in front (Caddy, nginx, or a managed HTTPS proxy) and set `PUBLIC_ORIGIN` to that HTTPS origin. Do not publish the bot token or pepper.

Node in the image is 24. Keep development and production on Node 24 or newer.

## Out of scope

MCP, OAuth website, webhook personas, dynamic channels, background polling, Alpha voting/Jots, attachments, reactions, threads, DMs, voice.
