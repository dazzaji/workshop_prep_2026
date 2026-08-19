export type Runtime = "claude" | "codex";
export type Phase = "team" | "questions" | "both";
export type TeamKey = string;
export type SurfaceName = "team" | "questions";
export type MessageOrigin = "human" | "workshop_bot" | "participant_agent";

export type TeamSurface = {
  key: TeamKey;
  roleId: string;
  channelId: string;
  label: string;
};

export type AppConfig = {
  port: number;
  publicOrigin: string;
  sqlitePath: string;
  pepper: string;
  guildId: string;
  operatorRoleIds: string[];
  teams: TeamSurface[];
  questionsChannelId: string;
  credentialTtlMs: number;
  setupCodeTtlMs: number;
  defaultPhase: Phase;
  questionsPostEnabled: boolean;
};

export type GuildMemberInfo = {
  id: string;
  displayName: string;
  roleIds: string[];
  administrator: boolean;
};

export type ChannelMessage = {
  id: string;
  channelId: string;
  authorId: string;
  authorLabel: string;
  bot: boolean;
  content: string;
  createdAt: number;
};

export interface DiscordAdapter {
  getMember(guildId: string, userId: string): Promise<GuildMemberInfo | null>;
  fetchMessages(channelId: string, afterId: string | undefined, limit: number): Promise<ChannelMessage[]>;
  postMessage(channelId: string, content: string): Promise<{ id: string }>;
}

export type SetupCodeRecord = {
  discordUserId: string;
  guildId: string;
  agentLabel: string;
  runtime: Runtime;
  pinnedTeam: TeamKey | null;
  expiresAt: number;
};

export type CredentialRecord = {
  id: string;
  discordUserId: string;
  guildId: string;
  agentLabel: string;
  runtime: Runtime;
  pinnedTeam: TeamKey | null;
  expiresAt: number;
  revokedAt: number | null;
};

export type AllowedAccess = {
  team: TeamSurface | null;
  surfaces: SurfaceName[];
  questionsPost: boolean;
};
