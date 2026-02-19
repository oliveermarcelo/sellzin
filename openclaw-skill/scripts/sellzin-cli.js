#!/usr/bin/env node
/**
 * Sellzin CRM CLI — Helper script for OpenClaw skill
 * Usage: node sellzin-cli.js <command> [args...]
 *
 * Commands:
 *   overview              - Business overview
 *   contacts [segment]    - List contacts, optionally filtered by segment
 *   search <query>        - Search contacts
 *   orders [status]       - List orders
 *   carts                 - Abandoned cart stats
 *   recover [coupon]      - Trigger cart recovery
 *   campaign <name> <msg> - Create quick campaign
 *   revenue [group]       - Revenue data (day|week|month)
 *   rfm                   - RFM segment distribution
 *   products              - Top selling products
 *   compare               - Period comparison
 *   stores                - List connected stores
 *   sync <storeId>        - Trigger store sync
 */

const API_URL = process.env.SELLZIN_API_URL || "http://localhost:3001/v1";
const API_KEY = process.env.SELLZIN_API_KEY;

if (!API_KEY) {
  console.error("❌ SELLZIN_API_KEY not set");
  process.exit(1);
}

const headers = { "x-api-key": API_KEY, "Content-Type": "application/json" };

async function api(path, method = "GET", body = null) {
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }
  return res.json();
}

function fmt(n) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
}

const [, , command, ...args] = process.argv;

async function run() {
  switch (command) {
    case "overview": {
      const d = await api("/analytics/overview");
      console.log(`📊 Visão Geral Sellzin`);
      console.log(`💰 Faturamento (30d): ${fmt(d.revenue.current)} (${d.revenue.change > 0 ? "+" : ""}${d.revenue.change}%)`);
      console.log(`📦 Pedidos: ${d.orders.total} | Ticket médio: ${fmt(d.orders.avgValue)}`);
      console.log(`👥 Contatos: ${d.contacts.total} | Novos: ${d.contacts.new} | Recompra: ${d.contacts.repurchaseRate}%`);
      console.log(`🛒 Carrinhos: ${d.recovery.abandoned} abandonados | ${d.recovery.recovered} recuperados (${fmt(d.recovery.recoveredValue)})`);
      break;
    }
    case "contacts": {
      const segment = args[0];
      const path = segment ? `/contacts?segment=${segment}&limit=10` : "/contacts?limit=10";
      const d = await api(path);
      console.log(`👥 Contatos${segment ? ` (${segment})` : ""}: ${d.pagination?.total || 0} total`);
      (d.contacts || []).forEach(c => {
        console.log(`  • ${c.firstName} ${c.lastName} | ${c.rfmSegment} | ${c.totalOrders} pedidos | ${fmt(c.totalSpent)}`);
      });
      break;
    }
    case "search": {
      const q = args.join(" ");
      if (!q) { console.error("Usage: search <query>"); break; }
      const d = await api(`/contacts/search?q=${encodeURIComponent(q)}`);
      console.log(`🔍 Busca "${q}": ${(d.contacts || []).length} resultados`);
      (d.contacts || []).forEach(c => {
        console.log(`  • ${c.firstName} ${c.lastName} | ${c.email} | ${c.phone} | ${c.rfmSegment}`);
      });
      break;
    }
    case "orders": {
      const status = args[0];
      const path = status ? `/orders?status=${status}&limit=10` : "/orders?limit=10";
      const d = await api(path);
      const stats = await api(`/orders/stats?period=month`);
      console.log(`📦 Pedidos: ${fmt(stats.stats.totalRevenue)} faturamento | ${stats.stats.totalOrders} pedidos | Ticket: ${fmt(stats.stats.avgOrderValue)}`);
      (d.orders || []).forEach(o => {
        console.log(`  • #${o.orderNumber} | ${o.status} | ${fmt(o.total)} | ${o.contact?.firstName || "?"} ${o.contact?.lastName || ""}`);
      });
      break;
    }
    case "carts": {
      const d = await api("/carts/abandoned/stats");
      const s = d.stats;
      console.log(`🛒 Carrinhos Abandonados (30d)`);
      console.log(`  Total: ${s.total} | Valor perdido: ${fmt(s.totalValue)}`);
      console.log(`  Recuperados: ${s.recovered} | Valor: ${fmt(s.recoveredValue)}`);
      console.log(`  Taxa: ${s.recoveryRate}%`);
      break;
    }
    case "recover": {
      const coupon = args[0];
      const body = {};
      if (coupon) body.couponCode = coupon;
      const d = await api("/carts/abandoned/recover", "POST", body);
      console.log(`✅ ${d.queued} recuperações agendadas${coupon ? ` com cupom ${coupon}` : ""}`);
      break;
    }
    case "campaign": {
      const name = args[0];
      const msg = args.slice(1).join(" ");
      if (!name) { console.error("Usage: campaign <name> <message>"); break; }
      const d = await api("/campaigns", "POST", {
        name, channel: "whatsapp", template: msg || "",
      });
      console.log(`✅ Campanha "${name}" criada`);
      break;
    }
    case "revenue": {
      const group = args[0] || "day";
      const d = await api(`/analytics/revenue?group=${group}`);
      console.log(`📈 Faturamento (${group})`);
      (d.data || []).slice(-10).forEach(p => {
        const bar = "█".repeat(Math.max(1, Math.round((p.revenue / Math.max(...d.data.map(x => x.revenue), 1)) * 20)));
        console.log(`  ${p.period.slice(0, 10)} | ${bar} ${fmt(p.revenue)} (${p.orders} pedidos)`);
      });
      break;
    }
    case "rfm": {
      const d = await api("/analytics/rfm");
      console.log(`🎯 Distribuição RFM`);
      (d.segments || []).sort((a, b) => b.count - a.count).forEach(s => {
        const bar = "█".repeat(Math.max(1, Math.round(s.count / Math.max(...d.segments.map(x => x.count), 1) * 15)));
        console.log(`  ${s.segment.padEnd(15)} | ${bar} ${s.count} contatos | ${fmt(s.totalSpent)}`);
      });
      break;
    }
    case "products": {
      const d = await api("/analytics/products/top?limit=10");
      console.log(`🏆 Top Produtos (30d)`);
      (d.products || []).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.name} — ${p.total_quantity}un — ${fmt(p.total_revenue)}`);
      });
      break;
    }
    case "compare": {
      const d = await api("/analytics/compare");
      const curr = d.comparison?.find(c => c.period === "current");
      const prev = d.comparison?.find(c => c.period === "previous");
      if (curr && prev) {
        const revChange = prev.revenue > 0 ? (((curr.revenue - prev.revenue) / prev.revenue) * 100).toFixed(1) : "N/A";
        console.log(`📊 Comparativo Semanal`);
        console.log(`  Faturamento: ${fmt(curr.revenue)} vs ${fmt(prev.revenue)} (${revChange}%)`);
        console.log(`  Pedidos: ${curr.orders} vs ${prev.orders}`);
        console.log(`  Ticket: ${fmt(curr.avg_value)} vs ${fmt(prev.avg_value)}`);
      }
      break;
    }
    case "stores": {
      const d = await api("/stores");
      console.log(`🏪 Lojas Conectadas`);
      (d.stores || []).forEach(s => {
        console.log(`  • ${s.name} (${s.platform}) — ${s.syncStatus} — Último sync: ${s.lastSyncAt || "nunca"}`);
      });
      break;
    }
    case "sync": {
      const id = args[0];
      if (!id) { console.error("Usage: sync <storeId>"); break; }
      await api(`/stores/${id}/sync`, "POST");
      console.log(`✅ Sincronização iniciada`);
      break;
    }
    default:
      console.log("Sellzin CRM CLI — Comandos: overview, contacts, search, orders, carts, recover, campaign, revenue, rfm, products, compare, stores, sync");
  }
}

run().catch(e => { console.error(`❌ ${e.message}`); process.exit(1); });
