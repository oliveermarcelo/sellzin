import { FastifyInstance } from "fastify";
import { db } from "../../lib/db";
import { stores, webhookLogs } from "../../lib/db/schema";
import { eq } from "drizzle-orm";
import { addWebhookJob } from "../../lib/queues";
import crypto from "crypto";

function verifyWooCommerceSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hash = crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("base64");
  return hash === signature;
}

export async function webhookRoutes(app: FastifyInstance) {
  // ── WooCommerce webhook ──
  app.post("/woocommerce/:storeId", {
    config: { rawBody: true },
  }, async (request, reply) => {
    const { storeId } = request.params as any;

    const store = await db.query.stores.findFirst({
      where: eq(stores.id, storeId),
    });

    if (!store || store.platform !== "woocommerce") {
      return reply.code(404).send({ error: "Store not found" });
    }

    // Verify signature if configured
    const signature = request.headers["x-wc-webhook-signature"] as string;
    if (store.webhookSecret && signature) {
      const rawBody = JSON.stringify(request.body);
      if (!verifyWooCommerceSignature(rawBody, signature, store.webhookSecret)) {
        return reply.code(401).send({ error: "Invalid signature" });
      }
    }

    const event = (request.headers["x-wc-webhook-topic"] as string) || "unknown";
    const payload = request.body as any;

    // Log webhook
    const [log] = await db
      .insert(webhookLogs)
      .values({
        tenantId: store.tenantId,
        storeId: store.id,
        event,
        payload,
      })
      .returning();

    // Queue processing
    await addWebhookJob({
      logId: log.id,
      tenantId: store.tenantId,
      storeId: store.id,
      platform: "woocommerce",
      event,
      payload,
    });

    return { received: true };
  });

  // ── Magento webhook ──
  app.post("/magento/:storeId", async (request, reply) => {
    const { storeId } = request.params as any;

    const store = await db.query.stores.findFirst({
      where: eq(stores.id, storeId),
    });

    if (!store || store.platform !== "magento") {
      return reply.code(404).send({ error: "Store not found" });
    }

    // Verify API key header
    const apiKey = request.headers["x-magento-webhook-key"] as string;
    if (store.webhookSecret && apiKey !== store.webhookSecret) {
      return reply.code(401).send({ error: "Invalid key" });
    }

    const payload = request.body as any;
    const event = payload.event || "unknown";

    const [log] = await db
      .insert(webhookLogs)
      .values({
        tenantId: store.tenantId,
        storeId: store.id,
        event,
        payload,
      })
      .returning();

    await addWebhookJob({
      logId: log.id,
      tenantId: store.tenantId,
      storeId: store.id,
      platform: "magento",
      event,
      payload,
    });

    return { received: true };
  });
}
