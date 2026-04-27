import { getRedisClient } from "./redis";

export interface OtpEntry {
  otp: string;
  expiresAt: number;
  firstName?: string;
  lastName?: string;
}

const OTP_TTL_SECONDS        = 10 * 60;
const RATE_LIMIT_TTL_SECONDS = 60;
export const MAX_ATTEMPTS    = 5;

const otpKey      = (id: string) => `otp:${id}`;
const rateLimitKey= (id: string) => `otp_sent:${id}`;
const attemptsKey = (id: string) => `otp_attempts:${id}`;

export async function setOtp(identifier: string, entry: Omit<OtpEntry, "expiresAt">): Promise<void> {
  const redis = getRedisClient();
  const value: OtpEntry = { ...entry, expiresAt: Date.now() + OTP_TTL_SECONDS * 1000 };
  await redis.setex(otpKey(identifier), OTP_TTL_SECONDS, JSON.stringify(value));
  await redis.setex(rateLimitKey(identifier), RATE_LIMIT_TTL_SECONDS, "1");
}

export async function getOtp(identifier: string): Promise<OtpEntry | null> {
  const raw = await getRedisClient().get(otpKey(identifier));
  if (!raw) return null;
  try { return JSON.parse(raw) as OtpEntry; } catch { return null; }
}

export async function deleteOtp(identifier: string): Promise<void> {
  await getRedisClient().del(otpKey(identifier));
}

export async function isRateLimited(identifier: string): Promise<boolean> {
  return (await getRedisClient().get(rateLimitKey(identifier))) !== null;
}

export async function incrementAttempts(identifier: string): Promise<number> {
  const redis = getRedisClient();
  const count = await redis.incr(attemptsKey(identifier));
  if (count === 1) await redis.expire(attemptsKey(identifier), OTP_TTL_SECONDS);
  return count;
}

export async function clearAttempts(identifier: string): Promise<void> {
  await getRedisClient().del(attemptsKey(identifier));
}
