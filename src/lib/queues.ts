import { Queue } from "bullmq";
import { redisConnection } from "./redis";

// Queue definitions
export const webhookQueue = new Queue("webhooks", { connection: redisConnection });
export const whatsappQueue = new Queue("whatsapp", { connection: redisConnection });
export const recoveryQueue = new Queue("recovery", { connection: redisConnection });
export const syncQueue = new Queue("sync", { connection: redisConnection });
export const analyticsQueue = new Queue("analytics", { connection: redisConnection });

// Helper to add jobs
export const addWebhookJob = (data: any) =>
  webhookQueue.add("process-webhook", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  });

export const addWhatsappJob = (data: any) =>
  whatsappQueue.add("send-message", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 1000,
  });

export const addRecoveryJob = (data: any, delay?: number) =>
  recoveryQueue.add("recover-cart", data, {
    attempts: 2,
    delay: delay || 0,
    removeOnComplete: 500,
  });

export const addSyncJob = (data: any) =>
  syncQueue.add("sync-store", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 10000 },
  });
