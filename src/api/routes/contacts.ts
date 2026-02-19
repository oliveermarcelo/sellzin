// @ts-nocheck
import { FastifyInstance } from "fastify";
import { db } from "../../lib/db";
import { contacts } from "../../lib/db/schema";
import { eq, and, sql, ilike, or, lt, desc, count } from "drizzle-orm";

export async function contactRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // ── List contacts ──
  app.get("/", async (request) => {
    const { tenantId } = request.user as any;
    const query = request.query as any;
    const page = parseInt(query.page || "1");
    const limit = Math.min(parseInt(query.limit || "25"), 100);
    const offset = (page - 1) * limit;

    const conditions = [eq(contacts.tenantId, tenantId)];

    if (query.segment) {
      conditions.push(eq(contacts.rfmSegment, query.segment));
    }
    if (query.tag) {
      conditions.push(sql`${contacts.tags} @> ${JSON.stringify([query.tag])}`);
    }
    if (query.inactive_days) {
      const cutoff = new Date(Date.now() - parseInt(query.inactive_days) * 86400000);
      conditions.push(
        or(lt(contacts.lastOrderAt, cutoff), sql`${contacts.lastOrderAt} IS NULL`)!
      );
    }

    const where = and(...conditions);

    const [result, [{ total }]] = await Promise.all([
      db.query.contacts.findMany({
        where,
        limit,
        offset,
        orderBy: [desc(contacts.updatedAt)],
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          rfmSegment: true,
          rfmScore: true,
          totalOrders: true,
          totalSpent: true,
          lastOrderAt: true,
          tags: true,
          city: true,
          state: true,
          createdAt: true,
        },
      }),
      db.select({ total: count() }).from(contacts).where(where),
    ]);

    return {
      contacts: result,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  });

  // ── Search contacts ──
  app.get("/search", async (request) => {
    const { tenantId } = request.user as any;
    const { q } = request.query as any;
    if (!q || q.length < 2) return { contacts: [] };

    const result = await db.query.contacts.findMany({
      where: and(
        eq(contacts.tenantId, tenantId),
        or(
          ilike(contacts.email, `%${q}%`),
          ilike(contacts.firstName, `%${q}%`),
          ilike(contacts.lastName, `%${q}%`),
          ilike(contacts.phone, `%${q}%`)
        )
      ),
      limit: 20,
    });

    return { contacts: result };
  });

  // ── Contact stats ──
  app.get("/stats", async (request) => {
    const { tenantId } = request.user as any;

    const stats = await db
      .select({
        total: count(),
        newThisWeek: sql<number>`COUNT(*) FILTER (WHERE ${contacts.createdAt} > NOW() - INTERVAL '7 days')`,
        newThisMonth: sql<number>`COUNT(*) FILTER (WHERE ${contacts.createdAt} > NOW() - INTERVAL '30 days')`,
        withOrders: sql<number>`COUNT(*) FILTER (WHERE ${contacts.totalOrders} > 0)`,
        optedIn: sql<number>`COUNT(*) FILTER (WHERE ${contacts.isOptedIn} = true)`,
      })
      .from(contacts)
      .where(eq(contacts.tenantId, tenantId));

    return { stats: stats[0] };
  });

  // ── RFM Segments ──
  app.get("/segments", async (request) => {
    const { tenantId } = request.user as any;

    const segments = await db
      .select({
        segment: contacts.rfmSegment,
        count: count(),
        avgSpent: sql<number>`AVG(${contacts.totalSpent}::numeric)`,
        avgOrders: sql<number>`AVG(${contacts.totalOrders})`,
      })
      .from(contacts)
      .where(eq(contacts.tenantId, tenantId))
      .groupBy(contacts.rfmSegment);

    return { segments };
  });

  // ── Contact detail ──
  app.get("/:id", async (request, reply) => {
    const { tenantId } = request.user as any;
    const { id } = request.params as any;

    const contact = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)),
      with: {
        orders: { limit: 10, orderBy: (orders, { desc }) => [desc(orders.placedAt)] },
        interactions: { limit: 20, orderBy: (i, { desc }) => [desc(i.createdAt)] },
      },
    });

    if (!contact) return reply.code(404).send({ error: "Contato não encontrado" });
    return { contact };
  });

  // ── Bulk tag ──
  app.post("/bulk-tag", async (request) => {
    const { tenantId } = request.user as any;
    const { contactIds, tag, action } = request.body as any;

    // action: "add" | "remove"
    if (action === "add") {
      await db.execute(sql`
        UPDATE contacts
        SET tags = tags || ${JSON.stringify([tag])}::jsonb
        WHERE tenant_id = ${tenantId}
          AND id = ANY(${contactIds}::uuid[])
          AND NOT tags @> ${JSON.stringify([tag])}::jsonb
      `);
    } else {
      await db.execute(sql`
        UPDATE contacts
        SET tags = tags - ${tag}
        WHERE tenant_id = ${tenantId}
          AND id = ANY(${contactIds}::uuid[])
      `);
    }

    return { message: `Tag "${tag}" ${action === "add" ? "adicionada" : "removida"}` };
  });
}
