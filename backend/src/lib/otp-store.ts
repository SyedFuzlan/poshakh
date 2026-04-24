import { getRedisClient } from "./redis";

export interface OtpEntry {
  otp: string;
  expiresAt: number;
  firstName?: string;
  lastName?: string;
}

const OTP_TTL_SECONDS = 10 * 60;
const RATE_LIMIT_TTL_SECONDS = 60;

function otpKey(identifier: string) {
  return `otp:${identifier}`;
}

function rateLimitKey(identifier: string) {
  return `otp_sent:${identifier}`;
}

export async function setOtp(
  identifier: string,
  entry: Omit<OtpEntry, "expiresAt">
): Promise<void> {
  const redis = getRedisClient();
  const value: OtpEntry = {
    ...entry,
    expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
  };
  await redis.setex(otpKey(identifier), OTP_TTL_SECONDS, JSON.stringify(value));
  await redis.setex(rateLimitKey(identifier), RATE_LIMIT_TTL_SECONDS, "1");
}

export async function getOtp(identifier: string): Promise<OtpEntry | null> {
  const redis = getRedisClient();
  const raw = await redis.get(otpKey(identifier));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OtpEntry;
  } catch {
    return null;
  }
}

export async function deleteOtp(identifier: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(otpKey(identifier));
}

export async function isRateLimited(identifier: string): Promise<boolean> {
  const redis = getRedisClient();
  const val = await redis.get(rateLimitKey(identifier));
  return val !== null;
}
