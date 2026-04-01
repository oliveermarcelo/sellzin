// @ts-nocheck
import { FastifyInstance } from "fastify";
import { db } from "../../lib/db";
import { tenants, contacts, trackingEvents } from "../../lib/db/schema";
import { eq, and, or, sql } from "drizzle-orm";

export async function trackingRoutes(app: FastifyInstance) {

  // ── Public: receive tracking event ──
  // Called from the JS snippet installed on the merchant's website
  app.post("/", async (req, reply) => {
    // Allow all origins for the tracking pixel
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type");

    const { tenantKey, visitorId, event, productSku, productName, productPrice, url, email, phone, metadata } = req.body as any;

    if (!tenantKey || !visitorId || !event) return reply.code(200).send({ ok: false });

    // Find tenant by API key
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.apiKey, tenantKey),
    });
    if (!tenant || !tenant.isActive) return reply.code(200).send({ ok: false });

    // Identify contact by email or phone
    let contactId: string | null = null;
    if (email || phone) {
      const conditions = [];
      if (email) conditions.push(eq(contacts.email, email));
      if (phone) conditions.push(eq(contacts.phone, phone));
      const contact = await db.query.contacts.findFirst({
        where: and(eq(contacts.tenantId, tenant.id), or(...conditions)),
      });
      contactId = contact?.id || null;

      // On "identify" event: retroactively link all previous events from this visitor
      if (event === "identify" && contactId) {
        await db.execute(sql`
          UPDATE tracking_events
          SET contact_id = ${contactId}
          WHERE tenant_id = ${tenant.id}
            AND visitor_id = ${visitorId}
            AND contact_id IS NULL
        `);
        return reply.code(200).send({ ok: true, identified: true });
      }
    }

    await db.insert(trackingEvents).values({
      tenantId: tenant.id,
      visitorId,
      contactId,
      event,
      productSku: productSku || null,
      productName: productName || null,
      productPrice: productPrice || null,
      url: url || null,
      email: email || null,
      phone: phone || null,
      metadata: metadata || {},
    });

    return reply.code(200).send({ ok: true });
  });

  // CORS preflight
  app.options("/", async (req, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type");
    return reply.code(204).send();
  });

  // ── Authenticated: live visitors (last 10 min) ──
  app.get("/live", { preHandler: [app.authenticate] }, async (req) => {
    const { tenantId } = req.user as any;

    const result = await db.execute(sql`
      SELECT
        te.visitor_id,
        MAX(te.created_at)                                    AS last_seen,
        COUNT(*)                                              AS page_views,
        MAX(te.url)                                           AS last_url,
        MAX(te.email)                                         AS email,
        MAX(te.product_name)                                  AS last_product,
        BOOL_OR(te.event = 'added_to_cart')                   AS has_cart,
        BOOL_OR(te.event = 'viewed_product')                  AS has_product_view,
        c.first_name,
        c.last_name,
        c.phone
      FROM tracking_events te
      LEFT JOIN contacts c ON c.id = te.contact_id
      WHERE te.tenant_id = ${tenantId}
        AND te.created_at > NOW() - INTERVAL '10 minutes'
      GROUP BY te.visitor_id, c.first_name, c.last_name, c.phone
      ORDER BY last_seen DESC
      LIMIT 50
    `);

    return { visitors: result, total: (result as any[]).length };
  });

  // ── Authenticated: recent events ──
  app.get("/events", { preHandler: [app.authenticate] }, async (req) => {
    const { tenantId } = req.user as any;
    const query = req.query as any;
    const eventFilter = query.event;

    const result = await db.execute(sql`
      SELECT
        te.*,
        c.first_name,
        c.last_name,
        c.phone AS contact_phone
      FROM tracking_events te
      LEFT JOIN contacts c ON c.id = te.contact_id
      WHERE te.tenant_id = ${tenantId}
        ${eventFilter ? sql`AND te.event = ${eventFilter}` : sql``}
      ORDER BY te.created_at DESC
      LIMIT 200
    `);

    return { events: result };
  });

  // ── Authenticated: stats ──
  app.get("/stats", { preHandler: [app.authenticate] }, async (req) => {
    const { tenantId } = req.user as any;

    const [stats] = await db.execute(sql`
      SELECT
        COUNT(DISTINCT visitor_id)                                                      AS unique_visitors,
        COUNT(DISTINCT visitor_id) FILTER (WHERE created_at > NOW() - INTERVAL '10 minutes') AS live_now,
        COUNT(*) FILTER (WHERE event = 'viewed_product' AND created_at > NOW() - INTERVAL '24 hours') AS product_views_24h,
        COUNT(*) FILTER (WHERE event = 'added_to_cart'  AND created_at > NOW() - INTERVAL '24 hours') AS cart_events_24h,
        COUNT(*) FILTER (WHERE event = 'active_on_site' AND created_at > NOW() - INTERVAL '24 hours') AS page_views_24h
      FROM tracking_events
      WHERE tenant_id = ${tenantId}
        AND created_at > NOW() - INTERVAL '7 days'
    `);

    return { stats };
  });
}
