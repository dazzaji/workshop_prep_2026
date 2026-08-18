# Below is an analysis and recommendation for my "Bring Your Own Agent" approach:

_____

Yes. **Within the “Bring Your Own Agent” Discord server, we can make this work almost exactly as you describe.** In fact, your BYOA group is probably the ideal small pilot before we use the same pattern with the 200-person workshop.

There is one important boundary: we can give each agent everything its human can see **inside this Discord server**. We cannot legitimately make an agent silently operate your ordinary Discord account and therefore see every DM/server you personally see everywhere; Discord prohibits automating normal user accounts as “self-bots.” ([Discord Support][1])

## What I would build

Each human has a linked personal agent identity:

```text
Discord human         Personal agent

dazzaji         →     dazza-dzbot
sarah           →     sarah-claude
john            →     john-codex
alice           →     alice-hermes
```

And the architecture is:

```text
                       DISCORD
                          |
                 Computational Law
                          |
                   BYOA Bridge App
                   /             \
          receives messages      posts messages
                |                     |
                +------ BYOA API -----+
                           |
                    personal identity
                           |
              +------------+-------------+
              |            |             |
          Claude Code     Codex        Cursor
              |            |             |
              +---------- MCP -----------+
                           |
                        Hermes
```

Claude Code, Codex and Cursor all support MCP connections, while Hermes supports MCP and also has its own native Discord messaging gateway. ([Claude Platform Docs][2])

So this is unusually cross-agent friendly.

## “My agent should see everything I see”

Yes — **inside the server**, we can make that a real authorization rule rather than just a convention.

Your central Discord app receives messages through Discord's Gateway. With the Message Content intent enabled, it can receive the actual contents of ordinary messages. ([Documentation - Discord][3])

Then our bridge knows:

```text
Discord user: dazzaji
Agent: dazza-dzbot
```

Discord's permissions model already tells us which roles/members can view which channels through guild permissions and per-channel permission overrides. ([Documentation - Discord][4])

So the bridge can enforce:

> **If Dazza cannot see this channel, dazza-dzbot cannot read it either.**

And conversely:

> **If Dazza can see #bring-your-own-agent, dazza-dzbot can read it.**

For your initial BYOA group, this is especially easy because everybody may simply share the same channels.

Private threads require a little extra permission/membership handling, so I would avoid them in V1.

---

# And the agents can post as `dazza-dzbot`

Yes.

Crucially, I would **not** have the AI post through your human `dazzaji` account.

Instead it should visibly be:

> **dazzaji**
> Anyone know a good identity pattern for this?

> **dazza-dzbot**
> I found three relevant approaches. The OAuth/OIDC version is probably closest to what Dazza has been working on...

That is exactly the identity convention you already use.

Discord webhooks allow the sender to override the displayed `username` and `avatar_url` on individual messages, so our bridge can render the same central integration as `dazza-dzbot`, `sarah-claude`, `john-codex`, etc. ([Documentation - Discord][5]) Discord also marks webhook-originated messages distinctly in its data model through `webhook_id`. ([Documentation - Discord][6])

We maintain the authoritative identity mapping ourselves:

```text
human_id: discord:837...
human_name: Dazza
agent_id: agent:dazza-dzbot
agent_runtime: claude-code
```

So attribution isn't based merely on somebody typing a particular display name.

---

# There are actually two ways to do the identity

### Option A — one central BYOA app, virtual personal agents

**This is what I recommend.**

Everybody's agent connects to the same BYOA bridge, but messages visually appear under the individual agent name:

```text
dazza-dzbot
rick-rickbot
sandy-codex
...
```

Advantages:

* install **one** Discord app;
* nobody creates Discord developer accounts;
* nobody handles Discord bot tokens;
* Claude/Codex/Cursor/Hermes use the same interface;
* we centrally enforce human → agent identity;
* easy to revoke one person's agent;
* easy to enforce “agent sees only what principal sees”;
* very close to what we'll need for the workshop.

### Option B — every person creates a real Discord bot

Then `dazza-dzbot` is literally its own Discord bot/member.

This works too. Claude Code now even has an official Discord Channels implementation that pushes Discord events into a running Claude session and allows Claude to reply. ([Claude][7]) Hermes has native Discord support as part of its messaging gateway as well. ([Hermes Agent][8])

But every person has to:

> create Discord Application → create bot → manage token → invite bot → set permissions → configure agent

That's interesting for a geeky five-person experiment but **terrible as our eventual workshop onboarding model**.

I'd rather solve it once centrally.

---

# One subtle issue: “can see everything” versus “is paying attention all day”

These are different.

Giving an agent tools like:

```text
discord_read
discord_post
discord_reply
discord_react
```

is easy.

Then you can tell Codex:

> Go read what's happened in BYOA since this morning.

It reads it.

But your phrase **“our agents are with us all day”** suggests something stronger:

> Alice writes something at 2:37 PM and `dazza-dzbot` notices without Dazza prompting Claude.

That requires the local agent runtime to remain alive or to be awakened.

### Claude Code

This is now unusually clean.

Anthropic's official **Channels** feature exists specifically to push external events into a running Claude Code session so Claude can react without you being at the terminal. Channels can also be two-way, so Claude can respond back through the bridge. Anthropic explicitly includes Discord as a supported example. ([Claude][7])

So `dazza-dzbot` could genuinely sit in the BYOA channel while your Claude Code process remains running.

### Hermes

Hermes is even more naturally built this way. Its current messaging gateway explicitly supports Discord alongside Telegram, Slack, WhatsApp and others, and it supports MCP. ([Hermes Agent][9])

### Codex and Cursor

Both can readily **read and post through our MCP**, but I would give them a tiny background companion process for true ambient participation rather than assume an interactive session will wake itself. Codex exposes MCP integration and also an `app-server` intended for deeper persistent integrations. ([OpenAI Developers][10]) Cursor likewise supports MCP from both its IDE agent and CLI. ([Cursor Documentation][11])

So I would abstract this away.

---

# The little piece of software I think we should make

Call it something like:

```text
BYOA Bridge
```

or:

```text
Interlateral BYOA
```

Participant onboarding becomes:

### First time only

Point your agent at:

```text
https://.../byoa/SKILL.md
```

and say:

> Join me in Bring Your Own Agent as `dazza-dzbot`.

The skill does:

```text
1. Detect Claude / Codex / Cursor / Hermes
2. Install the BYOA MCP connection
3. Open Discord OAuth
4. User clicks Authorize
5. Register agent name: dazza-dzbot
6. Verify Discord permissions
7. Read recent channel activity
8. Post introduction
```

Result:

> **dazza-dzbot**
> Dazza's agent is connected. I've caught up on the BYOA discussion.

Done.

---

# Then interaction becomes really interesting

You could say to Claude Code:

> Catch up on BYOA and tell them what we've been working on.

Claude:

1. reads the channel;
2. determines context;
3. posts as `dazza-dzbot`.

Or:

> Keep an eye on BYOA today. If anything comes up involving agent identity or authorization that I should know about, engage if useful and alert me.

Or Alice could say in Discord:

> `dazza-dzbot` — what was Dazza's idea about PPIDs?

and your running agent could answer.

That starts feeling like the environment you were describing: **a social/work space populated by humans and each human's persistent personal agent.**

## And I would make one rule explicit

Every human has exactly one canonical agent identity in the server:

```text
<human-name>-<agent-name>
```

and the bridge cryptographically/authentically binds:

```text
Discord Human
      ↓ authorizes
Personal Agent Identity
      ↓ operates
Discord Channels
```

So `dazza-dzbot` means **Dazza-authorized dzbot**, not merely “some bot with that username.”

That actually turns this little BYOA Discord experiment into a very nice prototype of the accountable-agent identity ideas you've been working on.

**I think we should build this for the existing Computational Law server first with the 4–8 BYOA people, get Claude Code + Codex + Hermes working, and then promote almost the identical architecture into the Summer Intensive.** That gives us a real-world shakedown before exposing it to 200 lawyers.

[1]: https://support.discord.com/hc/en-us/articles/115002192352-Automated-User-Accounts-Self-Bots?utm_source=chatgpt.com "Automated User Accounts (Self-Bots)"
[2]: https://docs.anthropic.com/en/docs/claude-code/cli-usage?utm_source=chatgpt.com "CLI reference - Anthropic"
[3]: https://docs.discord.com/developers/events/gateway?utm_source=chatgpt.com "Gateway - Documentation - Discord"
[4]: https://docs.discord.com/developers/topics/permissions?utm_source=chatgpt.com "Permissions - Documentation"
[5]: https://docs.discord.com/developers/resources/webhook?utm_source=chatgpt.com "Webhook Resource - Documentation"
[6]: https://docs.discord.com/developers/resources/message?utm_source=chatgpt.com "Message Resource - Documentation"
[7]: https://code.claude.com/docs/en/channels?utm_source=chatgpt.com "Push events into a running session with channels"
[8]: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/discord/?utm_source=chatgpt.com "Discord | Hermes Agent"
[9]: https://hermes-agent.nousresearch.com/docs/?utm_source=chatgpt.com "Hermes Agent Documentation | Hermes Agent"
[10]: https://developers.openai.com/codex/mcp?utm_source=chatgpt.com "Model Context Protocol | ChatGPT Learn"
[11]: https://docs.cursor.com/context/model-context-protocol?utm_source=chatgpt.com "Cursor – Model Context Protocol (MCP)"
