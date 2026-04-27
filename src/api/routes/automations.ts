// @ts-nocheck
import { FastifyInstance } from "fastify";
import { db } from "../../lib/db";
import { automations, automationRuns, contacts } from "../../lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { triggerAutomations } from "../services/trigger";

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

  // ── GET /runs/recent — últimas execuções (must be before /:id routes) ──
  app.get("/runs/recent", async (req) => {
    const { tenantId } = req.user as any;

    const rows = await db.execute(sql`
      SELECT ar.id, ar.automation_id, ar.contact_id, ar.status, ar.current_step,
             ar.started_at, ar.completed_at, ar.error,
             a.name as automation_name, a.trigger as automation_trigger,
             c.first_name, c.last_name, c.email as contact_email
      FROM automation_runs ar
      LEFT JOIN automations a ON a.id = ar.automation_id
      LEFT JOIN contacts c ON c.id = ar.contact_id
      WHERE ar.tenant_id = ${tenantId}
      ORDER BY ar.started_at DESC
      LIMIT 100
    `);

    const runs = Array.isArray(rows) ? rows : (rows as any).rows || [];
    return { runs };
  });

  // ── POST /:id/run — manual trigger ──
  app.post("/:id/run", async (req, reply) => {
    const { tenantId } = req.user as any;
    const { id } = req.params as any;
    const { contactId } = req.body as any;

    const automation = await db.query.automations.findFirst({
      where: and(eq(automations.id, id), eq(automations.tenantId, tenantId)),
    });
    if (!automation) return reply.code(404).send({ error: "Automação não encontrada" });

    let phone: string | null = null;
    let name = "";
    let ctx: Record<string, any> = {};

    if (contactId) {
      const contact = await db.query.contacts.findFirst({
        where: and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)),
      });
      if (contact) {
        phone = contact.phone || null;
        name = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email || "";
        ctx = { nome: name, name, email: contact.email || "", total: "0" };
      }
    }

    await triggerAutomations(tenantId, automation.trigger, contactId || null, phone, ctx);
    return { ok: true };
  });

  // ── GET /:id/runs — run history ──
  app.get("/:id/runs", async (req, reply) => {
    const { tenantId } = req.user as any;
    const { id } = req.params as any;

    const existing = await db.query.automations.findFirst({
      where: and(eq(automations.id, id), eq(automations.tenantId, tenantId)),
    });
    if (!existing) return reply.code(404).send({ error: "Automação não encontrada" });

    const runs = await db.query.automationRuns.findMany({
      where: and(
        eq(automationRuns.automationId, id),
        eq(automationRuns.tenantId, tenantId),
      ),
      orderBy: [desc(automationRuns.startedAt)],
      limit: 50,
    });

    return { runs };
  });

}
