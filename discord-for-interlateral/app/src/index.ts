import { assertProductionConfig, configFromEnv } from "./config.js";
import { openDb } from "./db.js";
import { createHttpApp } from "./http.js";
import { attachBot } from "./bot.js";
import { createDiscordClient, LiveDiscord } from "./live-discord.js";
import { FakeDiscord } from "./discord.js";

const config = configFromEnv();
const db = openDb(config.sqlitePath);
const token = process.env.DISCORD_TOKEN ?? "";
const clientId = process.env.DISCORD_CLIENT_ID ?? "";
if (process.env.NODE_ENV === "production") assertProductionConfig(config, { token, clientId });

const client = token ? createDiscordClient() : null;
const discord = client ? new LiveDiscord(client) : new FakeDiscord();
const app = createHttpApp({ db, config, discord, ready: () => client?.isReady() ?? true });

const server = app.listen(config.port, () => {
  console.log(`bridge http listening on ${config.port} origin=${config.publicOrigin} sqlite=${config.sqlitePath}`);
  if (!token) console.log("DISCORD_TOKEN unset: HTTP only, fake Discord adapter (not for participants)");
});

if (client && token) {
  attachBot({ client, db, config, discordToken: token, clientId });
  await client.login(token);
}

function shutdown() {
  server.close();
  client?.destroy();
  db.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
