import { Interaction, REST, Routes, SlashCommandBuilder } from "discord.js";
import type { Client } from "discord.js";
import { decideConnectPin, isOperator } from "./authorize.js";
import type { AppConfig, Runtime, TeamKey } from "./types.js";
import { sanitizeAgentLabel } from "./crypto.js";
import type { Db } from "./db.js";
import { BridgeError } from "./errors.js";
import { issueSetupCode } from "./store.js";

export function agentConnectCommand(config: AppConfig) {
  const command = new SlashCommandBuilder()
    .setName("agent-connect")
    .setDescription("Connect a Claude or Codex agent to your authorized workshop surface")
    .addStringOption((opt) =>
      opt.setName("agent_name").setDescription("Display label for your agent").setRequired(true).setMaxLength(32),
    )
    .addStringOption((opt) =>
      opt
        .setName("runtime")
        .setDescription("Agent runtime")
        .setRequired(true)
        .addChoices({ name: "Claude", value: "claude" }, { name: "Codex", value: "codex" }),
    )
    .addStringOption((opt) => {
      opt.setName("team").setDescription("Required if you are staff or hold more than one team role");
      return opt.addChoices(...config.teams.map((team) => ({ name: team.label.slice(0, 100), value: team.key })));
    });
  return command;
}

export async function registerGuildCommands(token: string, clientId: string, config: AppConfig): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, config.guildId), {
    body: [agentConnectCommand(config).toJSON()],
  });
}

export function attachBot(opts: { client: Client; db: Db; config: AppConfig; discordToken?: string; clientId?: string }) {
  opts.client.on("ready", async () => {
    if (opts.discordToken && opts.clientId && opts.config.guildId) {
      await registerGuildCommands(opts.discordToken, opts.clientId, opts.config);
    }
  });

  opts.client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "agent-connect") return;
    try {
      if (!interaction.inGuild() || interaction.guildId !== opts.config.guildId) {
        await interaction.reply({ content: "This command is only available in the workshop server.", ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const member = await interaction.guild?.members.fetch(interaction.user.id);
      if (!member) throw new BridgeError("connect_refused", 403);
      const roleIds = [...member.roles.cache.keys()];
      const displayName = member.displayName;
      const administrator = member.permissions.has("Administrator");
      const requested = (interaction.options.getString("team") as TeamKey | null) ?? null;
      const pin = decideConnectPin(
        opts.config,
        { id: interaction.user.id, displayName, roleIds, administrator },
        requested,
      );
      const runtime = interaction.options.getString("runtime", true) as Runtime;
      const agentLabel = sanitizeAgentLabel(interaction.options.getString("agent_name", true));
      const code = issueSetupCode(opts.db, opts.config, {
        discordUserId: interaction.user.id,
        guildId: interaction.guildId,
        agentLabel,
        runtime,
        pinnedTeam: pin,
      });
      const prompt = [
        `Join me in the workshop Discord as ${agentLabel} (${runtime}).`,
        `Fetch ${opts.config.publicOrigin}/SKILL.md and follow it.`,
        `Exchange this one-time setup code at POST ${opts.config.publicOrigin}/v1/connect`,
        `Code: ${code}`,
        "Then call GET /v1/status. Never repeat the code or bearer token. Wait for my approval before any POST /v1/post.",
      ].join("\n");
      const staffNote = isOperator(opts.config, { id: interaction.user.id, displayName, roleIds, administrator })
        ? `\nStaff credential is pinned to ${pin} only.`
        : "";
      await interaction.editReply({
        content: `Setup code expires in 5 minutes.${staffNote}\nSkill: ${opts.config.publicOrigin}/SKILL.md\n\nPaste this into your agent:\n\`\`\`\n${prompt}\n\`\`\``,
      });
    } catch (err) {
      const code = err instanceof BridgeError ? err.code : "internal";
      const content =
        code === "connect_refused"
          ? "Refused: you need one assigned team role; administrators, operators, and multi-team users must also pick one team option."
          : "Could not issue a setup code.";
      if (interaction.deferred || interaction.replied) await interaction.editReply({ content });
      else await interaction.reply({ ephemeral: true, content });
    }
  });
}
