import { configFromEnv } from "./config.js";
import { registerGuildCommands } from "./bot.js";

const token = process.env.DISCORD_TOKEN ?? "";
const clientId = process.env.DISCORD_CLIENT_ID ?? "";
const config = configFromEnv();
if (!token || !clientId || !config.guildId) {
  console.error("DISCORD_TOKEN, DISCORD_CLIENT_ID, and DISCORD_GUILD_ID are required");
  process.exit(1);
}
await registerGuildCommands(token, clientId, config);
console.log("Registered /agent-connect for the configured guild");
