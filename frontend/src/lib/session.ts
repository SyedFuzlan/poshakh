import { createHmac } from "crypto";

const SECRET = process.env.COOKIE_SECRET!;
if (!SECRET) throw new Error("COOKIE_SECRET env var is not set");

export function createSignedCookie(data: object): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySignedCookie(value: string): Record<string, unknown> | null {
  const dotIdx = value.lastIndexOf(".");
  if (dotIdx === -1) return null;
  const payload = value.slice(0, dotIdx);
  const sig = value.slice(dotIdx + 1);
  const expected = createHmac("sha256", SECRET).update(payload).digest("hex");
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
