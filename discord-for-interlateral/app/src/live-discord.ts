import { Client, GatewayIntentBits, Partials } from "discord.js";
import type { ChannelMessage, DiscordAdapter, GuildMemberInfo } from "./types.js";

export class LiveDiscord implements DiscordAdapter {
  constructor(private readonly client: Client) {}

  async getMember(guildId: string, userId: string): Promise<GuildMemberInfo | null> {
    const guild = await this.client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return null;
    return {
      id: member.id,
      displayName: member.displayName,
      roleIds: [...member.roles.cache.keys()],
      administrator: member.permissions.has("Administrator"),
    };
  }

  async fetchMessages(channelId: string, afterId: string | undefined, limit: number): Promise<ChannelMessage[]> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || channel.isDMBased()) return [];
    const batch = await channel.messages.fetch({ limit, ...(afterId ? { after: afterId } : {}) });
    return [...batch.values()]
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      .map((m) => ({
        id: m.id,
        channelId,
        authorId: m.author.id,
        authorLabel: m.member?.displayName ?? m.author.username,
        bot: m.author.bot,
        content: m.content,
        createdAt: m.createdTimestamp,
      }));
  }

  async postMessage(channelId: string, content: string): Promise<{ id: string }> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || channel.isDMBased() || !("send" in channel)) {
      throw new Error("channel_not_text");
    }
    const sent = await channel.send({ content, allowedMentions: { parse: [] } });
    return { id: sent.id };
  }
}

export function createDiscordClient(): Client {
  return new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel],
  });
}
