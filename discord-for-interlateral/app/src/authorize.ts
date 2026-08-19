import { jsonError } from "./errors.js";
import { teamByKey, teamByRole } from "./config.js";
import type {
  AllowedAccess,
  AppConfig,
  DiscordAdapter,
  GuildMemberInfo,
  SurfaceName,
  TeamKey,
} from "./types.js";
import type { Db } from "./db.js";
import { getPhase, getSetting } from "./db.js";

export function isOperator(config: AppConfig, member: GuildMemberInfo): boolean {
  if (member.administrator) return true;
  return member.roleIds.some((id) => config.operatorRoleIds.includes(id));
}

export function teamKeysFor(config: AppConfig, member: GuildMemberInfo): TeamKey[] {
  const keys: TeamKey[] = [];
  for (const roleId of member.roleIds) {
    const team = teamByRole(config, roleId);
    if (team && !keys.includes(team.key)) keys.push(team.key);
  }
  return keys;
}

export function decideConnectPin(
  config: AppConfig,
  member: GuildMemberInfo,
  requestedTeam: TeamKey | null,
): TeamKey {
  const teams = teamKeysFor(config, member);
  if (isOperator(config, member)) {
    if (!requestedTeam || !teamByKey(config, requestedTeam)) {
      throw jsonError("connect_refused", 403);
    }
    return requestedTeam;
  }

  if (teams.length === 0) throw jsonError("connect_refused", 403);
  if (teams.length > 1) {
    if (!requestedTeam || !teams.includes(requestedTeam)) throw jsonError("connect_refused", 403);
    return requestedTeam;
  }
  if (requestedTeam && requestedTeam !== teams[0]) throw jsonError("connect_refused", 403);
  return teams[0];
}

export async function resolveAccess(
  db: Db,
  config: AppConfig,
  discord: DiscordAdapter,
  input: {
    discordUserId: string;
    guildId: string;
    pinnedTeam: TeamKey | null;
    surface?: SurfaceName;
  },
): Promise<{ member: GuildMemberInfo; access: AllowedAccess; channelId: string | null }> {
  if (input.guildId !== config.guildId) throw jsonError("forbidden_surface", 403);
  const member = await discord.getMember(input.guildId, input.discordUserId);
  if (!member) throw jsonError("forbidden_surface", 403);

  const phase = getPhase(db, config.defaultPhase);
  const questionsPostSetting = getSetting(db, "questions_post");
  const questionsPost =
    questionsPostSetting === null ? config.questionsPostEnabled : questionsPostSetting === "on";

  let team = null as AllowedAccess["team"];
  if (input.pinnedTeam) {
    const pinned = teamByKey(config, input.pinnedTeam);
    if (pinned) {
      const hasRole = member.roleIds.includes(pinned.roleId);
      if (hasRole || isOperator(config, member)) team = pinned;
    }
  } else {
    const keys = teamKeysFor(config, member);
    if (keys.length === 1) team = teamByKey(config, keys[0]);
  }

  const surfaces: SurfaceName[] = [];
  if (team && (phase === "team" || phase === "both")) surfaces.push("team");
  if (team && (phase === "questions" || phase === "both")) surfaces.push("questions");

  const access: AllowedAccess = { team, surfaces, questionsPost };

  if (!input.surface) return { member, access, channelId: null };
  if (!surfaces.includes(input.surface)) throw jsonError("forbidden_surface", 403);
  if (input.surface === "team") {
    if (!team) throw jsonError("forbidden_surface", 403);
    return { member, access, channelId: team.channelId };
  }
  return { member, access, channelId: config.questionsChannelId };
}
