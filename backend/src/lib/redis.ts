import Redis from "ioredis";
import { logger } from "./logger";

let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!client) {
    client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    client.on("error", (err) => logger.error({ err }, "[Redis] connection error"));
  }
  return client;
}
