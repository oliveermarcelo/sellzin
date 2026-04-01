// @ts-nocheck
import { FastifyInstance } from "fastify";
import { db } from "../../lib/db";
import { products, stores } from "../../lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function productRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // ── List products ──
  app.get("/", async (req) => {
    const { tenantId } = req.user as any;
    const query = req.query as any;
    const result = await db.query.products.findMany({
      where: and(eq(products.tenantId, tenantId), eq(products.isActive, true)),
      orderBy: [desc(products.updatedAt)],
      limit: parseInt(query.limit || "200"),
    });
    return { products: result };
  });

  // ── Sync catalog from store ──
  app.post("/sync/:storeId", async (req, reply) => {
    const { tenantId } = req.user as any;
    const { storeId } = req.params as any;

    const store = await db.query.stores.findFirst({
      where: and(eq(stores.id, storeId), eq(stores.tenantId, tenantId)),
    });
    if (!store) return reply.code(404).send({ error: "Loja não encontrada" });

    let synced = 0;
    let page = 1;
    const pageSize = 50;

    try {
      if (store.platform === "magento") {
        let hasMore = true;
        // Normalize: strip /rest/V1 suffix if user entered full API path
        const base = store.apiUrl.replace(/\/$/, "").replace(/\/rest\/V1$/, "");

        while (hasMore && page <= 20) {
          // Filter: status=enabled AND visibility in [2,3,4] (Catalog / Search / Catalog+Search)
          // This excludes child/variation products (visibility=1 = Not Visible Individually)
          const url = `${base}/rest/V1/products?searchCriteria[pageSize]=${pageSize}&searchCriteria[currentPage]=${page}&searchCriteria[filter_groups][0][filters][0][field]=status&searchCriteria[filter_groups][0][filters][0][value]=1&searchCriteria[filter_groups][0][filters][0][conditionType]=eq&searchCriteria[filter_groups][1][filters][0][field]=visibility&searchCriteria[filter_groups][1][filters][0][value]=2,3,4&searchCriteria[filter_groups][1][filters][0][conditionType]=in`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${store.apiKey}` },
          });
          if (!res.ok) {
            const err = await res.text();
            throw new Error(`Magento API ${res.status}: ${err.slice(0, 200)}`);
          }
          const data = await res.json();

          for (const item of data.items || []) {
            const imgEntry = item.media_gallery_entries?.find((e: any) => e.types?.includes("image")) || item.media_gallery_entries?.[0];
            const imageUrl = imgEntry?.file ? `${base}/pub/media/catalog/product${imgEntry.file}` : null;
            const urlKey = item.custom_attributes?.find((a: any) => a.attribute_code === "url_key")?.value;
            const productUrl = urlKey ? `${base}/${urlKey}.html` : null;

            await db.insert(products).values({
              tenantId, storeId: store.id,
              externalId: String(item.id),
              sku: item.sku || null,
              name: item.name,
              price: item.price?.toString() || "0",
              imageUrl, url: productUrl,
            }).onConflictDoUpdate({
              target: [products.storeId, products.externalId],
              set: { name: item.name, price: item.price?.toString() || "0", imageUrl, url: productUrl, updatedAt: new Date() },
            });
            synced++;
          }

          hasMore = (data.items?.length || 0) === pageSize && synced < (data.total_count || 0);
          page++;
        }
      } else if (store.platform === "woocommerce") {
        let hasMore = true;
        const base = store.apiUrl.replace(/\/$/, "");
        const auth = Buffer.from(`${store.apiKey}:${store.apiSecret || ""}`).toString("base64");

        while (hasMore && page <= 20) {
          const url = `${base}/wp-json/wc/v3/products?per_page=${pageSize}&page=${page}&status=publish`;
          const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
          if (!res.ok) {
            const err = await res.text();
            throw new Error(`WooCommerce API ${res.status}: ${err.slice(0, 200)}`);
          }
          const data = await res.json();
          if (!Array.isArray(data) || data.length === 0) { hasMore = false; break; }

          for (const item of data) {
            await db.insert(products).values({
              tenantId, storeId: store.id,
              externalId: String(item.id),
              sku: item.sku || null,
              name: item.name,
              price: item.price || "0",
              imageUrl: item.images?.[0]?.src || null,
              url: item.permalink || null,
            }).onConflictDoUpdate({
              target: [products.storeId, products.externalId],
              set: { name: item.name, price: item.price || "0", imageUrl: item.images?.[0]?.src || null, url: item.permalink || null, updatedAt: new Date() },
            });
            synced++;
          }

          hasMore = data.length === pageSize;
          page++;
        }
      }

      await db.update(stores)
        .set({ syncStatus: "synced", lastSyncAt: new Date(), updatedAt: new Date() })
        .where(eq(stores.id, storeId));

      return { synced };
    } catch (e: any) {
      await db.update(stores)
        .set({ syncStatus: "error", updatedAt: new Date() })
        .where(eq(stores.id, storeId));
      return reply.code(400).send({ error: e?.message || "Erro ao sincronizar catálogo" });
    }
  });
}
