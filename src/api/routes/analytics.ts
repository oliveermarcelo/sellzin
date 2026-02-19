// @ts-nocheck
import { FastifyInstance } from "fastify";
import { db } from "../../lib/db";
import { orders, contacts, abandonedCarts } from "../../lib/db/schema";
import { eq, sql, count } from "drizzle-orm";

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // ── Overview dashboard ──
  app.get("/overview", async (request) => {
    const { tenantId } = request.user as any;

    const [orderStats] = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(${orders.total}::numeric) FILTER (WHERE ${orders.placedAt} > NOW() - INTERVAL '30 days'), 0)`,
        prevRevenue: sql<number>`COALESCE(SUM(${orders.total}::numeric) FILTER (WHERE ${orders.placedAt} BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days'), 0)`,
        totalOrders: sql<number>`COUNT(*) FILTER (WHERE ${orders.placedAt} > NOW() - INTERVAL '30 days')`,
        avgOrderValue: sql<number>`COALESCE(AVG(${orders.total}::numeric) FILTER (WHERE ${orders.placedAt} > NOW() - INTERVAL '30 days'), 0)`,
      })
      .from(orders)
      .where(eq(orders.tenantId, tenantId));

    const [contactStats] = await db
      .select({
        totalContacts: count(),
        newThisMonth: sql<number>`COUNT(*) FILTER (WHERE ${contacts.createdAt} > NOW() - INTERVAL '30 days')`,
        withRepurchase: sql<number>`COUNT(*) FILTER (WHERE ${contacts.totalOrders} > 1)`,
      })
      .from(contacts)
      .where(eq(contacts.tenantId, tenantId));

    const [cartStats] = await db
      .select({
        abandoned: sql<number>`COUNT(*) FILTER (WHERE ${abandonedCarts.abandonedAt} > NOW() - INTERVAL '30 days')`,
        recovered: sql<number>`COUNT(*) FILTER (WHERE ${abandonedCarts.isRecovered} = true AND ${abandonedCarts.abandonedAt} > NOW() - INTERVAL '30 days')`,
        recoveredValue: sql<number>`COALESCE(SUM(${abandonedCarts.total}::numeric) FILTER (WHERE ${abandonedCarts.isRecovered} = true AND ${abandonedCarts.abandonedAt} > NOW() - INTERVAL '30 days'), 0)`,
      })
      .from(abandonedCarts)
      .where(eq(abandonedCarts.tenantId, tenantId));

    const revenueChange = orderStats.prevRevenue > 0
      ? (((orderStats.totalRevenue - orderStats.prevRevenue) / orderStats.prevRevenue) * 100).toFixed(1)
      : "0";

    const repurchaseRate = contactStats.totalContacts > 0
      ? ((contactStats.withRepurchase / contactStats.totalContacts) * 100).toFixed(1)
      : "0";

    return {
      revenue: { current: orderStats.totalRevenue, change: revenueChange },
      orders: { total: orderStats.totalOrders, avgValue: orderStats.avgOrderValue },
      contacts: { total: contactStats.totalContacts, new: contactStats.newThisMonth, repurchaseRate },
      recovery: { ...cartStats },
    };
  });

  // ── RFM distribution ──
  app.get("/rfm", async (request) => {
    const { tenantId } = request.user as any;

    const segments = await db
      .select({
        segment: contacts.rfmSegment,
        count: count(),
        totalSpent: sql<number>`COALESCE(SUM(${contacts.totalSpent}::numeric), 0)`,
        avgOrders: sql<number>`COALESCE(AVG(${contacts.totalOrders}), 0)`,
      })
      .from(contacts)
      .where(eq(contacts.tenantId, tenantId))
      .groupBy(contacts.rfmSegment);

    return { segments };
  });

  // ── Top products ──
  app.get("/products/top", async (request) => {
    const { tenantId } = request.user as any;
    const query = request.query as any;
    const limit = parseInt(query.limit || "10");

    // Items are stored as JSONB array in orders
    const result = await db.execute(sql`
      SELECT
        item->>'name' as name,
        item->>'sku' as sku,
        COUNT(*) as order_count,
        SUM((item->>'quantity')::int) as total_quantity,
        SUM((item->>'total')::numeric) as total_revenue
      FROM orders, jsonb_array_elements(items) as item
      WHERE tenant_id = ${tenantId}
        AND placed_at > NOW() - INTERVAL '30 days'
      GROUP BY item->>'name', item->>'sku'
      ORDER BY total_revenue DESC
      LIMIT ${limit}
    `);

    return { products: result };
  });

  // ── Revenue over time (for charts) ──
  app.get("/revenue", async (request) => {
    const { tenantId } = request.user as any;
    const query = request.query as any;
    const groupBy = query.group || "day"; // day, week, month

    const interval = groupBy === "month" ? "month" : groupBy === "week" ? "week" : "day";

    const result = await db.execute(sql`
      SELECT
        DATE_TRUNC(${sql.raw(`'${interval}'`)}, placed_at) as period,
        COUNT(*) as orders,
        COALESCE(SUM(total::numeric), 0) as revenue,
        COALESCE(AVG(total::numeric), 0) as avg_order_value
      FROM orders
      WHERE tenant_id = ${tenantId}
        AND placed_at > NOW() - INTERVAL '90 days'
      GROUP BY DATE_TRUNC(${sql.raw(`'${interval}'`)}, placed_at)
      ORDER BY period ASC
    `);

    return { data: result };
  });

  // ── Compare periods ──
  app.get("/compare", async (request) => {
    const { tenantId } = request.user as any;

    const result = await db.execute(sql`
      SELECT
        'current' as period,
        COUNT(*) as orders,
        COALESCE(SUM(total::numeric), 0) as revenue,
        COALESCE(AVG(total::numeric), 0) as avg_value
      FROM orders
      WHERE tenant_id = ${tenantId} AND placed_at > NOW() - INTERVAL '7 days'
      UNION ALL
      SELECT
        'previous' as period,
        COUNT(*) as orders,
        COALESCE(SUM(total::numeric), 0) as revenue,
        COALESCE(AVG(total::numeric), 0) as avg_value
      FROM orders
      WHERE tenant_id = ${tenantId}
        AND placed_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
    `);

    return { comparison: result };
  });
}
