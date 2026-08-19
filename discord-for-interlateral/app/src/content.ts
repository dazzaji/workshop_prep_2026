import { jsonError } from "./errors.js";
import type { Runtime } from "./types.js";

const MENTION_RE = /@(?:everyone|here)\b|<@!?\d+>|<@&\d+>/i;
const INVITE_RE = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/[A-Za-z0-9-]+/i;
const URL_RE = /https?:\/\/[^\s]+/gi;

export function assertPostableMessage(message: string): string {
  const text = message.replace(/\r\n/g, "\n").trim();
  if (!text) throw jsonError("invalid_request", 400);
  if (text.length > 1500) throw jsonError("invalid_request", 400);
  if (MENTION_RE.test(text) || INVITE_RE.test(text)) {
    throw jsonError("unapproved_mention", 400);
  }
  const links = text.match(URL_RE) ?? [];
  if (links.length > 5) throw jsonError("invalid_request", 400);
  return text;
}

export function attributionPrefix(humanLabel: string, runtime: Runtime): string {
  const human = humanLabel.replace(/\s+/g, " ").trim().toUpperCase() || "PARTICIPANT";
  return `[AGENT FOR ${human} / ${runtime.toUpperCase()}]`;
}

export function composeAgentPost(humanLabel: string, runtime: Runtime, body: string): string {
  return `${attributionPrefix(humanLabel, runtime)}\n${body}`;
}

export function classifyOrigin(input: { bot: boolean; content: string }): "human" | "workshop_bot" | "participant_agent" {
  if (!input.bot) return "human";
  if (input.content.startsWith("[AGENT FOR ")) return "participant_agent";
  return "workshop_bot";
}
