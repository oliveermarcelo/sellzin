// @ts-nocheck
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on("error", (err) => {
  console.error("Redis error:", err.message);
});

redis.on("connect", () => {
  console.log("✅ Redis conectado");
});

export const redisConnection = {
  host: new URL(REDIS_URL).hostname || "localhost",
  port: parseInt(new URL(REDIS_URL).port || "6379"),
};
