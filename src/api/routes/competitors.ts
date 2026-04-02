// @ts-nocheck
import { FastifyInstance } from "fastify";
import { db } from "../../lib/db";
import { products, priceComparisons } from "../../lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

const SERPAPI_KEY = process.env.SERPAPI_KEY || "";

async function searchGoogleShopping(query: string): Promise<any[]> {
  if (!SERPAPI_KEY) throw new Error("SERPAPI_KEY não configurada");

  const params = new URLSearchParams({
    engine: "google_shopping",
    q: query,
    gl: "br",
    hl: "pt",
    api_key: SERPAPI_KEY,
  });

  const res = await fetch(`https://serpapi.com/search?${params}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SerpAPI error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.shopping_results || [];
}

function parseBRPrice(priceStr: string): number | null {
  if (!priceStr) return null;
  // "R$ 1.299,90" → 1299.90
  const cleaned = priceStr.replace(/[^\d,]/g, "").replace(",", ".");
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

export async function competitorRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  // ── GET /v1/competitors — lista comparações mais recentes ──
  app.get("/", async (req) => {
    const { tenantId } = req.user as any;
    const query = req.query as any;
    const limit = parseInt(query.limit || "50");

    // Latest scan per product
    const rows = await db.execute(sql`
      SELECT DISTINCT ON (product_id)
        pc.id, pc.product_id, pc.product_name, pc.product_sku,
        pc.our_price, pc.competitors, pc.lowest_price, pc.lowest_store,
        pc.price_diff, pc.scanned_at
      FROM price_comparisons pc
      WHERE pc.tenant_id = ${tenantId}
      ORDER BY product_id, scanned_at DESC
      LIMIT ${limit}
    `);

    const results = Array.isArray(rows) ? rows : (rows as any).rows || [];

    // Summary stats
    const cheaper = results.filter((r: any) => parseFloat(r.price_diff || 0) > 0).length;
    const moreExpensive = results.filter((r: any) => parseFloat(r.price_diff || 0) < 0).length;
    const equal = results.filter((r: any) => parseFloat(r.price_diff || 0) === 0).length;

    return {
      comparisons: results,
      stats: {
        total: results.length,
        cheaper,          // we are cheaper than lowest competitor
        moreExpensive,    // we are more expensive
        equal,
      },
    };
  });

  // ── POST /v1/competitors/scan — escaneia um produto ──
  app.post("/scan", async (req, reply) => {
    const { tenantId } = req.user as any;
    const { productId, query: customQuery } = req.body as any;

    let product: any = null;
    if (productId) {
      product = await db.query.products.findFirst({
        where: and(eq(products.id, productId), eq(products.tenantId, tenantId)),
      });
      if (!product) return reply.code(404).send({ error: "Produto não encontrado" });
    }

    const searchQuery = customQuery || product?.name;
    if (!searchQuery) return reply.code(400).send({ error: "Informe productId ou query" });

    const results = await searchGoogleShopping(searchQuery);

    // Parse competitor prices
    const competitors = results.slice(0, 10).map((r: any) => ({
      store: r.source || r.seller || "Desconhecido",
      price: parseBRPrice(r.price),
      priceStr: r.price,
      link: r.link || r.product_link,
      title: r.title,
      position: r.position,
      thumbnail: r.thumbnail,
    })).filter((c: any) => c.price !== null);

    const ourPrice = product?.price ? parseFloat(product.price) : null;

    // Find lowest competitor price
    const sorted = [...competitors].sort((a, b) => a.price - b.price);
    const lowest = sorted[0];
    const lowestPrice = lowest?.price ?? null;
    const lowestStore = lowest?.store ?? null;

    // Price diff: positive = we are cheaper, negative = we are more expensive
    const priceDiff = ourPrice && lowestPrice
      ? (((ourPrice - lowestPrice) / lowestPrice) * 100)
      : null;

    const [saved] = await db.insert(priceComparisons).values({
      tenantId,
      productId: product?.id || null,
      productName: product?.name || searchQuery,
      productSku: product?.sku || null,
      ourPrice: ourPrice?.toString() || null,
      competitors,
      lowestPrice: lowestPrice?.toString() || null,
      lowestStore,
      priceDiff: priceDiff?.toFixed(2) || null,
      searchQuery,
    }).returning();

    return { comparison: saved, competitors, total: competitors.length };
  });

  // ── POST /v1/competitors/scan-all — escaneia todos os produtos ──
  app.post("/scan-all", async (req, reply) => {
    const { tenantId } = req.user as any;
    const { limit = 20 } = req.body as any;

    if (!SERPAPI_KEY) return reply.code(400).send({ error: "SERPAPI_KEY não configurada. Adicione ao .env na VPS." });

    const prods = await db.query.products.findMany({
      where: and(eq(products.tenantId, tenantId), eq(products.isActive, true)),
      limit: parseInt(limit),
      orderBy: [desc(products.updatedAt)],
    });

    let scanned = 0;
    let errors = 0;

    for (const product of prods) {
      try {
        const results = await searchGoogleShopping(product.name);
        const competitors = results.slice(0, 10).map((r: any) => ({
          store: r.source || r.seller || "Desconhecido",
          price: parseBRPrice(r.price),
          priceStr: r.price,
          link: r.link || r.product_link,
          title: r.title,
          position: r.position,
          thumbnail: r.thumbnail,
        })).filter((c: any) => c.price !== null);

        const ourPrice = product.price ? parseFloat(product.price) : null;
        const sorted = [...competitors].sort((a, b) => a.price - b.price);
        const lowest = sorted[0];
        const priceDiff = ourPrice && lowest?.price
          ? (((ourPrice - lowest.price) / lowest.price) * 100)
          : null;

        await db.insert(priceComparisons).values({
          tenantId,
          productId: product.id,
          productName: product.name,
          productSku: product.sku || null,
          ourPrice: ourPrice?.toString() || null,
          competitors,
          lowestPrice: lowest?.price?.toString() || null,
          lowestStore: lowest?.store || null,
          priceDiff: priceDiff?.toFixed(2) || null,
          searchQuery: product.name,
        });

        scanned++;

        // Rate limit: 1 req/s to avoid SerpAPI throttling
        await new Promise(r => setTimeout(r, 1200));
      } catch (e: any) {
        console.error(`[competitors] Error scanning ${product.name}:`, e.message);
        errors++;
      }
    }

    return { scanned, errors, total: prods.length };
  });

  // ── GET /v1/competitors/history/:productId ──
  app.get("/history/:productId", async (req) => {
    const { tenantId } = req.user as any;
    const { productId } = req.params as any;

    const history = await db.query.priceComparisons.findMany({
      where: and(
        eq(priceComparisons.tenantId, tenantId),
        eq(priceComparisons.productId, productId),
      ),
      orderBy: [desc(priceComparisons.scannedAt)],
      limit: 30,
    });

    return { history };
  });
}
