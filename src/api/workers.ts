import { Worker, Job } from "bullmq";
import { redisConnection } from "../lib/redis";
import { db } from "../lib/db";
import { contacts, orders, abandonedCarts, webhookLogs, interactions } from "../lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

// ── Webhook Worker ──
const webhookWorker = new Worker("webhooks", async (job: Job) => {
  const { logId, tenantId, storeId, platform, event, payload } = job.data;
  console.log(`[webhook] Processing ${platform}:${event}`);

  try {
    if (platform === "woocommerce") {
      await processWooCommerceWebhook(tenantId, storeId, event, payload);
    } else if (platform === "magento") {
      await processMagentoWebhook(tenantId, storeId, event, payload);
    }

    await db.update(webhookLogs).set({ status: "processed", processedAt: new Date() }).where(eq(webhookLogs.id, logId));
  } catch (err: any) {
    await db.update(webhookLogs).set({ status: "error", error: err.message }).where(eq(webhookLogs.id, logId));
    throw err;
  }
}, { connection: redisConnection, concurrency: 5 });

// ── WhatsApp Worker ──
const whatsappWorker = new Worker("whatsapp", async (job: Job) => {
  const { tenantId, phone, message, contactId } = job.data;
  console.log(`[whatsapp] Sending to ${phone}`);

  const EVOLUTION_URL = process.env.EVOLUTION_API_URL;
  const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY;

  if (!EVOLUTION_URL || !EVOLUTION_KEY) {
    console.warn("[whatsapp] Evolution API not configured");
    return { sent: false, reason: "not_configured" };
  }

  try {
    const response = await fetch(`${EVOLUTION_URL}/message/sendText/sellzin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_KEY },
      body: JSON.stringify({
        number: phone.replace(/\D/g, ""),
        text: message,
      }),
    });

    const result = await response.json();

    if (contactId) {
      await db.insert(interactions).values({
        tenantId, contactId, channel: "whatsapp",
        type: "message_sent", content: message,
        metadata: { evolutionResponse: result },
      });
    }

    return { sent: true, result };
  } catch (err: any) {
    console.error(`[whatsapp] Error: ${err.message}`);
    throw err;
  }
}, { connection: redisConnection, concurrency: 3, limiter: { max: 10, duration: 60000 } });

// ── Recovery Worker ──
const recoveryWorker = new Worker("recovery", async (job: Job) => {
  const { tenantId, cartId, contactId, phone, items, total, checkoutUrl, couponCode } = job.data;
  console.log(`[recovery] Recovering cart ${cartId}`);

  const cart = await db.query.abandonedCarts.findFirst({
    where: and(eq(abandonedCarts.id, cartId), eq(abandonedCarts.isRecovered, false)),
  });
  if (!cart) return { skipped: true, reason: "already_recovered" };

  const itemsList = (items || []).slice(0, 3).map((i: any) => i.name).join(", ");
  const totalFormatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(total) || 0);

  let message = "";
  const attempt = (cart.recoveryAttempts || 0) + 1;

  if (attempt === 1) {
    message = `Oi! 👋 Notei que você deixou alguns itens no carrinho: ${itemsList}. O total era ${totalFormatted}. Quer finalizar? ${checkoutUrl || ""}`;
  } else if (attempt === 2) {
    message = `Ei! Seus itens ainda estão esperando por você 🛒 ${itemsList} por ${totalFormatted}.${couponCode ? ` Use o cupom ${couponCode} para ganhar desconto!` : ""} ${checkoutUrl || ""}`;
  } else {
    message = `Última chance! ⏰ ${itemsList} por ${totalFormatted}.${couponCode ? ` Cupom: ${couponCode}` : " Frete grátis nesta compra!"} ${checkoutUrl || ""}`;
  }

  await db.update(abandonedCarts).set({
    recoveryAttempts: attempt,
    lastAttemptAt: new Date(),
  }).where(eq(abandonedCarts.id, cartId));

  // Queue WhatsApp message
  const { Queue } = await import("bullmq");
  const whatsappQueue = new Queue("whatsapp", { connection: redisConnection });
  await whatsappQueue.add("send-message", { tenantId, phone, message, contactId });

  return { sent: true, attempt };
}, { connection: redisConnection, concurrency: 2 });

// ── Sync Worker ──
const syncWorker = new Worker("sync", async (job: Job) => {
  const { storeId, tenantId, type } = job.data;
  console.log(`[sync] Syncing store ${storeId} (${type})`);

  const store = await db.query.stores.findFirst({ where: eq(stores.id, storeId) });
  if (!store) return { error: "store_not_found" };

  // Import stores to access it
  const { stores: storesTable } = await import("../lib/db/schema");
  await db.update(storesTable).set({ syncStatus: "syncing" }).where(eq(storesTable.id, storeId));

  try {
    if (store.platform === "woocommerce") {
      await syncWooCommerce(store, tenantId);
    } else if (store.platform === "magento") {
      await syncMagento(store, tenantId);
    }
    await db.update(storesTable).set({ syncStatus: "synced", lastSyncAt: new Date() }).where(eq(storesTable.id, storeId));
  } catch (err: any) {
    await db.update(storesTable).set({ syncStatus: "error" }).where(eq(storesTable.id, storeId));
    throw err;
  }
}, { connection: redisConnection, concurrency: 1 });

// ── Helper: Process WooCommerce Webhook ──
async function processWooCommerceWebhook(tenantId: string, storeId: string, event: string, payload: any) {
  switch (event) {
    case "order.created":
    case "order.updated":
      await upsertOrder(tenantId, storeId, {
        externalId: String(payload.id),
        orderNumber: String(payload.number),
        status: mapWcStatus(payload.status),
        total: payload.total,
        subtotal: payload.subtotal || payload.total,
        discount: payload.discount_total || "0",
        shippingCost: payload.shipping_total || "0",
        paymentMethod: payload.payment_method_title,
        items: (payload.line_items || []).map((i: any) => ({
          name: i.name, sku: i.sku, quantity: i.quantity,
          price: i.price, total: i.total,
        })),
        customerEmail: payload.billing?.email,
        customerPhone: payload.billing?.phone,
        customerFirst: payload.billing?.first_name,
        customerLast: payload.billing?.last_name,
        placedAt: payload.date_created,
      });
      break;
    case "order.deleted":
      break; // Usually we don't delete
  }
}

async function processMagentoWebhook(tenantId: string, storeId: string, event: string, payload: any) {
  // Magento webhook processing
  if (event.startsWith("sales_order")) {
    await upsertOrder(tenantId, storeId, {
      externalId: String(payload.entity_id || payload.increment_id),
      orderNumber: payload.increment_id,
      status: mapMagentoStatus(payload.status),
      total: payload.grand_total,
      subtotal: payload.subtotal,
      discount: Math.abs(parseFloat(payload.discount_amount || "0")).toString(),
      shippingCost: payload.shipping_amount || "0",
      paymentMethod: payload.payment?.method,
      items: (payload.items || []).map((i: any) => ({
        name: i.name, sku: i.sku, quantity: i.qty_ordered,
        price: i.price, total: i.row_total,
      })),
      customerEmail: payload.customer_email,
      customerFirst: payload.customer_firstname,
      customerLast: payload.customer_lastname,
      placedAt: payload.created_at,
    });
  }
}

// ── Helper: Upsert Order & Contact ──
async function upsertOrder(tenantId: string, storeId: string, data: any) {
  // Find or create contact
  let contactId: string | null = null;
  if (data.customerEmail || data.customerPhone) {
    const existing = await db.query.contacts.findFirst({
      where: and(
        eq(contacts.tenantId, tenantId),
        data.customerEmail ? eq(contacts.email, data.customerEmail) : sql`false`
      ),
    });

    if (existing) {
      contactId = existing.id;
    } else {
      const [newContact] = await db.insert(contacts).values({
        tenantId, storeId,
        email: data.customerEmail,
        phone: data.customerPhone,
        firstName: data.customerFirst,
        lastName: data.customerLast,
      }).returning({ id: contacts.id });
      contactId = newContact.id;
    }
  }

  // Upsert order
  await db.insert(orders).values({
    tenantId, storeId, contactId,
    externalId: data.externalId,
    orderNumber: data.orderNumber,
    status: data.status,
    total: data.total,
    subtotal: data.subtotal,
    shippingCost: data.shippingCost,
    discount: data.discount,
    paymentMethod: data.paymentMethod,
    items: data.items,
    placedAt: data.placedAt ? new Date(data.placedAt) : new Date(),
  }).onConflictDoUpdate({
    target: [orders.storeId, orders.externalId],
    set: {
      status: data.status,
      total: data.total,
      updatedAt: new Date(),
    },
  });

  // Update contact aggregates
  if (contactId) {
    await db.execute(sql`
      UPDATE contacts SET
        total_orders = (SELECT COUNT(*) FROM orders WHERE contact_id = ${contactId}),
        total_spent = (SELECT COALESCE(SUM(total::numeric), 0) FROM orders WHERE contact_id = ${contactId}),
        avg_order_value = (SELECT COALESCE(AVG(total::numeric), 0) FROM orders WHERE contact_id = ${contactId}),
        last_order_at = (SELECT MAX(placed_at) FROM orders WHERE contact_id = ${contactId}),
        first_order_at = (SELECT MIN(placed_at) FROM orders WHERE contact_id = ${contactId}),
        updated_at = NOW()
      WHERE id = ${contactId}
    `);
  }
}

// ── Helper: Sync WooCommerce ──
async function syncWooCommerce(store: any, tenantId: string) {
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = `${store.apiUrl}/wp-json/wc/v3/orders?per_page=${perPage}&page=${page}`;
    const auth = Buffer.from(`${store.apiKey}:${store.apiSecret}`).toString("base64");
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!res.ok) throw new Error(`WC API error: ${res.status}`);

    const wcOrders = await res.json();
    if (!wcOrders.length) break;

    for (const order of wcOrders) {
      await upsertOrder(tenantId, store.id, {
        externalId: String(order.id),
        orderNumber: String(order.number),
        status: mapWcStatus(order.status),
        total: order.total,
        subtotal: order.subtotal || order.total,
        discount: order.discount_total || "0",
        shippingCost: order.shipping_total || "0",
        paymentMethod: order.payment_method_title,
        items: (order.line_items || []).map((i: any) => ({
          name: i.name, sku: i.sku, quantity: i.quantity, price: i.price, total: i.total,
        })),
        customerEmail: order.billing?.email,
        customerPhone: order.billing?.phone,
        customerFirst: order.billing?.first_name,
        customerLast: order.billing?.last_name,
        placedAt: order.date_created,
      });
    }

    if (wcOrders.length < perPage) break;
    page++;
  }
}

// ── Helper: Sync Magento ──
async function syncMagento(store: any, tenantId: string) {
  let page = 1;
  const pageSize = 100;

  while (true) {
    const url = `${store.apiUrl}/orders?searchCriteria[pageSize]=${pageSize}&searchCriteria[currentPage]=${page}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${store.apiKey}` } });
    if (!res.ok) throw new Error(`Magento API error: ${res.status}`);

    const data = await res.json();
    const magentoOrders = data.items || [];
    if (!magentoOrders.length) break;

    for (const order of magentoOrders) {
      await upsertOrder(tenantId, store.id, {
        externalId: String(order.entity_id),
        orderNumber: order.increment_id,
        status: mapMagentoStatus(order.status),
        total: order.grand_total,
        subtotal: order.subtotal,
        discount: Math.abs(parseFloat(order.discount_amount || "0")).toString(),
        shippingCost: order.shipping_amount || "0",
        paymentMethod: order.payment?.method,
        items: (order.items || []).map((i: any) => ({
          name: i.name, sku: i.sku, quantity: i.qty_ordered, price: i.price, total: i.row_total,
        })),
        customerEmail: order.customer_email,
        customerFirst: order.customer_firstname,
        customerLast: order.customer_lastname,
        placedAt: order.created_at,
      });
    }

    if (magentoOrders.length < pageSize) break;
    page++;
  }
}

// ── Status Mappers ──
function mapWcStatus(status: string): string {
  const map: Record<string, string> = {
    pending: "pending", processing: "processing", "on-hold": "pending",
    completed: "delivered", cancelled: "cancelled", refunded: "refunded",
    failed: "cancelled", shipped: "shipped",
  };
  return map[status] || "pending";
}

function mapMagentoStatus(status: string): string {
  const map: Record<string, string> = {
    pending: "pending", processing: "processing", complete: "delivered",
    closed: "refunded", canceled: "cancelled", holded: "pending",
    shipped: "shipped",
  };
  return map[status] || "pending";
}

// ── Error handlers ──
[webhookWorker, whatsappWorker, recoveryWorker, syncWorker].forEach(w => {
  w.on("failed", (job, err) => console.error(`[${w.name}] Job ${job?.id} failed:`, err.message));
  w.on("completed", (job) => console.log(`[${w.name}] Job ${job.id} completed`));
});

console.log("🔄 Workers iniciados: webhooks, whatsapp, recovery, sync");
