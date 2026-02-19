// @ts-nocheck
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../lib/db";
import { stores } from "../../lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { addSyncJob } from "../../lib/queues";

const createStoreSchema = z.object({
  name: z.string().min(1).max(255),
  platform: z.enum(["woocommerce", "magento"]),
  apiUrl: z.string().url(),
  apiKey: z.string().min(1),
  apiSecret: z.string().optional(),
});

export async function storeRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // ── List stores ──
  app.get("/", async (request) => {
    const { tenantId } = request.user as any;
    const result = await db.query.stores.findMany({
      where: eq(stores.tenantId, tenantId),
      orderBy: (stores, { desc }) => [desc(stores.createdAt)],
    });
    return { stores: result };
  });

  // ── Connect store ──
  app.post("/", async (request, reply) => {
    const { tenantId } = request.user as any;
    const body = createStoreSchema.parse(request.body);
    const webhookSecret = `whsec_${nanoid(32)}`;

    const [store] = await db
      .insert(stores)
      .values({
        tenantId,
        ...body,
        webhookSecret,
        syncStatus: "pending",
      })
      .returning();

    // Queue initial sync
    await addSyncJob({ storeId: store.id, tenantId, type: "full" });

    return reply.code(201).send({ store });
  });

  // ── Get store ──
  app.get("/:id", async (request, reply) => {
    const { tenantId } = request.user as any;
    const { id } = request.params as any;

    const store = await db.query.stores.findFirst({
      where: and(eq(stores.id, id), eq(stores.tenantId, tenantId)),
    });

    if (!store) return reply.code(404).send({ error: "Loja não encontrada" });
    return { store };
  });

  // ── Force sync ──
  app.post("/:id/sync", async (request, reply) => {
    const { tenantId } = request.user as any;
    const { id } = request.params as any;

    const store = await db.query.stores.findFirst({
      where: and(eq(stores.id, id), eq(stores.tenantId, tenantId)),
    });

    if (!store) return reply.code(404).send({ error: "Loja não encontrada" });

    await addSyncJob({ storeId: id, tenantId, type: "full" });
    return { message: "Sincronização iniciada" };
  });

  // ── Delete store ──
  app.delete("/:id", async (request, reply) => {
    const { tenantId } = request.user as any;
    const { id } = request.params as any;

    await db
      .delete(stores)
      .where(and(eq(stores.id, id), eq(stores.tenantId, tenantId)));

    return { message: "Loja desconectada" };
  });
}
