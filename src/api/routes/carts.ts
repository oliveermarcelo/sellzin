import { FastifyInstance } from "fastify";
import { db } from "../../lib/db";
import { abandonedCarts } from "../../lib/db/schema";
import { eq, and, sql, desc, count } from "drizzle-orm";
import { addRecoveryJob } from "../../lib/queues";

export async function cartRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // ── List abandoned carts ──
  app.get("/abandoned", async (request) => {
    const { tenantId } = request.user as any;
    const query = request.query as any;
    const page = parseInt(query.page || "1");
    const limit = Math.min(parseInt(query.limit || "25"), 100);

    const result = await db.query.abandonedCarts.findMany({
      where: and(
        eq(abandonedCarts.tenantId, tenantId),
        eq(abandonedCarts.isRecovered, false)
      ),
      limit,
      offset: (page - 1) * limit,
      orderBy: [desc(abandonedCarts.abandonedAt)],
      with: { contact: { columns: { firstName: true, lastName: true, email: true, phone: true } } },
    });

    return { carts: result };
  });

  // ── Abandoned cart stats ──
  app.get("/abandoned/stats", async (request) => {
    const { tenantId } = request.user as any;

    const stats = await db
      .select({
        total: count(),
        totalValue: sql<number>`COALESCE(SUM(${abandonedCarts.total}::numeric), 0)`,
        recovered: sql<number>`COUNT(*) FILTER (WHERE ${abandonedCarts.isRecovered} = true)`,
        recoveredValue: sql<number>`COALESCE(SUM(${abandonedCarts.total}::numeric) FILTER (WHERE ${abandonedCarts.isRecovered} = true), 0)`,
        todayAbandoned: sql<number>`COUNT(*) FILTER (WHERE ${abandonedCarts.abandonedAt}::date = CURRENT_DATE)`,
        todayValue: sql<number>`COALESCE(SUM(${abandonedCarts.total}::numeric) FILTER (WHERE ${abandonedCarts.abandonedAt}::date = CURRENT_DATE), 0)`,
      })
      .from(abandonedCarts)
      .where(and(
        eq(abandonedCarts.tenantId, tenantId),
        sql`${abandonedCarts.abandonedAt} > NOW() - INTERVAL '30 days'`
      ));

    const s = stats[0];
    const recoveryRate = s.total > 0 ? ((s.recovered / s.total) * 100).toFixed(1) : "0";

    return { stats: { ...s, recoveryRate } };
  });

  // ── Conversion stats ──
  app.get("/abandoned/conversion", async (request) => {
    const { tenantId } = request.user as any;

    const monthly = await db.execute(sql`
      SELECT
        DATE_TRUNC('month', abandoned_at) as month,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_recovered = true) as recovered,
        COALESCE(SUM(total::numeric) FILTER (WHERE is_recovered = true), 0) as recovered_value
      FROM abandoned_carts
      WHERE tenant_id = ${tenantId}
        AND abandoned_at > NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', abandoned_at)
      ORDER BY month DESC
    `);

    return { conversion: monthly };
  });

  // ── Trigger recovery ──
  app.post("/abandoned/recover", async (request) => {
    const { tenantId } = request.user as any;
    const { cartIds, couponCode, message } = request.body as any;

    const carts = await db.query.abandonedCarts.findMany({
      where: and(
        eq(abandonedCarts.tenantId, tenantId),
        eq(abandonedCarts.isRecovered, false),
        cartIds ? sql`id = ANY(${cartIds}::uuid[])` : sql`abandoned_at::date = CURRENT_DATE - 1`
      ),
      with: { contact: true },
    });

    let queued = 0;
    for (const cart of carts) {
      if (cart.contact?.phone) {
        await addRecoveryJob({
          tenantId,
          cartId: cart.id,
          contactId: cart.contactId,
          phone: cart.contact.phone,
          items: cart.items,
          total: cart.total,
          checkoutUrl: cart.checkoutUrl,
          couponCode,
          customMessage: message,
        });
        queued++;
      }
    }

    return { message: `${queued} recuperações agendadas`, queued };
  });
}
