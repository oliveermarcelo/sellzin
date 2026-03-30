// @ts-nocheck
import { FastifyInstance } from "fastify";
import { db } from "../../lib/db";
import { tenants, orders, contacts, stores, whatsappChannels } from "../../lib/db/schema";
import { eq, sql, count, desc } from "drizzle-orm";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@sellzin.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "sellzin@admin2024";

export async function adminRoutes(app: FastifyInstance) {

  // ── Admin auth middleware ──
  const adminAuth = async (req: any, reply: any) => {
    try {
      await req.jwtVerify();
      if (!req.user?.isAdmin) return reply.code(403).send({ error: "Acesso negado" });
    } catch {
      return reply.code(401).send({ error: "Não autorizado" });
    }
  };

  // ── Login ──
  app.post("/login", async (req, reply) => {
    const { email, password } = req.body as any;
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return reply.code(401).send({ error: "Credenciais inválidas" });
    }
    const token = app.jwt.sign({ isAdmin: true, email }, { expiresIn: "12h" });
    return { token, admin: { email } };
  });

  // ── Global stats ──
  app.get("/stats", { preHandler: [adminAuth] }, async (req, reply) => {
    const [tenantStats] = await db.select({
      total: count(),
      active: sql<number>`COUNT(*) FILTER (WHERE is_active = true)`,
      starter: sql<number>`COUNT(*) FILTER (WHERE plan = 'starter')`,
      growth: sql<number>`COUNT(*) FILTER (WHERE plan = 'growth')`,
      enterprise: sql<number>`COUNT(*) FILTER (WHERE plan = 'enterprise')`,
      newThisMonth: sql<number>`COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')`,
    }).from(tenants);

    const [orderStats] = await db.select({
      total: count(),
      revenue: sql<number>`COALESCE(SUM(total::numeric), 0)`,
      revenueThisMonth: sql<number>`COALESCE(SUM(total::numeric) FILTER (WHERE placed_at > NOW() - INTERVAL '30 days'), 0)`,
    }).from(orders);

    const [contactStats] = await db.select({
      total: count(),
    }).from(contacts);

    const [storeStats] = await db.select({
      total: count(),
    }).from(stores);

    return {
      tenants: tenantStats,
      orders: orderStats,
      contacts: contactStats,
      stores: storeStats,
    };
  });

  // ── List tenants ──
  app.get("/tenants", { preHandler: [adminAuth] }, async (req, reply) => {
    const query = req.query as any;
    const page = parseInt(query.page || "1");
    const limit = 20;
    const offset = (page - 1) * limit;

    const allTenants = await db.select({
      id: tenants.id,
      name: tenants.name,
      email: tenants.email,
      plan: tenants.plan,
      isActive: tenants.isActive,
      trialEndsAt: tenants.trialEndsAt,
      createdAt: tenants.createdAt,
    }).from(tenants).orderBy(desc(tenants.createdAt)).limit(limit).offset(offset);

    // Get per-tenant stats
    const enriched = await Promise.all(allTenants.map(async (t) => {
      const [stats] = await db.select({
        orders: sql<number>`COUNT(*)`,
        revenue: sql<number>`COALESCE(SUM(total::numeric), 0)`,
      }).from(orders).where(eq(orders.tenantId, t.id));

      const [cs] = await db.select({ count: count() }).from(contacts).where(eq(contacts.tenantId, t.id));
      const [ss] = await db.select({ count: count() }).from(stores).where(eq(stores.tenantId, t.id));

      return { ...t, stats: { orders: stats.orders, revenue: stats.revenue, contacts: cs.count, stores: ss.count } };
    }));

    const [{ total }] = await db.select({ total: count() }).from(tenants);

    return {
      tenants: enriched,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    };
  });

  // ── Get tenant ──
  app.get("/tenants/:id", { preHandler: [adminAuth] }, async (req, reply) => {
    const { id } = req.params as any;
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, id) });
    if (!tenant) return reply.code(404).send({ error: "Tenant não encontrado" });
    const { passwordHash, ...safe } = tenant;
    return { tenant: safe };
  });

  // ── Update tenant ──
  app.patch("/tenants/:id", { preHandler: [adminAuth] }, async (req, reply) => {
    const { id } = req.params as any;
    const { plan, isActive, trialEndsAt } = req.body as any;

    const update: any = { updatedAt: new Date() };
    if (plan) update.plan = plan;
    if (typeof isActive === "boolean") update.isActive = isActive;
    if (trialEndsAt) update.trialEndsAt = new Date(trialEndsAt);

    await db.update(tenants).set(update).where(eq(tenants.id, id));
    return { updated: true };
  });

  // ── Delete tenant ──
  app.delete("/tenants/:id", { preHandler: [adminAuth] }, async (req, reply) => {
    const { id } = req.params as any;
    await db.delete(tenants).where(eq(tenants.id, id));
    return { deleted: true };
  });

  // ── Impersonate tenant ──
  app.post("/tenants/:id/impersonate", { preHandler: [adminAuth] }, async (req, reply) => {
    const { id } = req.params as any;
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, id) });
    if (!tenant) return reply.code(404).send({ error: "Tenant não encontrado" });
    const token = app.jwt.sign(
      { tenantId: tenant.id, email: tenant.email },
      { expiresIn: "2h" }
    );
    return { token, tenant: { id: tenant.id, name: tenant.name, email: tenant.email } };
  });

  // ── Extend trial ──
  app.post("/tenants/:id/extend-trial", { preHandler: [adminAuth] }, async (req, reply) => {
    const { id } = req.params as any;
    const { days } = req.body as any;
    const trialEndsAt = new Date(Date.now() + (days || 14) * 24 * 60 * 60 * 1000);
    await db.update(tenants).set({ trialEndsAt, updatedAt: new Date() }).where(eq(tenants.id, id));
    return { trialEndsAt };
  });

  // ── Create tenant ──
  app.post("/tenants", { preHandler: [adminAuth] }, async (req, reply) => {
    const { name, email, password, plan } = req.body as any;
    if (!name || !email || !password) return reply.code(400).send({ error: "name, email e password são obrigatórios" });
    const existing = await db.query.tenants.findFirst({ where: eq(tenants.email, email) });
    if (existing) return reply.code(409).send({ error: "Email já cadastrado" });
    const bcrypt = await import("bcryptjs");
    const { nanoid } = await import("nanoid");
    const passwordHash = await bcrypt.hash(password, 12);
    const apiKey = `sk_${nanoid(48)}`;
    const [tenant] = await db.insert(tenants).values({
      name, email, passwordHash, apiKey,
      plan: plan || "starter",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    }).returning({ id: tenants.id, name: tenants.name, email: tenants.email, plan: tenants.plan });
    return reply.code(201).send({ tenant });
  });
}
