// @ts-nocheck
import { Queue } from "bullmq";
import { redisConnection } from "../../lib/redis";
import { db } from "../../lib/db";
import { automations, automationRuns } from "../../lib/db/schema";
import { eq, and } from "drizzle-orm";

const automationQueue = new Queue("automations", { connection: redisConnection });

export async function queueAutomationRun(
  tenantId: string,
  automationId: string,
  contactId: string | null,
  phone: string | null,
  context: Record<string, any> = {},
  options: { skipWaits?: boolean } = {}
) {
  const [run] = await db.insert(automationRuns).values({
    tenantId,
    automationId,
    contactId: contactId || null,
    status: "running",
    context,
  }).returning();

  await automationQueue.add("run-step", {
    automationId,
    runId: run.id,
    tenantId,
    contactId,
    phone,
    step: 0,
    context,
    skipWaits: !!options.skipWaits,
  });

  return run;
}

export async function triggerAutomations(
  tenantId: string,
  trigger: string,
  contactId: string | null,
  phone: string | null,
  context: Record<string, any> = {}
) {
  try {
    const active = await db.query.automations.findMany({
      where: and(
        eq(automations.tenantId, tenantId),
        eq(automations.trigger, trigger as any),
        eq(automations.isActive, true)
      ),
    });

    for (const automation of active) {
      await queueAutomationRun(tenantId, automation.id, contactId, phone, context);
    }
  } catch (e: any) {
    console.error(`[automations] triggerAutomations error (${trigger}):`, e.message);
  }
}
