import bcrypt from "bcrypt";
import { getRedisClient } from "./redis";

const BCRYPT_ROUNDS = 12;

interface AuthMeta {
  passwordHash?: string;
  emailVerified: boolean;
  createdAt: number;
}

const key = (id: string) => `auth_meta:${id}`;

async function read(customerId: string): Promise<AuthMeta | null> {
  const raw = await getRedisClient().get(key(customerId));
  return raw ? (JSON.parse(raw) as AuthMeta) : null;
}

async function write(customerId: string, meta: AuthMeta): Promise<void> {
  await getRedisClient().set(key(customerId), JSON.stringify(meta));
}

export async function setPasswordHash(customerId: string, plainPassword: string): Promise<void> {
  const existing = await read(customerId);
  await write(customerId, {
    emailVerified: existing?.emailVerified ?? false,
    createdAt: existing?.createdAt ?? Date.now(),
    passwordHash: await bcrypt.hash(plainPassword, BCRYPT_ROUNDS),
  });
}

export async function verifyPassword(customerId: string, plain: string): Promise<boolean> {
  const meta = await read(customerId);
  if (!meta?.passwordHash) return false;
  return bcrypt.compare(plain, meta.passwordHash);
}

export async function hasPassword(customerId: string): Promise<boolean> {
  const meta = await read(customerId);
  return !!meta?.passwordHash;
}

export async function setEmailVerified(customerId: string): Promise<void> {
  const existing = await read(customerId);
  await write(customerId, {
    passwordHash: existing?.passwordHash,
    createdAt: existing?.createdAt ?? Date.now(),
    emailVerified: true,
  });
}
