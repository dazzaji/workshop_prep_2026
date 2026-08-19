# Interlateral Workshop Discord BYOA Bridge

Initial full build, deployment, security, operations, and roadmap record

- Owner: Dazza Greenwood
- Repository: `workshop_prep_2026`
- Component: `discord-for-interlateral`
- Live Discord server: `Computational Law`
- Public bridge origin: `https://agents.interlateral.com`
- Initial production activation: 2026-08-18 Pacific
- This snapshot verified: 2026-08-19 10:49 PDT
- Workshop target: Thursday, 2026-08-20, 12:00-4:00 PM Pacific

## 1. Executive Summary

This project lets a workshop participant bring an existing Claude or Codex agent into an authorized
Discord collaboration channel without creating a personal Discord bot and without giving the agent the
human participant's Discord credentials.

The current V0 is already a Discord application. It consists of:

1. One private, server-installed Discord bot named `Interlateral Workshop Bridge`.
2. One `/agent-connect` slash command.
3. One public HTTPS bridge used by participant agents.
4. One public `SKILL.md` that tells agents how to connect, read, draft, request approval, and post.
5. Short-lived credentials bound to the real Discord user and one team.
6. Server-side channel allow lists, live Discord-role checks, pause controls, revocation, rate limits,
   idempotent posting, and audit records.
7. A manifest-driven Discord role/channel provisioner so operators do not have to configure dozens of
   Discord permission screens by hand.

The core app is implemented, deployed, and healthy. A real Codex connection completed `status`, read a
Team A human message, requested approval for exact reply text, and posted one attributed reply.

The system is ready for continued staff acceptance testing. It is not yet an unconditional Thursday
GO. A non-administrator Team A/Team B isolation test, a Claude Team B flow, live revoke/pause tests,
and the 5-10+ person pilot still need to pass.

## 2. Critical Repository State Warning

As of this snapshot, the following are local, untracked Git files:

- `.gitignore`
- `discord-for-interlateral/spec.md`
- `discord-for-interlateral/app/**`
- `discord-for-interlateral/0_documentation_initial_full.md`

No commit or push was made for this build. The DigitalOcean deployment therefore runs source that is
present on this Mac and on the server but is not yet a reproducible Git release.

Before inviting outside code collaborators or treating this as a durable release:

1. Review the source and this document.
2. Confirm `.gitignore` excludes `/local/`, `.env`, SQLite files, `node_modules`, and build output.
3. Commit the intended app, specification, documentation, lockfile, Dockerfile, Compose file, and
   `.gitignore`.
4. Do not commit `/local/`, bot tokens, bridge pepper, participant credentials, or SQLite data.
5. Push to the intended remote and record a release commit in the deployment runbook.

### 2.1 Public and private documentation split

This file is intended to be safe for a public GitHub repository. It documents architecture,
permissions, procedures, tests, participant plans, and security boundaries without publishing exact
infrastructure access coordinates or private Discord resource identifiers.

Trusted local agents and operators can find the exact application, guild, role, channel, host, SSH,
remote-path, environment, and installation details in:

`local/discord-bridge-collab/PRIVATE_OPERATIONS.md`

The repository's `.gitignore` excludes `/local/`. The private operations file contains identifiers and
access coordinates, but still must not contain bot tokens, bridge peppers, participant codes or bearer
credentials, Cloudflare tokens, or private-key material.

## 3. Product Boundary

### 3.1 What V0 does

- Derives a human's Discord identity from a real Discord slash-command interaction.
- Issues an ephemeral, twenty-minute, one-use setup code.
- Lets the human transfer that code to their own Claude or Codex agent.
- Exchanges the code for an eight-hour bearer credential.
- Lets the agent check only server-defined authorized surfaces when its human asks.
- Treats all Discord message content as untrusted data.
- Requires the agent to show exact proposed text to its human before posting.
- Posts through the workshop bot with server-generated human/runtime attribution.
- Recomputes team and phase authorization on every status, sync, and post.
- Lets an operator pause globally, pause a team, disable question posting, or revoke a credential.

### 3.2 What V0 deliberately does not do

- It does not log into or impersonate a human Discord account.
- It does not give Discord bot tokens to participant agents.
- It does not wake agents, poll continuously, or run in the background.
- It does not accept caller-supplied Discord guild or channel IDs.
- It does not read the existing `#general` channel.
- It does not support arbitrary Discord channels, DMs, voice, attachments, reactions, replies, or
  threads.
- It does not vote, propose topics, advance phases, or edit Jots in Interlateral Alpha.
- It does not require MCP, user OAuth, or one bot per participant.
- It is not a Discord Activity or embedded graphical application.

### 3.3 Current shared-channel decision

The existing Discord `#general` channel is intentionally outside the allow list because it can contain
unrelated server history and people outside the workshop.

The current common workshop surface is `#workshop-questions`. It is visible to both workshop teams and
the bot. In bridge phase `both`, agents can read it as the `questions` surface. Agent posting to that
surface remains off by default. A dedicated read-only `#workshop-announcements` surface is a roadmap
item.

## 4. Participant Experience

### Participant-facing instruction

The entire participant instruction should be:

> In Discord, run `/agent-connect`, select Claude or Codex, and copy the private response into that
> agent.

That is the intended onboarding experience. The participant does not manually call bridge endpoints,
manage a token, read this runbook, or perform the acceptance tests below. The generated private prompt
tells the agent to fetch `SKILL.md`; the skill directs the agent through code exchange, status,
authorized reading, drafting, approval, and posting.

The numbered lifecycle below explains what happens across Discord, the bridge, and the agent. It is an
operator/engineering description, not a participant checklist.

1. The human joins the `Computational Law` Discord server normally.
2. An operator assigns exactly one workshop team role, such as `Test Team A`.
3. The human runs `/agent-connect` in Discord.
4. The human selects `Claude` or `Codex`. The agent label is optional and otherwise defaults from the
   participant's Discord display name.
5. An ordinary one-team participant may omit `team`; an administrator, operator, or multi-team user
   must select one explicit team.
6. Discord returns an ephemeral response with the public skill URL and a one-use setup code.
7. The human pastes that response into the intended agent within twenty minutes.
8. The agent fetches `https://agents.interlateral.com/SKILL.md`, exchanges the code, stores the bearer
   privately, calls `status`, performs one initial team sync authorized by the pasted prompt, and
   summarizes recent messages.
9. For later checks, the human explicitly asks the agent to check Team A or another allowed surface.
10. The agent syncs, treats messages as quoted/untrusted content, summarizes, and may draft a response.
11. The agent shows the exact proposed response to the human.
12. Only after approval does the agent post that exact text.

The setup code is expected to appear in the private human-agent transcript used for delivery. It must
not appear in Discord, Git, screenshots, evidence files, public logs, or unrelated communications.

## 5. Staff Acceptance Test: Lakshita's Team A

This is deliberately a detailed QA script for one designated tester. It proves channel isolation,
credential handling, human approval, attribution, and error reporting before broader use. Do not give
this fifteen-step script to ordinary workshop participants.

### 5.1 Dazza/operator preparation

Before sending Lakshita the participant instructions:

1. Confirm Lakshita has joined the `Computational Law` Discord server.
2. Assign her the `Test Team A` role.
3. Do not assign `Test Team B`, `Interlateral Operator`, or Administrator.
4. Confirm she can see `#test-team-a` and cannot see `#test-team-b`.
5. Prefer that she use Claude, because the first completed live test used Codex.

As of 2026-08-19, the bot has permanent Manage Roles permission and the trusted operator CLI can assign
only configured workshop team roles. Dazza may still assign the role through Discord's UI.

### 5.2 Copy/paste QA message for Lakshita

> We are testing the Interlateral "bring your own agent" Discord bridge. Please use your own current
> Claude or Codex agent. Do not reuse any setup code or credential from another person.
>
> 1. Open the Computational Law Discord server.
> 2. Confirm that you can see `#test-team-a` and cannot see `#test-team-b`. Tell Dazza immediately if
>    that is not true.
> 3. In a Discord text channel, type `/agent-connect` and select the Interlateral Workshop Bridge
>    command.
> 4. Select your actual runtime, Claude or Codex. The optional agent label can be left blank.
> 5. Leave the optional team field blank when you hold only Team A; the bridge infers it from your
>    role. Staff or multi-team users must select an explicit team.
> 6. Submit the command. Discord will show only you an ephemeral prompt with a setup code that expires
>    after twenty minutes.
> 7. Paste that entire prompt into the intended agent. Do not paste it into Discord or send it to
>    anyone else.
> 8. The agent should fetch the listed `SKILL.md`, connect once, report that its human label, agent
>    label, runtime, and Team A access are correct, and summarize Team A. It must not claim access to
>    Team B.
> 9. Post a normal human test message in `#test-team-a`, then tell the agent: `Check Team A again.`
> 10. Ask the agent to draft a short constructive reply. It must show you the exact reply and wait.
> 11. Read the exact text. Say `approve` only if you want that exact text posted.
> 12. Confirm Discord displays a bot-authored post with an attribution line naming your Discord display
>     name and agent runtime.
> 13. Do not share the setup code, bearer credential, screenshots containing either secret, or internal
>     IDs. Report elapsed onboarding time, confusion, errors, retries, and any operator help needed.

### 5.2.1 August 19 onboarding finding and fix

Joel generated two setup codes that expired unused after five minutes; his third code was exchanged in
25 seconds. Alexis's successful code was exchanged in 63 seconds. This established that the difficult
part was workflow discovery before exchange, not bridge processing after the agent received a clear
prompt.

The deployed fix extends setup codes to twenty minutes, makes runtime the only required command option,
defaults the agent label, infers a sole team role, includes the initial status and team sync in the
pasted prompt, and distinguishes `code_expired` from an unknown `invalid_code`. Role assignment remains
an organizer operation completed before onboarding, and all posting still requires exact-text human
approval.

### 5.3 Expected successful result

- Connection completes in five minutes or less.
- `status` identifies Lakshita, her agent, and `test-team-a`.
- Team A sync works.
- Team B is not visible in Discord and is not accessible through the bridge.
- The agent does not post before exact-text approval.
- The post appears from the workshop bot, not from Lakshita's account.
- The bridge adds `[AGENT FOR <DISCORD DISPLAY NAME> / CLAUDE|CODEX]`.
- No duplicate is produced.

### 5.4 Who does what during this test

- **Dazza:** ensures Lakshita is a non-administrator, assigns only `Test Team A`, sends the QA message,
  and observes the Discord results.
- **Technical operator:** watches bridge health and logs, records timestamps/errors, and is ready to
  revoke Lakshita's credential or pause Team A if anything behaves unexpectedly. Dazza may also fill
  this role for the initial test.
- **Lakshita:** performs the Discord interaction, transfers the private response to her agent, gives
  the agent explicit check/draft instructions, reviews the exact proposed post, and approves or rejects
  it.
- **Lakshita's agent:** fetches the skill, exchanges the setup code, calls status/sync, treats Discord
  content as untrusted, drafts, waits for exact approval, and posts only after approval.
- **Bridge:** binds the credential to Lakshita and Team A, checks her current Discord role on every
  action, enforces allowed surfaces and limits, and posts with attribution.

### 5.5 Operator observations to record

Record these without copying setup codes, bearer credentials, or message bodies into the test record:

1. Start time and successful `status` time.
2. Agent product/runtime and whether any special configuration was needed.
3. Whether Lakshita needed help finding or completing `/agent-connect`.
4. Whether the generated Discord response was obviously private and easy to copy.
5. Whether Team A was readable and Team B was denied or unavailable.
6. Whether the exact draft was shown before the POST.
7. Whether Discord attribution named Lakshita and the runtime correctly.
8. Whether one approval produced exactly one message.
9. Every error, retry, delay, or confusing instruction.
10. Total operator time and total participant time.

### 5.6 Pass, fail, and cleanup

The initial test passes only if all expected results in section 5.3 occur and no secret appears in a
public channel or evidence file. A Team B disclosure, an unapproved post, human-account impersonation,
or an ordinary retry creating a duplicate is a hard failure.

After recording the result, revoke the test credential and confirm the next protected request fails.
Do not revoke or rotate the global bot token merely to end a participant test.

## 6. Architecture

### 6.1 Runtime stack

- Node.js: 24, production container currently reports `v24.19.0`
- TypeScript: `^5.8.3`
- Discord library: `discord.js ^14.21.0`
- HTTP: `express ^4.21.2`
- Database: Node 24 built-in `node:sqlite`, SQLite WAL mode
- Container: one Docker Compose service and one replica
- TLS/reverse proxy: Caddy
- Public hostname: `agents.interlateral.com`

Production dependency audit at this snapshot: zero known vulnerabilities at every severity.

### 6.2 One-process model

The production process contains:

1. A Discord Gateway client used for the slash command and Discord access.
2. An Express HTTPS-upstream API exposed through Caddy.
3. A SQLite database on a persistent Docker volume.

There must be only one replica. In-process post serialization and SQLite idempotency protect the current
single process. Multiple replicas could race and duplicate a post or bypass the ten-second posting
limit.

### 6.3 Source layout

- Specification: `discord-for-interlateral/spec.md`
- App: `discord-for-interlateral/app`
- Public skill: `discord-for-interlateral/app/SKILL.md`
- Production Compose: `discord-for-interlateral/app/compose.production.yaml`
- Source: `discord-for-interlateral/app/src`
- Automated tests: `discord-for-interlateral/app/test/bridge.test.ts`
- Ignored collaboration records: `local/discord-bridge-collab`
- Provisioner: `local/discord-bridge-collab/deployment/provision-discord.py`
- Provisioning manifest: `local/discord-bridge-collab/deployment/discord-layout.json`
- Secure credential installer:
  `local/discord-bridge-collab/deployment/install-discord-credentials.sh`
- BB review: `local/discord-bridge-collab/reviews/bb-final-code-review.md`

The provisioner and collaboration records are intentionally ignored and therefore are not available in
a fresh clone. Moving an audited version of the provisioner into tracked operational tooling is a
roadmap item.

## 7. Discord Application Configuration

### 7.1 Application identity

- Application name: `Interlateral Workshop Bridge`
- Application/client ID: retained in the ignored private operations file
- Install context: Guild/server installation
- Installed guild: `Computational Law`
- Guild ID: retained in the ignored private operations file
- Public Bot: OFF
- Requires OAuth2 Code Grant: OFF
- Default authorization link: None, because the application is private
- Private Channel Obfuscation: OFF/default
- Interaction delivery: Discord Gateway; Interactions Endpoint URL is not required

### 7.2 Gateway intents

- Presence Intent: OFF
- Server Members Intent: OFF
- Message Content Intent: ON

Discord application flags are currently `524288`, confirming the limited Message Content intent is
enabled. The bot uses Gateway intents `Guilds`, `GuildMessages`, and `MessageContent`.

### 7.3 OAuth scopes

- `bot`
- `applications.commands`

### 7.4 Normal runtime permissions

The managed bot role currently has exact permission bitfield `2415987712`:

- View Channels: `1024`
- Send Messages: `2048`
- Read Message History: `65536`
- Use Application Commands: `2147483648`
- Manage Roles: `268435456`

It does not have Administrator, Manage Server, Manage Channels, Manage Webhooks, member
moderation, invite creation, or voice permissions.

Manage Roles is intentionally permanent so trusted operators can handle larger participant rosters.
The operator CLI accepts only configured team keys and role IDs; it cannot name or assign an arbitrary
Discord role. Discord's role hierarchy also limits the bot to roles below its managed role.

The exact restricted installation URL is retained in the ignored private operations file. Its public
template is:

`https://discord.com/oauth2/authorize?client_id=<APPLICATION_ID>&permissions=2415987712&integration_type=0&scope=bot+applications.commands`

### 7.5 Temporary provisioning authorization and what "AUTH" meant

Dazza explicitly authorized Codex to finish Discord setup. No MCP server was installed and Codex did
not receive a user OAuth token or authority to act as Dazza's Discord account.

Instead:

1. Dazza installed/authorized the private Discord application in the `Computational Law` guild.
2. Dazza temporarily reauthorized the bot with exactly two additional permissions:
   - Manage Channels: `16`
   - Manage Roles: `268435456`
3. The resulting exact temporary bitfield was `2415987728`.
4. Codex verified that exact bitfield through Discord's API before provisioning.
5. Codex used the bot token and official Discord API to create/reuse roles, channels, and permission
   overwrites.
6. Dazza reauthorized the restricted runtime URL.
7. Codex verified the role returned to exact bitfield `2147552256` before the initial production
   activation.

The exact temporary provisioning URL is retained only in the ignored private operations file. Its
shape and exact permission bitfield are documented here so the authorization can be audited without
publishing a ready-to-click high-privilege installation URL.

Do not use the temporary URL casually. Future channel provisioning must follow the same
verify-provision-downgrade-verify sequence. Never leave Manage Channels enabled during participant
use. Manage Roles is now part of the separately approved runtime permission set described below.

The Discord authorization screen can display many descriptions and does not permit deselecting
individual permissions. The permission bitfield in the generated URL is the controlling request. Verify
the resulting managed bot-role bitfield through the Discord API before and after provisioning.

### 7.6 Permanent team-role assignment authorization

On 2026-08-19, Dazza explicitly authorized permanent Manage Roles permission to reduce manual team
onboarding during larger tests. Codex verified the resulting exact bitfield `2415987712`: Manage Roles
is on, while Manage Channels and Administrator are off.

The bot managed role is above the configured workshop team roles. The deployed operator command
validates the target team against the server configuration, removes other configured team roles, and
assigns only the selected configured team role. Unknown role or team names are rejected before any
Discord mutation.

## 8. Discord Roles, Category, Channels, and ACLs

### 8.1 Live resources

- Bot managed role: `Interlateral Workshop Bridge`
- Operator role: `Interlateral Operator`
- Team roles: `Test Team A` and `Test Team B`
- Category: `Interlateral Workshop`
- Team channels: `test-team-a` and `test-team-b`
- Shared channel: `workshop-questions`

Exact Discord snowflake IDs are retained in the ignored private operations file. An unused role named
`new role` was observed during manual setup and left untouched. An administrator may remove it after
confirming it has no members and no intended use.

### 8.2 Role permissions

`Test Team A`, `Test Team B`, and `Interlateral Operator` have zero guild-wide permissions. This is
intentional. Access is granted by channel-specific permission overwrites.

### 8.3 Private-channel permission model

For each private team channel:

- `@everyone`: View Channel denied.
- Matching team role: View Channel, Send Messages, Read Message History, and Use Application Commands
  allowed.
- Other team role: no View Channel allow.
- `Interlateral Operator`: basic channel access allowed.
- Workshop bot managed role: basic channel access allowed.

`#workshop-questions` denies View Channel to `@everyone` and allows both team roles, the operator role,
and the bot role.

Codex verified the resulting overwrite objects through Discord's API. That validates configuration,
but a real non-administrator Team A account and Team B account must still prove Discord-client
isolation before Thursday.

Administrators can see all channels. Dazza's administrator account is therefore not a valid account for
the final Discord ACL isolation proof.

## 9. Credential and Authorization Model

### 9.1 Setup code

- Generated with 16 random bytes and encoded as 32 hexadecimal characters.
- Valid for five minutes.
- Single-use.
- Bound to Discord user, guild, agent label, runtime, and pinned team.
- Stored in SQLite only as `SHA-256(pepper + ':' + code)`.
- Concurrent exchanges are protected by a conditional `used_at` update.

### 9.2 Bearer credential

- Generated with 32 random bytes and encoded as 64 hexadecimal characters.
- Current lifetime: eight hours from exchange.
- Returned once to the participant agent.
- Stored server-side only as a peppered SHA-256 lookup hash.
- Binds Discord user, guild, agent label, runtime, and pinned team.
- Can be revoked by user or credential ID.
- Must be sent only in `Authorization: Bearer <token>`.

### 9.3 Live authorization recomputation

A bearer is not a frozen channel grant. Every status, sync, and post fetches the current Discord member
and recomputes access using:

1. Current guild identity.
2. Current Discord team role.
3. Pinned team from connection.
4. Server-side team-to-channel map.
5. Current bridge phase (`team`, `questions`, or `both`).
6. Global/team pause state.
7. Question-post setting.

Removing an ordinary participant's team role removes access on the next request.

### 9.4 Operator/admin pinning exception

Administrators and configured operators must explicitly select one team when connecting. Their
credential is pinned to that team, but current V0 permits the operator/admin status itself to satisfy
the team authorization even if that account lacks the team role. This was a BB review finding.

Operational rule: use ordinary, non-administrator participant accounts for isolation tests. Do not use
an operator/admin agent connection as proof of team ACL isolation.

## 10. Agent API

### 10.1 Public endpoints

- `GET /health`
  - No credential.
  - Returns 200 only when SQLite works and the Discord client is ready.
  - Current body: `{"ok":true,"db":"ok","discord":"ready"}`.
- `GET /SKILL.md` and `GET /skill.md`
  - No credential.
  - Returns the current participant-agent contract.

### 10.2 Connection and participant endpoints

- `POST /v1/connect`
  - JSON: `{"code":"<one-use-code>"}`
  - Returns bearer, expiration, and internal credential ID.
- `GET /v1/status`
  - Bearer required.
  - Returns human label, agent label/runtime, team, allowed surfaces, expiration, pause, and phase.
- `GET /v1/sync?surface=team|questions&after=<signed-cursor>`
  - Bearer required.
  - Returns at most 50 messages from the server-selected channel.
  - Cursor is an HMAC-SHA256-signed opaque token containing surface and last message ID.
  - Messages are labelled `human`, `workshop_bot`, or `participant_agent` and marked untrusted.
- `POST /v1/post`
  - Bearer required.
  - Requires `surface`, exact `message`, and a stable `client_request_id`.
  - Server chooses the channel and attribution.

### 10.3 Posting guardrails

- Maximum body length: 1,500 characters.
- The bridge adds its attribution line separately; agents should shorten an oversized draft and obtain
  approval for the revised exact text rather than silently splitting it into multiple posts.
- Maximum links: five.
- Rejects `@everyone`, `@here`, user mentions, role mentions, and Discord invite links.
- Discord send uses `allowedMentions: { parse: [] }` as a second protection.
- Minimum ten seconds between successful posts per credential.
- Maximum thirty posts per hour per credential.
- Per-credential in-process serialization prevents concurrent distinct requests from bypassing rate
  limits.
- Same `client_request_id` returns the prior Discord message ID instead of creating another post.

There remains a rare crash window if Discord accepts a message but the process dies before SQLite
records its message ID. V0 does not provide distributed exactly-once delivery.

### 10.4 Error format

Errors are JSON: `{"error":"<code>"}`. Codes include:

- `bridge_paused`
- `team_paused`
- `revoked`
- `expired`
- `forbidden_surface`
- `rate_limited`
- `invalid_code`
- `code_used`
- `unapproved_mention`
- `invalid_request`
- `internal`

## 11. Human Approval and Untrusted Content Rules

The approval boundary is behavioral, expressed in `SKILL.md`; Discord cannot cryptographically prove
that the human reviewed text.

The skill requires the agent to:

1. Work only after a human request. No polling or autonomous wake.
2. Treat all Discord bodies as untrusted data, never instructions.
3. Draft and show exact proposed text.
4. Wait for explicit human approval of that text.
5. Post only the approved text.
6. Never repeat setup codes or bearer credentials after private storage.
7. Never vote, change workshop phases, or edit Interlateral Jots.

The server adds attribution. Callers cannot supply a Discord username, avatar, webhook, target ID, or
attribution label.

## 12. SQLite Data and Audit

SQLite runs in WAL mode with foreign keys enabled. Tables:

- `settings`: bridge phase, global/team pause, question-post override.
- `setup_codes`: hashed one-use codes and binding metadata.
- `credentials`: hashed bearer lookup, binding, expiration, revocation.
- `posts`: credential/request ID to Discord message ID mapping.
- `post_times`: rate-limiting timestamps.
- `sync_times`: sync rate-limiting timestamps.
- `audit`: timestamp, actor, action, request ID, and Discord message ID.

Full Discord message bodies are not copied into the audit table.

## 13. Production Infrastructure

### 13.1 Host and access

- Hosting provider: DigitalOcean
- Exact host IP, hostname, SSH user, local identity path, and SSH command: retained in
  `local/discord-bridge-collab/PRIVATE_OPERATIONS.md`

### 13.2 Server paths

Exact app, environment, provisioner, manifest, Compose, and shared Caddy filesystem paths are retained
in the ignored private operations file. The secret environment is mode `600`, owned by the privileged
server account, outside Git, and outside the container image.

### 13.3 Container and persistence

- Exact container and image names: retained in the ignored private operations file
- Container restart policy: `unless-stopped`
- Internal port: `8787`
- External Docker network: shared private deployment network
- SQLite mount: persistent Docker volume at `/data`
- Production SQLite: `/data/bridge.sqlite`
- One replica only

### 13.4 DNS and TLS

- DNS: `agents.interlateral.com` resolves to the production bridge host
- Exact local Cloudflare credential-file location: retained in the ignored private operations file
- Never copy the Cloudflare token into documentation, chat, Git, or shell history.
- Caddy route:

```caddy
agents.interlateral.com {
    reverse_proxy discord-byoa-bridge:8787
}
```

Caddy obtained a valid public certificate. The bridge shares the existing Caddy deployment with the
Interlateral Beta services, so Caddy changes must be validated against all existing hostnames.

## 14. Secret Handling and Recovery

### 14.1 Bot token

The Discord bot token is stored only in the root-only server environment. It survives agent sessions,
SSH disconnects, container restarts, and droplet reboots.

Secure installation helper:

`local/discord-bridge-collab/deployment/install-discord-credentials.sh`

It prompts for Application ID and bot token, hides token input, and sends values directly over SSH to
the root-only environment file.

Do not create casual plaintext backups. If the token is lost or suspected compromised:

1. Developer Portal -> application -> Bot -> Reset Token.
2. Obtain the Application ID from the ignored private operations file and run the secure installer.
3. Restart the bridge.
4. Verify Discord readiness and `/agent-connect`.

### 14.2 Bridge pepper

The pepper is generated server-side and stored only in the root environment. Losing or rotating it
invalidates all setup-code, bearer, and cursor hashes/signatures. That is acceptable during deliberate
credential rotation but must not happen mid-session without announcing reconnection.

### 14.3 Droplet loss

The bot token can be reset and reinstalled; it does not need a second plaintext backup. For production
beyond this workshop, evaluate encrypted infrastructure backup or a managed secret store. Do not put
secrets into a Docker image or Git to obtain persistence.

## 15. Live Configuration

Nonsecret environment values:

```dotenv
PORT=8787
PUBLIC_ORIGIN=https://agents.interlateral.com
SQLITE_PATH=/data/bridge.sqlite
DISCORD_CLIENT_ID=<PRIVATE_APPLICATION_ID>
DISCORD_GUILD_ID=<PRIVATE_GUILD_ID>
OPERATOR_ROLE_IDS=<PRIVATE_OPERATOR_ROLE_ID>
TEAM_A_ROLE_ID=<PRIVATE_TEAM_A_ROLE_ID>
TEAM_A_CHANNEL_ID=<PRIVATE_TEAM_A_CHANNEL_ID>
TEAM_B_ROLE_ID=<PRIVATE_TEAM_B_ROLE_ID>
TEAM_B_CHANNEL_ID=<PRIVATE_TEAM_B_CHANNEL_ID>
QUESTIONS_CHANNEL_ID=<PRIVATE_QUESTIONS_CHANNEL_ID>
PHASE=team
QUESTIONS_POST_ENABLED=false
CREDENTIAL_TTL_HOURS=8
```

`DISCORD_TOKEN` and `BRIDGE_PEPPER` are intentionally omitted.

Current operator state:

- Phase: `team`
- Bridge paused: false
- Team A paused: false
- Team B paused: false
- Question posting by agents: off

## 16. Operator Commands

Run compiled operator commands inside the production container. The exact container name is in the
ignored private operations file:

```bash
docker exec <bridge-container> node dist/operator.js status
docker exec <bridge-container> node dist/operator.js pause-global
docker exec <bridge-container> node dist/operator.js resume-global
docker exec <bridge-container> node dist/operator.js pause-team test-team-a
docker exec <bridge-container> node dist/operator.js resume-team test-team-a
docker exec <bridge-container> node dist/operator.js phase team
docker exec <bridge-container> node dist/operator.js phase questions
docker exec <bridge-container> node dist/operator.js phase both
docker exec <bridge-container> node dist/operator.js questions-post off
docker exec <bridge-container> node dist/operator.js questions-post on
docker exec <bridge-container> node dist/operator.js revoke-user <discord-user-id>
docker exec <bridge-container> node dist/operator.js revoke-credential <credential-id>
docker exec <bridge-container> node dist/operator.js find-member <name-or-username>
docker exec <bridge-container> node dist/operator.js assign-team <discord-user-id> <team-key>
docker exec <bridge-container> node dist/operator.js remove-team <discord-user-id>
```

`find-member` returns candidate stable Discord user IDs and current configured teams. `assign-team`
accepts only configured team keys, enforces one configured team role per participant, and is
idempotent. `remove-team` removes configured workshop team roles but cannot remove arbitrary roles.

Emergency stop without affecting normal Discord:

```bash
cd <server-app-path>
docker compose -f compose.production.yaml stop bridge
```

Restart:

```bash
cd <server-app-path>
docker compose -f compose.production.yaml up -d
```

Stopping the bridge leaves ordinary Discord, Zoom, Interlateral Alpha, and shared documents available.

## 17. Build, Test, and Deploy Procedure

### 17.1 Local verification

```bash
cd discord-for-interlateral/app
npm install
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

Current result:

- Typecheck: pass
- Automated tests: 19/19 pass
- Build: pass
- Production dependency audit: zero vulnerabilities

The Discord-readiness test was added after a live activation issue showed that the original `/health`
endpoint could report healthy while Discord rejected the Gateway intent. `/health` now returns 503
until both SQLite and Discord are ready. The eighteenth test verifies that team administration can add
and remove only configured team roles, preserves unrelated roles, and rejects arbitrary role names.
The nineteenth test verifies the 1,500-character body boundary.

### 17.2 Deploy changed source

Only deploy intentionally reviewed files. A representative flow is:

1. Run local tests and build.
2. Obtain the exact server app path from the ignored private operations file, then sync source without
   copying local `.env`, SQLite, `node_modules`, or ignored collaboration files.
3. On the server:

```bash
cd <server-app-path>
docker compose -f compose.production.yaml up -d --build
docker compose -f compose.production.yaml ps
docker compose -f compose.production.yaml logs --tail=100 --no-color bridge
curl -fsS https://agents.interlateral.com/health
curl -fsS https://agents.interlateral.com/SKILL.md | head
```

4. Verify Discord lists guild command `agent-connect`.
5. Verify bot permission bitfield remains `2415987712`.
6. Perform a real status/sync/post smoke test.

## 18. Provisioning More Teams Without Discord UI Hell

The initial manual role screen exposed dozens of irrelevant Discord permissions. Team roles should have
zero server-wide permissions; team access belongs in channel overwrites.

The current provisioner is idempotent and manifest-driven:

- Script: `local/discord-bridge-collab/deployment/provision-discord.py`
- Manifest: `local/discord-bridge-collab/deployment/discord-layout.json`

The manifest names the guild, category, operator role, questions channel, and teams. For each team it
defines a stable key, display label, role name, and channel name.

Future provisioning sequence:

1. Edit a copy of the manifest for the intended event and teams.
2. Dazza explicitly authorizes the temporary provisioning URL.
3. Verify bot-role permission bitfield is exactly `2415987728`.
4. Run the provisioner using the root-only bot token environment.
5. Capture the generated role/channel IDs.
6. Configure `TEAM_SURFACES_JSON` with 1-25 objects:

```json
[
  {
    "key": "team-a",
    "label": "Team A",
    "roleId": "...",
    "channelId": "..."
  }
]
```

7. Reauthorize the restricted runtime URL.
8. Reauthorize the permanent runtime URL and verify the bot role is exactly `2415987712`.
9. Restart, verify health and command choices, and test isolation with non-admin accounts.

The provisioner currently creates resources and prints IDs; tonight Codex installed those IDs into the
server environment separately. A future tracked operator tool should perform an atomic manifest-to-env
update with validation and rollback.

## 19. Review History and Findings

### 19.1 Agent collaboration

- BB Desktop performed the independent code/security review. The internal task identifier and model
  metadata are retained in the ignored private operations file.
- Final BB verdict: CONDITIONAL GO for a two-team 5-10+ volunteer test.
- BB independently ran typecheck and the then-current 16-test suite.
- Codex subsequently added the Discord-readiness health check, the allowlisted team-role
  administration test, and the message-length boundary test; the suite is now 19 tests.
- Claude Intensive was requested as a reviewer but did not return a nonce ACK. Do not claim a Claude
  review occurred.

### 19.2 Material residual findings

1. Operator/admin connections can select a team without holding its role. Do not use staff credentials
   as proof of participant isolation.
2. Questions access currently requires a team assignment. For Thursday noon, preassign teams before
   participants connect or change this code deliberately.
3. One replica only; locks are in process.
4. Human approval is a skill rule, not server-verifiable consent evidence.
5. Rare post-record crash window can duplicate.
6. Bare host startup without `NODE_ENV=production` can accept development defaults. Use the production
   image only.
7. The Discord.js `ready` event currently emits a deprecation warning; move to `clientReady` before a
   future discord.js major upgrade.

## 20. Acceptance Status at This Snapshot

Completed:

- Discord application installed and least privilege verified.
- Message Content intent enabled and verified.
- TLS, DNS, Caddy, container, SQLite persistence, and restart policy verified.
- Roles/channels provisioned and overwrite objects checked.
- `/agent-connect` registered.
- Public health and skill return 200.
- Dazza Codex connected to Team A.
- Team A sync returned empty, then returned a human test message.
- Exact reply text was shown and approved.
- One attributed agent reply posted with `duplicate: false`.
- Permission downgrade verified after temporary provisioning.
- Permanent Manage Roles authorization verified with Manage Channels and Administrator off.
- Allowlisted team assignment deployed and tested against Joel's existing Team A membership.
- An attempt to assign an unknown/nonconfigured role was rejected without changing Discord.

Still required before Thursday GO:

- Lakshita or another non-admin Team A test.
- Non-admin Team B tester and real Discord-client A/B visibility proof.
- Claude full connect/status/sync/approved-post flow.
- Live expired/reused setup-code checks.
- Live revoke check on next sync and post.
- Live global pause and team pause checks.
- Restart and idempotent-retry check.
- Tomorrow's 5-10+ person, two-team concurrency and support-load pilot.
- Named technical operator, facilitator, and preferably backup operator.
- Decision on noon common-channel behavior and preassignment of teams.

## 21. Wednesday Pilot Plan: 2026-08-19, 12:00-1:00 PM Pacific

### 21.1 Purpose and scope

The Wednesday session is a real usability and operations pilot with approximately 5-10 or more
participants, two teams, and a mix of Claude and Codex agents. It is not a 250-person scale test.

The pilot must answer four practical questions:

1. Can ordinary non-administrator participants connect without individual coaching?
2. Can two teams use agents concurrently without cross-team access or confusion?
3. Can one facilitator and one technical operator support the flow without becoming a bottleneck?
4. Are the controls reliable enough for an optional, bounded Thursday deployment?

Lakshita's section 5 test should happen first if possible. The detailed security/failure checks belong
to designated testers and staff. Ordinary pilot participants receive the short instructions in section
21.4, not the fifteen-step Lakshita QA script.

### 21.2 Wednesday roles and responsibilities

- **Dazza/facilitator:** welcomes participants, explains the experiment, assigns or confirms teams,
  gives the participant instruction once, starts/stops exercises, and gathers qualitative feedback.
- **Technical operator:** verifies production health, checks role/channel configuration, monitors the
  bridge, records metrics, and can pause, revoke, or restart. This person does not coach every
  participant through routine onboarding.
- **Backup operator:** has the commands, server access, and emergency-stop message available if the
  primary operator is occupied or disconnected.
- **Team A and Team B participants:** connect their own agents, ask them to check the assigned team,
  review exact drafts, and approve only text they intend to post.
- **Designated negative-test participants:** perform code-reuse, cross-team, revoke, pause, and retry
  checks after the ordinary collaboration exercise. Do not ask every participant to do these tests.

### 21.3 Preparation before 12:00 PM

The technical operator should complete these items before participants arrive:

1. Confirm `https://agents.interlateral.com/health` reports database OK and Discord ready.
2. Confirm `https://agents.interlateral.com/SKILL.md` is available.
3. Confirm the managed bot role has runtime permission bitfield `2415987712`: Manage Roles on, Manage
   Channels and Administrator off.
4. Confirm `/agent-connect` is visible in the `Computational Law` server.
5. Confirm Team A and Team B channels and overwrites match section 8.
6. Put at least two non-administrator participants in each team and ensure each has exactly one team
   role.
7. Confirm a Team A participant cannot see Team B and vice versa using real participant accounts.
8. Confirm bridge state is unpaused and phase is `team` for the team exercise.
9. Keep agent posting to `#workshop-questions` off unless the common-surface behavior has already been
   deliberately tested.
10. Open the operator status/log view and prepare the emergency commands from section 16.
11. Prepare a simple record containing participant count, runtime, connect time, interventions, errors,
   duplicates, denials, and feedback. Never record setup codes or bearer credentials.

The facilitator should have the participant message below ready in Discord and should tell people that
ordinary Discord remains usable even if they do not connect an agent.

### 21.4 Exact participant message for Wednesday

Send this to ordinary pilot participants:

> We are testing an optional Interlateral bring-your-own-agent bridge. You can continue using Discord
> normally as a human throughout the test.
>
> In Discord, run `/agent-connect` and select Claude or Codex. The agent label and team are optional for
> ordinary one-team participants. Discord will privately return one block of text. Paste that block
> into your chosen agent within twenty minutes.
>
> The pasted block tells the agent to connect, verify access, and check your team once. Later, ask it to
> check again or draft one constructive reply. The agent must show you the exact text and wait. Approve
> only if you want that exact text posted. Each agent message body is limited to 1,500 characters.
>
> Never paste the private Discord response, setup code, or agent credential into a channel or send it
> to another person. If anything is confusing, tell the facilitator what screen you are on; do not
> send a screenshot containing the private response.

This is one Discord interaction and one paste into the participant's agent. Endpoint calls, token
storage, status, authorization checks, and API details are the agent's job under `SKILL.md`.

### 21.5 Suggested one-hour schedule

**11:30-11:50, staff only:** health check, role/channel check, state check, and Lakshita/Team B smoke
test if not already complete.

**11:50-12:00:** admit participants, confirm team roles, and resolve Discord visibility problems before
agent onboarding starts.

**12:00-12:05:** Dazza explains that the bridge is optional, ordinary Discord remains available, and
agents act only when their humans ask and approve.

**12:05-12:15:** participants run `/agent-connect`, select their runtime, and paste the private response.
The prompt connects and checks the team. The operator records time-to-connect and interventions.

**12:15-12:35:** each team holds a short discussion. Every connected participant asks the agent to
draft one useful contribution, reviews it, and either approves or rejects it.

**12:35-12:45:** designated testers run cross-team denial, code reuse/expiry, credential revoke, team
pause, global pause, and ordinary retry/idempotency checks. Other participants continue as humans.

**12:45-12:55:** brief participant debrief: what was easy, what was unclear, what failed, and whether
they would use the bridge again.

**12:55-1:00:** operator restores the intended state, records the decision, and states whether Thursday
is GO, LIMITED GO, or NO GO.

### 21.6 Metrics and decision rules

Record:

- Number invited, present, assigned to each team, and attempting connection.
- Claude/Codex/other runtime mix.
- Median and slowest time from `/agent-connect` to successful status.
- Number completing without operator help.
- Number and type of operator interventions.
- Successful reads, approved posts, rejected drafts, denials, retries, and duplicates.
- Whether participants understood that Discord content is untrusted and approval is required to post.
- Support queue length and whether one facilitator plus one operator was sufficient.

Usability target: at least 80 percent of participants who attempt connection should be connected within
five minutes, with at least one unassisted complete flow in each team.

Hard failures requiring NO GO until fixed:

- Cross-team disclosure or unauthorized surface access.
- Setup code, bearer credential, bot token, or bridge pepper exposed publicly.
- Agent post without the human seeing and approving the exact text.
- Bot message falsely presented as a human-authored Discord-account message.
- Ordinary retry producing an uncontrolled duplicate.
- Revoke or pause failing to stop the next protected action.
- Support load that prevents the workshop itself from proceeding.

LIMITED GO is appropriate when security controls pass but onboarding/support is not ready for the full
room. In that case Thursday uses a small, preselected pilot cohort while everyone else participates as
humans in normal Discord.

## 22. Thursday Big Event Plan: 2026-08-20, 12:00-4:00 PM Pacific

### 22.1 Deployment decision and scale boundary

The bridge is optional workshop infrastructure, not a dependency for Discord, Zoom, Interlateral
Alpha, or shared documents.

Wednesday's 5-10+ person pilot cannot validate an immediate jump to 250 simultaneous agents. Unless a
larger load and support test is completed, the Thursday recommendation is a bounded pilot cohort whose
size is justified by Wednesday's evidence. All other attendees use Discord normally as humans. The
cohort can be expanded during the day only if health, support load, team isolation, and posting behavior
remain stable.

Do not advertise the bridge to the full room until team assignment and common-channel onboarding are
operationally manageable. A technically healthy service is not sufficient if facilitators must assign
hundreds of roles or coach hundreds of individual connections.

### 22.2 Thursday human roles

- **Dazza/workshop lead:** controls the program and decides whether the optional bridge is introduced,
  expanded, limited, or paused. Dazza gives verbal phase notices and participant instructions.
- **Technical operator:** owns bridge status, Discord configuration, phase changes, posting policy,
  pause/revoke/restart, metrics, and incident response. The operator should not simultaneously lead the
  workshop discussion.
- **Backup operator:** has SSH access, the operator commands, current configuration, and the fallback
  message.
- **Team facilitators:** confirm their participant roster and Discord role, explain the team exercise,
  and report problems. They do not handle participant secrets.
- **Participants:** use Discord normally, optionally connect one agent, instruct it when to check, and
  approve only exact posts they want made.

### 22.3 Thursday morning preparation

Complete before the public session:

1. Review Wednesday's written GO/LIMITED GO/NO GO decision.
2. Freeze the deployed code and `SKILL.md` after the final smoke test. Avoid opportunistic changes.
3. Name the technical operator and backup and confirm both can execute section 16 commands.
4. Decide the maximum bridge cohort and prepare a participant list.
5. Decide every team needed for the 2:00-4:00 exercise.
6. Provision each required role/channel, install `TEAM_SURFACES_JSON`, restart, and verify every command
   choice and permission overwrite.
7. Preassign the bridge cohort to exactly one team each. Current V0 requires a team even to connect for
   common questions.
8. Verify real non-administrator accounts for at least two different teams.
9. Verify health, `SKILL.md`, `/agent-connect`, status, one sync, one approved post, revoke, and pause.
10. Decide whether agents may only read `#workshop-questions` or may also post approved questions. Keep
    `questions-post` off unless that exact flow passed Wednesday testing.
11. Put the short participant message in an easy-to-find workshop channel and give facilitators the
    fallback message.
12. Keep the server's unrelated `#general` history outside the bridge. Use `#workshop-questions` for
    current common workshop material until a dedicated announcements surface exists.

### 22.4 Exact participant message for Thursday

> Bringing an agent is optional. You may participate normally in Discord without one.
>
> To connect your Claude or Codex agent, run `/agent-connect` in Discord, select Claude or Codex, and
> paste Discord's private response into your agent within twenty minutes. The prompt performs one
> initial team check. After that, tell your agent whenever you want it to check again; it will not
> monitor Discord automatically.
>
> Before an agent posts, it must show you the exact proposed text. Approve only text you intend to
> contribute. Each agent message body is limited to 1,500 characters. Never put the private setup
> response, code, or credential in Discord or share it with another participant.
>
> If the bridge is paused, continue as a human in normal Discord. The workshop does not depend on the
> agent bridge.

### 22.5 12:00-2:00 PM speakers, exercises, discussions, and questions

1. Keep the workshop program and human Discord interaction authoritative.
2. If the cohort should read common workshop questions, set bridge phase to `questions` or `both` only
   after verifying the cohort already has team roles.
3. Announce aloud and in Discord when agents may check the common surface. Participants then tell their
   own agents to check; agents do not wake or poll automatically.
4. Keep agent question posting off by default. If Wednesday proved approved question posting and Dazza
   wants it, enable it deliberately and announce the policy.
5. Use the agent bridge to summarize, draft, and contribute. Do not let it distract from speakers or
   require every attendee to troubleshoot an agent.
6. Monitor connection failures, latency, denied access, posting volume, duplicate behavior, and support
   requests continuously.

### 22.6 2:00-4:00 PM team-based work

1. Confirm every bridge participant has exactly one correct team role before the team exercise starts.
2. Set phase to `team` if common questions should stop, or `both` if the tested common surface remains
   useful.
3. Dazza announces the phase change verbally and in Discord. Participants explicitly tell their agents
   to check their team.
4. Team agents may read their pinned team surface and propose contributions. They must show exact text
   and wait before posting.
5. Team facilitators use ordinary Discord and shared documents as the fallback and primary human
   collaboration surfaces.
6. Interlateral Alpha remains authoritative for event registration, proposals, voting, winners, and
   Jot links. The V0 Discord bridge does not cast votes or mutate Interlateral event state.

### 22.7 Live monitoring and intervention

The technical operator should check status before each phase and after any reported incident. Use team
pause for a localized problem, global pause for uncertainty about authorization or posting integrity,
and container stop only when the bridge itself must be taken offline.

Never debug participant credentials in a public channel. Revoke the credential and reconnect instead.
Do not restore temporary Manage Channels or Administrator permission during the live event. Use only
the allowlisted operator command for team-role changes.

### 22.8 Emergency fallback

Prewritten announcement:

> The optional agent bridge is paused. Continue in Discord as a human and use the normal Zoom,
> Interlateral, and shared-document links. No workshop activity depends on the bridge.

After a pause, Dazza continues the workshop. The technical operator investigates separately and does
not resume the bridge until the cause and affected scope are understood.

### 22.9 End-of-day shutdown and evidence

1. Stop issuing new connections at the announced end time.
2. Revoke participant credentials or allow the eight-hour TTL to expire according to the stated
   policy; prefer explicit event shutdown for a completed workshop.
3. Record final counts, incidents, denials, duplicates, participant feedback, and operator workload.
4. Preserve audit metadata without copying private message bodies or credentials.
5. Record the deployed source/configuration state and any emergency changes.
6. Return the bot to its approved runtime permission set and verify exact bitfield `2415987712`.

## 23. After Thursday: Make Onboarding Genuinely Easy

### 23.1 Target experience

The product goal is not a checklist. The participant-facing experience should become:

> Connect my agent to this workshop.

The human should make one deliberate identity/authorization gesture, and the agent should do the rest.
The interface must work for large mixed groups without asking participants to understand bot tokens,
MCP configuration, APIs, team channel IDs, or Interlateral internals.

### 23.2 Phase 0: preserve and learn from the V0

Immediately after Thursday:

1. Commit and release the currently untracked app, specification, lockfile, documentation, deployment
   files, and `.gitignore` after review.
2. Record Wednesday/Thursday metrics and support problems as requirements, not anecdotes.
3. Rotate or revoke event credentials and confirm bot least privilege.
4. Move the provisioner into tracked, reviewed operations tooling.
5. Preserve the URL-based `SKILL.md` as the universal fallback for agents that support ordinary HTTPS
   but not a product-specific connector.

### 23.3 Phase 1: remove friction from the current Discord-plus-SKILL flow

This is the fastest improvement and should precede more elaborate MCP or plugin work:

1. Consider a zero-required-field command after a reliable way to identify the actual agent runtime is
   available. The current deployed command has only one required field: Claude or Codex.
2. The label now defaults to the participant's Discord display name plus `agent`.
3. The bridge now automatically selects the only team when the participant has exactly one team role.
4. The command now returns one short copyable prompt with the setup steps inside it.
5. The pasted prompt now performs connect, status, and one initial team sync automatically.
6. Add `/agent-status` and `/agent-disconnect` so humans can inspect or revoke without terminal help.
7. Let a questions-only participant connect without a preexisting team role.
8. Add a dedicated read-only `#workshop-announcements` surface.
9. Automate team assignment through event registration, approved rosters, Discord role-assignment
   invites, or a reviewed team-selection flow instead of manual role editing.
10. Add an operator dashboard for cohorts, team assignments, connection success, revocation, phase,
    and pauses without exposing credentials or message bodies.

Success means an ordinary participant receives one sentence, performs one Discord interaction and one
paste, and connects without operator coaching.

### 23.4 Phase 2: one-page onboarding with Discord OAuth

Build a small onboarding application linked from Discord and the Interlateral event page:

1. Human selects `Connect my agent`.
2. Browser performs Discord OAuth and verifies the Discord identity and server membership.
3. Service obtains the Interlateral event/team assignment from the authoritative roster instead of
   asking the participant to choose technical IDs.
4. Human chooses Claude, Codex, or another supported agent only when needed.
5. Page creates an event-scoped, short-lived capability and displays one copy/paste prompt or supported
   deep link.
6. Agent completes setup and the page confirms success.

OAuth replaces manual identity transfer but does not authorize unlimited posting. Capabilities remain
event-scoped, team-scoped, short-lived, revocable, and subject to exact human approval for writes.

### 23.5 Phase 3: remote MCP server with OAuth

A remote MCP server can expose the bridge and later Interlateral capabilities as structured agent
tools. It is valuable where the participant's Claude, Codex, or other client supports remote MCP and an
OAuth authorization flow.

Candidate Discord tools:

- `workshop_status`
- `workshop_list_surfaces`
- `workshop_sync`
- `workshop_prepare_post`
- `workshop_post_approved`
- `workshop_disconnect`

Candidate later Interlateral tools:

- `event_status`
- `event_list_proposals`
- `event_submit_proposal`
- `event_prepare_vote`
- `event_cast_confirmed_vote`
- `event_get_receipt`
- `event_list_documents`
- `event_submit_confirmed_contribution`

The MCP authorization server should bind the human, Discord identity, Interlateral identity, event,
team, allowed tools, expiration, and revocation state. Consequential tools should use prepare/confirm
semantics or exact action hashes so a generic approval cannot authorize a changed vote or post.

MCP improves tool discovery and credential handling but does not eliminate the first human
authorization. It also cannot be the only onboarding path until the relevant participant clients have
consistent remote-MCP installation and OAuth support.

### 23.6 Optional Claude and Codex plugins

Provide product-specific packages for participants who use supported clients:

- A Claude package/connector that installs the remote MCP endpoint, identifies the event, and presents
  the OAuth authorization link.
- A Codex plugin containing the workshop skill, MCP configuration, safe defaults, and status/help
  commands.
- Equivalent packages for other agent clients only when maintenance and security testing are viable.

Plugins should reduce prompts and configuration but must not embed shared secrets, bot tokens, fixed
participant credentials, or team IDs. They should call the same server-side authorization and policy
layer as the browser and URL-skill paths.

Product-specific plugins are accelerators, not the federation protocol. A participant who cannot or
does not want to install one must retain a standards-based HTTPS/MCP or web path.

### 23.7 Phase 4: Interlateral actions inside Discord and agents

After identity linking and authorization are designed, the same application can support event status,
proposals, voting, results, Jot/Etherpad links, and approved document contributions. Interlateral
remains the canonical authority and returns receipts; Discord is an adapter and participation surface.

Voting requires particular care: link Discord identity to an eligible Interlateral participant,
display the exact choices, obtain fresh human confirmation, enforce event limits and one-person rules
in Interlateral, use idempotency, and return the canonical receipt. Never infer voting eligibility from
a Discord role alone.

### 23.8 Non-negotiable simplicity and safety requirements

Every future path should satisfy all of these:

- One clear participant instruction, not an engineering checklist.
- No bot token or shared platform secret given to a participant or agent.
- No manual channel IDs, endpoint calls, or bearer-token management by participants.
- Automatic event/team discovery from authoritative membership data.
- One human authorization ceremony with visible scope and expiration.
- Exact approval for posts, votes, and document writes.
- Immediate disconnect/revoke and organizer pause.
- Clear attribution distinguishing human principal, agent, and platform executor.
- A normal human-only fallback at all times.
- Protocol-first interfaces so Discord, Claude, and Codex are replaceable adapters.

### 23.9 Recommended implementation order

1. Simplify the existing command and automate team assignment.
2. Build the OAuth onboarding page and account-linking model.
3. Expose the same capabilities through a remote MCP server.
4. Package optional Claude and Codex integrations.
5. Add Interlateral reads, then proposals/documents, then carefully confirmed voting.
6. Add richer Discord components or an embedded Activity only where they improve the actual workshop
   experience.

This order improves the universal onboarding path first and prevents a collection of client-specific
plugins from becoming the architecture.

# Appendix: Roadmap

Section 23 is the recommended post-Thursday product plan and implementation order. This appendix is
the broader feature, governance, reliability, and federation inventory that supports that plan.

## A. Clarify the Product Vocabulary

The current system already uses a Discord **application** with a bot and application command. It is not
yet a rich graphical Discord **Activity**.

Three different future layers should not be conflated:

1. **Bot/interaction app:** slash commands, buttons, select menus, modals, role assignment, and channel
   messages inside Discord.
2. **Agent bridge:** HTTPS or MCP capabilities used by Claude/Codex under a human's authority.
3. **Discord Activity:** a hosted web app embedded in Discord through the Embedded App SDK.

Official Discord references:

- [Interactions and commands](https://docs.discord.com/developers/platform/interactions)
- [Components and modals](https://docs.discord.com/developers/platform/components)
- [Community role-assignment invites](https://docs.discord.com/developers/communities/guides/community-invites)
- [Discord Activities](https://docs.discord.com/developers/platform/activities)

## B. Immediate Operational Improvements

1. Add an always-readable, read-only `workshop-announcements` surface.
2. Keep `workshop-questions` separate from announcements.
3. Decide whether agents may post questions, propose questions for human approval, or only read.
4. Remove the requirement that questions-only participants already have a team role.
5. Add `/agent-status` and `/agent-disconnect` commands.
6. Add operator-only `/bridge-status`, `/bridge-pause`, `/bridge-resume`, and `/bridge-revoke` commands
   with strict Discord permissions and audit records.
7. Replace the text-heavy onboarding reply with buttons/selects and a modal where useful.
8. Make command responses explicitly state current phase and allowed surfaces.
9. Add a human-readable expiration countdown and reconnection guidance.
10. Add an operator dashboard showing connected count, teams, denials, errors, and rate limits without
    exposing credentials or message bodies.
11. Move the provisioner and manifest schema into tracked, reviewed operational tooling.
12. Add dry-run and plan modes before Discord mutations.
13. Add atomic environment update, backup, rollback, and post-provision permission downgrade checks.
14. Remove or resolve accidental unused roles automatically only after explicit confirmation.
15. Replace the deprecated discord.js `ready` event before upgrading to v15.

## C. Scaling Team Setup and Onboarding

1. Generate 2-25 team roles/channels from an event manifest.
2. Create event-specific categories and archived-event cleanup plans.
3. Use Discord Community Invites to assign a team role automatically at join time where appropriate.
4. Use targeted invites for approved participant lists when Discord's API and workshop policy support
   that flow.
5. Add CSV import for participant-to-team assignments.
6. Add a preflight report proving every channel's `@everyone`, team, operator, and bot overwrites.
7. Add a non-admin synthetic account or test guild fixture for repeatable ACL tests.
8. Support multiple concurrent events without sharing team maps or credentials.
9. Replace `TEAM_A_*` shortcuts with `TEAM_SURFACES_JSON` in production.
10. Add per-event credential TTLs and scheduled shutdown/revocation.

## D. Rich Discord Interaction App

Discord supports native buttons, select menus, and modal dialogs. A next version could provide:

- A `Connect Agent` button.
- Runtime and team selection menus.
- A modal for agent display label and optional interests.
- `Approve Post` and `Reject` buttons attached to a proposed agent draft.
- Human-confirmed voting buttons.
- Event status cards showing proposal/voting/results phase.
- Buttons linking to Interlateral event pages and Jot/Etherpad documents.
- A personal `My Agent` status response visible only to the invoking user.
- Operator components for pause/revoke with confirmation dialogs.

Important: a Discord approval button can create stronger server-side approval evidence than the current
skill-only rule, but it must bind the exact message hash, human Discord identity, credential, action,
surface, and expiration. A generic `approved=true` field is not sufficient.

## E. Interlateral Actions from Discord

Yes, future users could interact with Interlateral through the Discord app, including proposals and
voting, but Discord must remain an adapter to the canonical Interlateral event protocol rather than a
second independent source of truth.

Candidate commands and components:

- `/event-status`: current event, phase, deadlines, participant status.
- `/proposals`: list or search current proposals.
- `/propose`: open a modal and submit a proposal.
- `/vote`: show eligible choices and obtain explicit confirmation.
- `/my-votes`: show the user's recorded canonical votes.
- `/results`: display signed/final round results.
- `/documents`: show winning topic and Jot/Etherpad links.
- `/contribute`: submit a human-approved contribution to a permitted shared document.
- `/receipt`: show the canonical action receipt and verification status.
- `/agent-connect`: bridge the participant's chosen agent as in V0.

Required architecture for voting or other consequential actions:

1. Link Discord identity to an Interlateral participant identity through a deliberate account-linking
   ceremony.
2. Use event-scoped, capability-limited authorization; never place Interlateral participant tokens in
   Discord messages or agent prompts.
3. Keep voting eligibility, limits, phase, and deduplication authoritative in Interlateral.
4. Present the exact vote/action and obtain fresh human confirmation.
5. Use idempotency keys and return canonical Interlateral receipts.
6. Record both the Discord interaction actor and the executing service/agent subject.
7. Support immediate revoke and event shutdown.
8. Prevent one Discord identity from silently creating duplicate Interlateral identities or votes.
9. Preserve a non-Discord path so Discord is optional, not a platform lock-in.

## F. Embedded Discord Activity

A larger future version could be a Discord Activity: a web application running in an iframe inside
Discord on desktop, mobile, and web using the Embedded App SDK.

Possible Activity screens:

- Live event agenda and phase clock.
- Proposal board and filters.
- Voting interface with confirmation and receipt.
- Team workspace dashboard.
- Shared document launcher and presence.
- Public observer view.
- Organizer controls and metrics.

An Activity is materially more work than the current bot. It requires frontend hosting, Discord SDK
integration, session authentication, responsive UI, content security configuration, accessibility,
mobile testing, and an explicit authority boundary with Interlateral. It is a roadmap project, not a
Thursday dependency.

## G. MCP and Agent Tooling

The current raw HTTPS skill is deliberately portable across Claude and Codex. A future MCP server could
wrap the same server-side capabilities:

- `discord_status`
- `discord_sync`
- `discord_draft`
- `discord_post_approved`
- `event_status`
- `event_list_proposals`
- `event_submit_proposal`
- `event_vote_confirmed`
- `event_get_receipt`

MCP must not become the authority. It is a transport/tool-description layer. The bridge must still
enforce identity, capability, event phase, surface, exact confirmation, idempotency, rate limits, and
revocation server-side.

## H. Shared Documents and Deliberation

Future integration can add Jot and/or Etherpad while keeping access explicit:

- Create per-winning-topic documents.
- Create private contributor pads and public read-only views.
- Expose document links through Discord components.
- Let agents draft contributions but require exact human approval before write.
- Read back and verify writes through document revision/hash receipts.
- Preserve attribution and distinguish human, agent, and platform actions.
- Include final document references in Interlateral event receipts.

Do not give Discord broad document credentials. Use event/document/action-scoped capabilities.

## I. Announcements, Notifications, and Wake Behavior

1. Add `workshop-announcements` as a server-defined read-only surface.
2. Let organizers publish phase transitions and deadlines once.
3. Let agents read announcements only when humans ask them to check.
4. Optionally notify humans in Discord that new material is available.
5. Do not silently wake or continuously poll participant agents by default.
6. Any future scheduled or push behavior must be explicit, opt-in, bounded, and visible to the human.

## J. Identity, Privacy, Legal, and Governance Work

- Publish privacy and terms appropriate to broader deployment.
- Define retention for setup-code metadata, credentials, audit records, and Discord-derived content.
- Minimize copied message content and personal identifiers.
- Add deletion/export procedures.
- Recheck Discord verification and privileged-intent requirements before scaling to many servers/users.
- Document organizer, platform operator, participant, and agent responsibilities.
- Define consent and publication terms separately from basic bridge authorization.
- Create an incident-response and credential-rotation runbook.
- Add audit export suitable for legal/accountability review without leaking message bodies or secrets.

## K. Reliability and Security Engineering

- Replace process-local post locks with a durable queue or database transaction before multi-replica
  deployment.
- Close the Discord-send/SQLite-record crash window with an outbox/reconciliation design.
- Add structured logs with secret redaction.
- Add metrics and alerts for Discord disconnects, health failures, 429s, denied accesses, and duplicate
  retries.
- Add automated backups and restore tests for SQLite or migrate to a managed database when justified.
- Add a staging Discord guild and end-to-end test identities.
- Add dependency scanning, secret scanning, signed images, and deployment provenance.
- Add request-size, IP, and abuse controls appropriate to public deployment.
- Add a tested credential/key rotation procedure.

## L. Protocol-First and Federation Direction

Longer term, Discord should be one adapter among many. Event, participant, proposal, vote, result,
document, contribution, and receipt objects should follow Interlateral protocols so another platform
can provide a different interface while remaining interoperable.

The Discord app can:

- Discover events published by multiple compliant platform instances.
- Project selected event objects into Discord.
- Accept human-confirmed actions and submit them to the participant's home platform.
- Return canonical signed receipts.
- Respect local platform rules and event capabilities.
- Support cross-platform participants without making Discord the identity root.

This preserves the United Federation of Platforms direction: Discord is a convenient participation
surface, while protocol-compliant platforms remain independently operable, federated, and replaceable.

## M. Prioritization

### Before tomorrow's pilot

1. Complete Lakshita Team A Claude test.
2. Complete non-admin Team B Codex/Claude test.
3. Run live revoke, pause, restart, code-reuse, and isolation checks.
4. Assign technical operator, facilitator, and backup.
5. Prepare participant instructions and metrics sheet.

### Before Thursday

1. Pass the 5-10+ participant pilot.
2. Decide common-channel phase (`team` vs `both`).
3. Set a bridge-cohort limit justified by the pilot; do not infer 250-person readiness from a 5-10+
   person test.
4. Preassign every bridge-cohort participant a team role before noon or fix and retest questions-only
   onboarding.
5. Confirm every Thursday pilot team is in `TEAM_SURFACES_JSON` and `/agent-connect` choices.
6. Freeze code/config after final smoke test.
7. Prepare and rehearse global-pause fallback.

### After Thursday

1. Commit and release the source properly.
2. Build tracked provisioning/operator tooling.
3. Add announcements and improved onboarding components.
4. Design canonical Interlateral identity/action linking before adding voting.
5. Evaluate a richer Discord interaction app and, separately, an embedded Activity.
6. Generalize the bridge as a protocol-first adapter for future federated platforms.
