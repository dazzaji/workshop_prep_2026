import type { ChannelMessage, DiscordAdapter, GuildMemberInfo } from "./types.js";

export class FakeDiscord implements DiscordAdapter {
  members = new Map<string, GuildMemberInfo>();
  channels = new Map<string, ChannelMessage[]>();
  posted: ChannelMessage[] = [];
  private seq = 1;

  putMember(member: GuildMemberInfo): void {
    this.members.set(member.id, { ...member, roleIds: [...member.roleIds] });
  }

  seedMessage(message: Omit<ChannelMessage, "id"> & { id?: string }): ChannelMessage {
    const full: ChannelMessage = {
      ...message,
      id: message.id ?? `m${this.seq++}`,
    };
    const list = this.channels.get(full.channelId) ?? [];
    list.push(full);
    this.channels.set(full.channelId, list);
    return full;
  }

  async getMember(_guildId: string, userId: string): Promise<GuildMemberInfo | null> {
    return this.members.get(userId) ?? null;
  }

  async fetchMessages(channelId: string, afterId: string | undefined, limit: number): Promise<ChannelMessage[]> {
    const list = this.channels.get(channelId) ?? [];
    const start = afterId ? list.findIndex((m) => m.id === afterId) + 1 : 0;
    const sliced = (afterId && start === 0 && !list.some((m) => m.id === afterId) ? list : list.slice(Math.max(start, 0)));
    return sliced.slice(-limit);
  }

  async postMessage(channelId: string, content: string): Promise<{ id: string }> {
    const posted = this.seedMessage({
      channelId,
      authorId: "workshop-bot",
      authorLabel: "Workshop Bot",
      bot: true,
      content,
      createdAt: Date.now(),
    });
    this.posted.push(posted);
    return { id: posted.id };
  }
}
