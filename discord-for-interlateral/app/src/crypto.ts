import { createHash, randomBytes, createHmac, timingSafeEqual } from "node:crypto";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function hashSecret(pepper: string, value: string): string {
  return createHash("sha256").update(pepper).update(":").update(value).digest("hex");
}

export function signCursor(pepper: string, payload: { surface: string; lastId: string }): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", pepper).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readCursor(pepper: string, cursor: string): { surface: string; lastId: string } | null {
  const dot = cursor.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = cursor.slice(0, dot);
  const sig = cursor.slice(dot + 1);
  const expected = createHmac("sha256", pepper).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      surface?: string;
      lastId?: string;
    };
    if (!parsed.surface || !parsed.lastId) return null;
    return { surface: parsed.surface, lastId: parsed.lastId };
  } catch {
    return null;
  }
}

export function sanitizeAgentLabel(raw: string): string {
  const cleaned = raw.replace(/[^\w .-]/g, "").trim().slice(0, 32);
  return cleaned.length >= 2 ? cleaned : "agent";
}
