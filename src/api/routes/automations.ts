// @ts-nocheck
import { FastifyInstance } from "fastify";
import { db } from "../../lib/db";
import { automations } from "../../lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function automationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // ── List ──
  app.get("/", async (req) => {
    const { tenantId } = req.user as any;
    const result = await db.query.automations.findMany({
      where: eq(automations.tenantId, tenantId),
      orderBy: [desc(automations.createdAt)],
    });
    return { automations: result };
  });

  // ── Create ──
  app.post("/", async (req, reply) => {
    const { tenantId } = req.user as any;
    const { name, description, trigger, conditions, actions } = req.body as any;
    if (!name?.trim()) return reply.code(400).send({ error: "name é obrigatório" });
    if (!trigger) return reply.code(400).send({ error: "trigger é obrigatório" });

    const [automation] = await db.insert(automations).values({
      tenantId,
      name: name.trim(),
      description: description?.trim() || null,
      trigger,
      conditions: conditions || {},
      actions: actions || [],
    }).returning();

    return { automation };
  });

  // ── Update ──
  app.put("/:id", async (req, reply) => {
    const { tenantId } = req.user as any;
    const { id } = req.params as any;
    const { name, description, trigger, conditions, actions, isActive } = req.body as any;

    const existing = await db.query.automations.findFirst({
      where: and(eq(automations.id, id), eq(automations.tenantId, tenantId)),
    });
    if (!existing) return reply.code(404).send({ error: "Automação não encontrada" });

    const patch: any = { updatedAt: new Date() };
    if (name !== undefined) patch.name = name.trim();
    if (description !== undefined) patch.description = description?.trim() || null;
    if (trigger !== undefined) patch.trigger = trigger;
    if (conditions !== undefined) patch.conditions = conditions;
    if (actions !== undefined) patch.actions = actions;
    if (isActive !== undefined) patch.isActive = isActive;

    const [updated] = await db.update(automations)
      .set(patch)
      .where(and(eq(automations.id, id), eq(automations.tenantId, tenantId)))
      .returning();

    return { automation: updated };
  });

  // ── Toggle active ──
  app.patch("/:id/toggle", async (req, reply) => {
    const { tenantId } = req.user as any;
    const { id } = req.params as any;

    const existing = await db.query.automations.findFirst({
      where: and(eq(automations.id, id), eq(automations.tenantId, tenantId)),
    });
    if (!existing) return reply.code(404).send({ error: "Automação não encontrada" });

    const [updated] = await db.update(automations)
      .set({ isActive: !existing.isActive, updatedAt: new Date() })
      .where(and(eq(automations.id, id), eq(automations.tenantId, tenantId)))
      .returning();

    return { automation: updated };
  });

  // ── Delete ──
  app.delete("/:id", async (req, reply) => {
    const { tenantId } = req.user as any;
    const { id } = req.params as any;

    const existing = await db.query.automations.findFirst({
      where: and(eq(automations.id, id), eq(automations.tenantId, tenantId)),
    });
    if (!existing) return reply.code(404).send({ error: "Automação não encontrada" });

    await db.delete(automations)
      .where(and(eq(automations.id, id), eq(automations.tenantId, tenantId)));

    return { deleted: true };
  });
}
