// @ts-nocheck
import { FastifyInstance } from "fastify";
import { db } from "../../lib/db";
import { orders } from "../../lib/db/schema";
import { eq, and, sql, desc, count, between } from "drizzle-orm";
import dayjs from "dayjs";

export async function orderRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // ── List orders ──
  app.get("/", async (request) => {
    const { tenantId } = request.user as any;
    const query = request.query as any;
    const page = parseInt(query.page || "1");
    const limit = Math.min(parseInt(query.limit || "25"), 100);
    const offset = (page - 1) * limit;

    const conditions = [eq(orders.tenantId, tenantId)];

    if (query.status) conditions.push(eq(orders.status, query.status));
    if (query.storeId) conditions.push(eq(orders.storeId, query.storeId));
    if (query.period === "today") {
      conditions.push(sql`${orders.placedAt}::date = CURRENT_DATE`);
    } else if (query.period === "week") {
      conditions.push(sql`${orders.placedAt} > NOW() - INTERVAL '7 days'`);
    } else if (query.period === "month") {
      conditions.push(sql`${orders.placedAt} > NOW() - INTERVAL '30 days'`);
    }

    const where = and(...conditions);

    const [result, [{ total }]] = await Promise.all([
      db.query.orders.findMany({
        where,
        limit,
        offset,
        orderBy: [desc(orders.placedAt)],
        with: { contact: { columns: { firstName: true, lastName: true, email: true } } },
      }),
      db.select({ total: count() }).from(orders).where(where),
    ]);

    return {
      orders: result,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  });

  // ── Order stats ──
  app.get("/stats", async (request) => {
    const { tenantId } = request.user as any;
    const query = request.query as any;

    let dateFilter = sql`${orders.placedAt} > NOW() - INTERVAL '30 days'`;
    if (query.period === "today") dateFilter = sql`${orders.placedAt}::date = CURRENT_DATE`;
    else if (query.period === "week") dateFilter = sql`${orders.placedAt} > NOW() - INTERVAL '7 days'`;

    const stats = await db
      .select({
        totalOrders: count(),
        totalRevenue: sql<number>`COALESCE(SUM(${orders.total}::numeric), 0)`,
        avgOrderValue: sql<number>`COALESCE(AVG(${orders.total}::numeric), 0)`,
        pendingShipment: sql<number>`COUNT(*) FILTER (WHERE ${orders.status} = 'processing')`,
      })
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), dateFilter));

    return { stats: stats[0] };
  });

  // ── Order detail ──
  app.get("/:id", async (request, reply) => {
    const { tenantId } = request.user as any;
    const { id } = request.params as any;

    const order = await db.query.orders.findFirst({
      where: and(eq(orders.id, id), eq(orders.tenantId, tenantId)),
      with: {
        contact: true,
        store: { columns: { name: true, platform: true } },
      },
    });

    if (!order) return reply.code(404).send({ error: "Pedido não encontrado" });
    return { order };
  });
}
