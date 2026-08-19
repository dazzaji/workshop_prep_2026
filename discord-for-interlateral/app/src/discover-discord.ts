import { ChannelType, Client, GatewayIntentBits } from "discord.js";

const token = process.env.DISCORD_TOKEN ?? "";
if (!token) {
  console.error("DISCORD_TOKEN is required");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
await client.login(token);

const output = [];
for (const summary of (await client.guilds.fetch()).values()) {
  const guild = await client.guilds.fetch(summary.id);
  const roles = await guild.roles.fetch();
  const channels = await guild.channels.fetch();
  output.push({
    guild: { id: guild.id, name: guild.name },
    roles: [...roles.values()]
      .filter((role) => role.name !== "@everyone")
      .map((role) => ({ id: role.id, name: role.name, managed: role.managed }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    text_channels: [...channels.values()]
      .filter((channel) => channel?.type === ChannelType.GuildText)
      .map((channel) => ({ id: channel!.id, name: channel!.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  });
}

console.log(JSON.stringify(output, null, 2));
client.destroy();
