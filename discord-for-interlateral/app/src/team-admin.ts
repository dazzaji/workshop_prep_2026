import { teamByKey } from "./config.js";
import type { AppConfig } from "./types.js";

export type DiscordMemberRecord = {
  id: string;
  username: string;
  globalName: string | null;
  nick: string | null;
  roleIds: string[];
};

export interface TeamRoleApi {
  getMember(guildId: string, userId: string): Promise<DiscordMemberRecord | null>;
  searchMembers(guildId: string, query: string): Promise<DiscordMemberRecord[]>;
  addRole(guildId: string, userId: string, roleId: string): Promise<void>;
  removeRole(guildId: string, userId: string, roleId: string): Promise<void>;
}

type DiscordMemberPayload = {
  user?: { id?: string; username?: string; global_name?: string | null };
  nick?: string | null;
  roles?: string[];
};

function memberRecord(payload: DiscordMemberPayload): DiscordMemberRecord | null {
  const id = payload.user?.id;
  const username = payload.user?.username;
  if (!id || !username) return null;
  return {
    id,
    username,
    globalName: payload.user?.global_name ?? null,
    nick: payload.nick ?? null,
    roleIds: Array.isArray(payload.roles) ? payload.roles : [],
  };
}

export class LiveTeamRoleApi implements TeamRoleApi {
  constructor(private readonly token: string) {
    if (!token) throw new Error("DISCORD_TOKEN is required for team administration");
  }

  private async request(path: string, method = "GET"): Promise<unknown> {
    const response = await fetch(`https://discord.com/api/v10${path}`, {
      method,
      headers: { authorization: `Bot ${this.token}`, "user-agent": "InterlateralTeamAdmin/1.0" },
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`Discord ${method} ${path} failed (${response.status}): ${detail}`);
    }
    return response.status === 204 ? null : response.json();
  }

  async getMember(guildId: string, userId: string): Promise<DiscordMemberRecord | null> {
    const payload = (await this.request(`/guilds/${guildId}/members/${userId}`)) as DiscordMemberPayload;
    return memberRecord(payload);
  }

  async searchMembers(guildId: string, query: string): Promise<DiscordMemberRecord[]> {
    const encoded = encodeURIComponent(query.trim());
    if (!encoded) return [];
    const payload = (await this.request(`/guilds/${guildId}/members/search?query=${encoded}&limit=20`)) as
      | DiscordMemberPayload[]
      | undefined;
    return (payload ?? []).map(memberRecord).filter((value): value is DiscordMemberRecord => value !== null);
  }

  async addRole(guildId: string, userId: string, roleId: string): Promise<void> {
    await this.request(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, "PUT");
  }

  async removeRole(guildId: string, userId: string, roleId: string): Promise<void> {
    await this.request(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, "DELETE");
  }
}

function validUserId(userId: string): boolean {
  return /^\d{16,22}$/.test(userId);
}

export async function assignExclusiveTeam(
  config: AppConfig,
  api: TeamRoleApi,
  userId: string,
  teamKey: string,
): Promise<{ member: DiscordMemberRecord; team: string; removedTeams: string[]; changed: boolean }> {
  if (!validUserId(userId)) throw new Error("discordUserId must be a Discord snowflake");
  const target = teamByKey(config, teamKey);
  if (!target) throw new Error(`Unknown team key: ${teamKey}`);

  const member = await api.getMember(config.guildId, userId);
  if (!member) throw new Error(`Discord member not found: ${userId}`);

  const otherTeams = config.teams.filter((team) => team.key !== target.key && member.roleIds.includes(team.roleId));
  const removed: typeof otherTeams = [];
  for (const team of otherTeams) {
    await api.removeRole(config.guildId, userId, team.roleId);
    removed.push(team);
  }

  const hadTarget = member.roleIds.includes(target.roleId);
  try {
    if (!hadTarget) await api.addRole(config.guildId, userId, target.roleId);
  } catch (error) {
    const restoreFailures: string[] = [];
    for (const team of removed) {
      try {
        await api.addRole(config.guildId, userId, team.roleId);
      } catch {
        restoreFailures.push(team.key);
      }
    }
    if (restoreFailures.length) {
      throw new Error(`Team assignment failed and rollback failed for: ${restoreFailures.join(", ")}`, { cause: error });
    }
    throw error;
  }

  return {
    member,
    team: target.key,
    removedTeams: removed.map((team) => team.key),
    changed: !hadTarget || removed.length > 0,
  };
}

export async function removeConfiguredTeams(
  config: AppConfig,
  api: TeamRoleApi,
  userId: string,
): Promise<{ member: DiscordMemberRecord; removedTeams: string[] }> {
  if (!validUserId(userId)) throw new Error("discordUserId must be a Discord snowflake");
  const member = await api.getMember(config.guildId, userId);
  if (!member) throw new Error(`Discord member not found: ${userId}`);
  const assigned = config.teams.filter((team) => member.roleIds.includes(team.roleId));
  for (const team of assigned) await api.removeRole(config.guildId, userId, team.roleId);
  return { member, removedTeams: assigned.map((team) => team.key) };
}
