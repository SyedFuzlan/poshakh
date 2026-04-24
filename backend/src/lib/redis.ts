import Redis from "ioredis";

let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!client) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    client = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });

    client.on("error", (err) => {
      console.error("[Redis] connection error:", err.message);
    });
  }
  return client;
}
