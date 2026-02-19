import { FastifyInstance } from "fastify";
import { db } from "../../lib/db";
import { contacts, orders, abandonedCarts, campaigns, stores, interactions, assistantMessages } from "../../lib/db/schema";
import { eq, and, sql, desc, ilike, or, gte, lte } from "drizzle-orm";

// Intent detection patterns
const INTENT_PATTERNS: { intent: string; patterns: RegExp[] }[] = [
  { intent: "overview", patterns: [/como est(ão|a) (as vendas|o negócio|a loja|meu e-?commerce)/i, /visão geral/i, /dashboard/i, /resumo/i, /overview/i] },
  { intent: "revenue", patterns: [/faturamento/i, /receita/i, /vendas/i, /quanto (vendi|faturei|entrou)/i, /revenue/i] },
  { intent: "orders", patterns: [/pedidos/i, /orders/i, /encomendas/i, /quantos pedidos/i] },
  { intent: "contacts_stats", patterns: [/quantos (clientes|contatos)/i, /clientes novos/i, /contatos/i, /meus clientes/i] },
  { intent: "contacts_segment", patterns: [/vip/i, /champions/i, /leais/i, /loyal/i, /em risco/i, /at.risk/i, /inativos/i, /lost/i, /hibernating/i, /potenciais/i, /novos clientes/i] },
  { intent: "search_contact", patterns: [/busca(r|) (cliente|contato)/i, /procura(r|) (cliente|contato)/i, /encontra(r|)/i, /quem é/i, /info(rmações|) (do|da|sobre)/i] },
  { intent: "carts", patterns: [/carrinho/i, /abandonad/i, /cart/i, /recupera(r|ção)/i] },
  { intent: "recover", patterns: [/recuperar/i, /disparar recuperação/i, /enviar lembrete/i, /mandar mensagem.*carrinho/i] },
  { intent: "campaign_create", patterns: [/cria(r|) campanha/i, /nova campanha/i, /disparo/i, /enviar.*campanha/i, /criar.*disparo/i] },
  { intent: "campaign_quick", patterns: [/disparo rápido/i, /enviar.*mensagem.*para/i, /mandar.*msg.*para/i, /notificar/i] },
  { intent: "campaigns_list", patterns: [/campanhas/i, /campaigns/i, /lista(r|) campanha/i] },
  { intent: "products", patterns: [/produto/i, /top.*(produto|vend)/i, /mais vendid/i, /product/i] },
  { intent: "rfm", patterns: [/rfm/i, /segment/i, /distribuição/i] },
  { intent: "compare", patterns: [/compara/i, /semana anterior/i, /evolução/i, /tendência/i] },
  { intent: "stores", patterns: [/loja/i, /store/i, /integraç/i, /conecta/i, /woocommerce/i, /magento/i] },
  { intent: "sync", patterns: [/sincroniz/i, /sync/i, /atualizar dados/i] },
  { intent: "help", patterns: [/ajuda/i, /help/i, /o que você (pode|faz)/i, /comando/i] },
];

function detectIntent(message: string): { intent: string; confidence: number } {
  for (const { intent, patterns } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        return { intent, confidence: 0.9 };
      }
    }
  }
  return { intent: "unknown", confidence: 0 };
}

function extractSegment(message: string): string | null {
  const map: Record<string, string> = {
    vip: "champions", campeões: "champions", champions: "champions",
    leais: "loyal", fiéis: "loyal", loyal: "loyal",
    potenciais: "potential", potential: "potential",
    novos: "new_customers", "novos clientes": "new_customers",
    risco: "at_risk", "em risco": "at_risk", at_risk: "at_risk",
    "não pode perder": "cant_lose", cant_lose: "cant_lose",
    inativos: "hibernating", hibernating: "hibernating",
    perdidos: "lost", lost: "lost",
  };
  const lower = message.toLowerCase();
  for (const [keyword, segment] of Object.entries(map)) {
    if (lower.includes(keyword)) return segment;
  }
  return null;
}

function extractSearchQuery(message: string): string | null {
  const patterns = [
    /buscar?\s+(?:cliente|contato)\s+(.+)/i,
    /procurar?\s+(?:cliente|contato)\s+(.+)/i,
    /quem é\s+(.+)/i,
    /informações?\s+(?:do|da|sobre)\s+(.+)/i,
    /encontrar?\s+(.+)/i,
  ];
  for (const p of patterns) {
    const match = message.match(p);
    if (match) return match[1].trim();
  }
  return null;
}

function fmt(n: number | string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(String(n)) || 0);
}

function fmtN(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

const SEGMENT_LABELS: Record<string, string> = {
  champions: "🏆 Campeões", loyal: "💎 Leais", potential: "⭐ Potenciais",
  new_customers: "🆕 Novos", at_risk: "⚠️ Em Risco", cant_lose: "🔥 Não Pode Perder",
  hibernating: "😴 Hibernando", lost: "❌ Perdidos",
};

export default async function assistantRoutes(app: FastifyInstance) {

  // ── POST /v1/assistant/chat ──
  app.post("/assistant/chat", { preHandler: [app.authenticate] }, async (req, reply) => {
    const { message, conversationId } = req.body as { message: string; conversationId?: string };
    const tenantId = req.user.tenantId;

    if (!message || typeof message !== "string") {
      return reply.code(400).send({ error: "message is required" });
    }

    const { intent, confidence } = detectIntent(message);
    let response = "";
    let data: any = null;
    let actions: any[] = [];
    let suggestions: string[] = [];

    try {
      switch (intent) {

        // ── OVERVIEW ──
        case "overview": {
          const [revResult, ordResult, ctResult, cartResult] = await Promise.all([
            getRevenueSummary(tenantId),
            getOrdersSummary(tenantId),
            getContactsSummary(tenantId),
            getCartsSummary(tenantId),
          ]);

          response = `📊 **Visão Geral do seu E-commerce**\n\n`;
          response += `💰 **Faturamento (30d):** ${fmt(revResult.current)}`;
          if (revResult.change !== 0) response += ` (${revResult.change > 0 ? "+" : ""}${revResult.change.toFixed(1)}% vs anterior)`;
          response += `\n📦 **Pedidos:** ${fmtN(ordResult.total)} | Ticket médio: ${fmt(ordResult.avgValue)}`;
          response += `\n👥 **Contatos:** ${fmtN(ctResult.total)} | ${ctResult.newThisMonth} novos este mês | Recompra: ${ctResult.repurchaseRate}%`;
          response += `\n🛒 **Carrinhos:** ${cartResult.abandoned} abandonados | ${cartResult.recovered} recuperados (${fmt(cartResult.recoveredValue)})`;

          if (cartResult.recoveryRate < 10) {
            response += `\n\n💡 Sua taxa de recuperação está em ${cartResult.recoveryRate}%. Disparar recuperação pode aumentar a receita.`;
            suggestions = ["Recuperar carrinhos abandonados", "Ver clientes em risco", "Criar campanha de reengajamento"];
          } else {
            suggestions = ["Ver top produtos", "Clientes VIP", "Faturamento da semana"];
          }

          data = { revenue: revResult, orders: ordResult, contacts: ctResult, carts: cartResult };
          break;
        }

        // ── REVENUE ──
        case "revenue": {
          const rev = await getRevenueSummary(tenantId);
          const recent = await getRecentRevenue(tenantId, 7);

          response = `💰 **Faturamento**\n\n`;
          response += `Últimos 30 dias: ${fmt(rev.current)}`;
          if (rev.change !== 0) response += ` (${rev.change > 0 ? "+" : ""}${rev.change.toFixed(1)}%)`;
          response += `\n\n📈 Últimos 7 dias:\n`;
          for (const day of recent) {
            const bar = "█".repeat(Math.max(1, Math.round((day.revenue / Math.max(...recent.map((d: any) => d.revenue), 1)) * 10)));
            response += `${new Date(day.period).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })} ${bar} ${fmt(day.revenue)} (${day.orders} ped.)\n`;
          }

          suggestions = ["Comparar com semana anterior", "Top produtos", "Ver pedidos"];
          data = { summary: rev, daily: recent };
          break;
        }

        // ── ORDERS ──
        case "orders": {
          const stats = await getOrdersSummary(tenantId);
          const recent = await db.query.orders.findMany({
            where: eq(orders.tenantId, tenantId),
            orderBy: [desc(orders.placedAt)],
            limit: 5,
            with: { contact: true },
          });

          response = `📦 **Pedidos (30d)**\n\n`;
          response += `Total: ${fmtN(stats.total)} pedidos | Faturamento: ${fmt(stats.totalRevenue)}\n`;
          response += `Ticket médio: ${fmt(stats.avgValue)} | Aguardando envio: ${stats.pendingShipment}\n\n`;
          response += `**Últimos pedidos:**\n`;
          for (const o of recent) {
            const name = o.contact ? `${o.contact.firstName} ${o.contact.lastName}` : "—";
            response += `#${o.orderNumber} | ${name} | ${fmt(o.total)} | ${o.status}\n`;
          }

          suggestions = ["Pedidos pendentes", "Faturamento da semana", "Top produtos"];
          data = { stats, recent };
          break;
        }

        // ── CONTACTS STATS ──
        case "contacts_stats": {
          const stats = await getContactsSummary(tenantId);
          const segDist = await getSegmentDistribution(tenantId);

          response = `👥 **Contatos**\n\n`;
          response += `Total: ${fmtN(stats.total)} | Novos (mês): ${stats.newThisMonth} | Com pedidos: ${stats.withOrders}\n`;
          response += `Taxa de recompra: ${stats.repurchaseRate}% | Opt-in WhatsApp: ${stats.optedIn}\n\n`;
          response += `**Distribuição por segmento:**\n`;
          for (const seg of segDist) {
            const label = SEGMENT_LABELS[seg.segment] || seg.segment;
            const pct = stats.total > 0 ? ((seg.count / stats.total) * 100).toFixed(0) : "0";
            response += `${label}: ${seg.count} (${pct}%)\n`;
          }

          suggestions = ["Clientes VIP", "Clientes em risco", "Criar campanha para inativos"];
          data = { stats, segments: segDist };
          break;
        }

        // ── CONTACTS BY SEGMENT ──
        case "contacts_segment": {
          const segment = extractSegment(message) || "champions";
          const result = await db.query.contacts.findMany({
            where: and(eq(contacts.tenantId, tenantId), eq(contacts.rfmSegment, segment)),
            orderBy: [desc(contacts.totalSpent)],
            limit: 10,
          });

          const label = SEGMENT_LABELS[segment] || segment;
          response = `${label} — ${result.length} contatos\n\n`;
          for (const c of result) {
            response += `• **${c.firstName} ${c.lastName}** | ${c.email || ""} | ${fmtN(c.totalOrders || 0)} pedidos | ${fmt(c.totalSpent)}\n`;
          }

          if (segment === "at_risk" || segment === "cant_lose") {
            response += `\n💡 Esses clientes precisam de atenção! Quer criar uma campanha de reengajamento?`;
            actions = [{ type: "suggest_campaign", segment, label: `Campanha para ${label}` }];
          }
          if (segment === "champions") {
            response += `\n💡 Seus melhores clientes! Considere um programa VIP exclusivo.`;
          }

          suggestions = ["Criar campanha para este segmento", "Ver outros segmentos", "Visão geral"];
          data = { segment, contacts: result };
          break;
        }

        // ── SEARCH CONTACT ──
        case "search_contact": {
          const query = extractSearchQuery(message) || message.replace(/buscar|procurar|encontrar|cliente|contato|quem é|informações|sobre|do|da/gi, "").trim();
          if (!query) {
            response = "🔍 Por favor, me diga o nome, email ou telefone do contato que está buscando.";
            break;
          }

          const result = await db.query.contacts.findMany({
            where: and(
              eq(contacts.tenantId, tenantId),
              or(
                ilike(contacts.firstName, `%${query}%`),
                ilike(contacts.lastName, `%${query}%`),
                ilike(contacts.email, `%${query}%`),
                ilike(contacts.phone, `%${query}%`),
              )
            ),
            limit: 5,
            with: { orders: { limit: 3, orderBy: [desc(orders.placedAt)] } },
          });

          if (result.length === 0) {
            response = `🔍 Nenhum contato encontrado para "${query}".`;
          } else {
            response = `🔍 ${result.length} resultado(s) para "${query}":\n\n`;
            for (const c of result) {
              const seg = SEGMENT_LABELS[c.rfmSegment || ""] || c.rfmSegment || "—";
              response += `**${c.firstName} ${c.lastName}** ${seg}\n`;
              response += `  📧 ${c.email || "—"} | 📱 ${c.phone || "—"} | 📍 ${c.city || ""}/${c.state || ""}\n`;
              response += `  💰 ${fmtN(c.totalOrders || 0)} pedidos | ${fmt(c.totalSpent)} gasto | RFM: ${c.rfmScore || "—"}\n`;
              if (c.orders && c.orders.length > 0) {
                response += `  Últimos pedidos: ${c.orders.map((o: any) => `#${o.orderNumber} (${fmt(o.total)})`).join(", ")}\n`;
              }
              response += `\n`;
            }
          }

          suggestions = ["Buscar outro contato", "Ver segmentos", "Visão geral"];
          data = { query, contacts: result };
          break;
        }

        // ── CARTS ──
        case "carts": {
          const stats = await getCartsSummary(tenantId);
          const recent = await db.query.abandonedCarts.findMany({
            where: and(eq(abandonedCarts.tenantId, tenantId), eq(abandonedCarts.isRecovered, false)),
            orderBy: [desc(abandonedCarts.abandonedAt)],
            limit: 5,
            with: { contact: true },
          });

          response = `🛒 **Carrinhos Abandonados (30d)**\n\n`;
          response += `Abandonados: ${stats.abandoned} | Valor perdido: ${fmt(stats.totalValue)}\n`;
          response += `Recuperados: ${stats.recovered} | Valor recuperado: ${fmt(stats.recoveredValue)}\n`;
          response += `Taxa de recuperação: ${stats.recoveryRate}%\n\n`;

          if (recent.length > 0) {
            response += `**Carrinhos pendentes:**\n`;
            for (const c of recent) {
              const name = c.contact ? `${c.contact.firstName} ${c.contact.lastName}` : c.email || "Anônimo";
              const items = (c.items as any[] || []).slice(0, 2).map((i: any) => i.name).join(", ");
              response += `• ${name} | ${fmt(c.total)} | ${items} | ${c.recoveryAttempts || 0}/3 tentativas\n`;
            }
          }

          if (stats.recoveryRate < 15) {
            response += `\n💡 Taxa abaixo de 15%. Recomendo disparar recuperação com cupom de desconto.`;
          }

          suggestions = ["Recuperar carrinhos agora", "Recuperar com cupom VOLTA10", "Ver detalhes de um carrinho"];
          actions = [{ type: "recover_carts", available: recent.length }];
          data = { stats, pendingCarts: recent };
          break;
        }

        // ── RECOVER ──
        case "recover": {
          const couponMatch = message.match(/cupom\s+(\w+)/i) || message.match(/VOLTA\d+/i);
          const couponCode = couponMatch ? (couponMatch[1] || couponMatch[0]) : undefined;

          const pendingCarts = await db.query.abandonedCarts.findMany({
            where: and(
              eq(abandonedCarts.tenantId, tenantId),
              eq(abandonedCarts.isRecovered, false),
              lte(abandonedCarts.recoveryAttempts, 2),
            ),
            with: { contact: true },
          });

          if (pendingCarts.length === 0) {
            response = "✅ Não há carrinhos pendentes para recuperação no momento!";
            break;
          }

          // Queue recovery for all pending carts
          const { Queue } = await import("bullmq");
          const { redisConnection } = await import("../../lib/redis");
          const recoveryQueue = new Queue("recovery", { connection: redisConnection });

          let queued = 0;
          for (const cart of pendingCarts) {
            if (!cart.contact?.phone) continue;
            await recoveryQueue.add("recover-cart", {
              tenantId,
              cartId: cart.id,
              contactId: cart.contactId,
              phone: cart.contact.phone,
              items: cart.items,
              total: cart.total,
              checkoutUrl: cart.checkoutUrl,
              couponCode,
            });
            queued++;
          }

          response = `✅ **Recuperação disparada!**\n\n`;
          response += `${queued} mensagens WhatsApp agendadas de ${pendingCarts.length} carrinhos.\n`;
          if (couponCode) response += `Cupom incluído: **${couponCode}**\n`;
          response += `\nAs mensagens serão enviadas gradualmente (anti-ban). Acompanhe os resultados em Carrinhos Abandonados.`;

          actions = [{ type: "recovery_dispatched", queued, couponCode }];
          suggestions = ["Ver status da recuperação", "Criar campanha", "Visão geral"];
          data = { queued, totalCarts: pendingCarts.length, couponCode };
          break;
        }

        // ── CAMPAIGNS LIST ──
        case "campaigns_list": {
          const allCampaigns = await db.query.campaigns.findMany({
            where: eq(campaigns.tenantId, tenantId),
            orderBy: [desc(campaigns.createdAt)],
            limit: 10,
          });

          response = `📢 **Campanhas**\n\n`;
          if (allCampaigns.length === 0) {
            response += "Nenhuma campanha criada ainda. Quer criar uma?";
          } else {
            for (const c of allCampaigns) {
              const conv = c.totalSent > 0 ? ((c.totalConverted / c.totalSent) * 100).toFixed(1) : "0";
              response += `• **${c.name}** [${c.status}] — ${c.channel}\n`;
              response += `  Enviadas: ${c.totalSent} | Lidas: ${c.totalRead} | Conversão: ${conv}%`;
              if (parseFloat(String(c.revenue)) > 0) response += ` | Receita: ${fmt(c.revenue)}`;
              response += `\n`;
            }
          }

          suggestions = ["Criar nova campanha", "Disparo rápido para VIPs", "Ver detalhes de uma campanha"];
          data = { campaigns: allCampaigns };
          break;
        }

        // ── CAMPAIGN CREATE ──
        case "campaign_create":
        case "campaign_quick": {
          const segment = extractSegment(message);
          response = `📢 **Criar Campanha**\n\n`;
          response += `Para criar uma campanha, preciso de algumas informações:\n\n`;
          response += `1️⃣ **Nome** da campanha\n`;
          response += `2️⃣ **Canal**: WhatsApp, Email ou SMS\n`;
          response += `3️⃣ **Segmento alvo**: ${segment ? SEGMENT_LABELS[segment] || segment : "qual público?"}\n`;
          response += `4️⃣ **Mensagem** (ou deixe em branco para IA gerar)\n\n`;
          response += `Exemplo: "Criar campanha Black Friday via WhatsApp para clientes VIP com mensagem Oferta exclusiva!"\n`;

          if (segment) {
            const count = await db.query.contacts.findMany({
              where: and(eq(contacts.tenantId, tenantId), eq(contacts.rfmSegment, segment)),
              columns: { id: true },
            });
            response += `\n📊 Segmento ${SEGMENT_LABELS[segment]}: ${count.length} contatos disponíveis.`;
          }

          suggestions = ["Campanha para VIPs", "Campanha para clientes em risco", "Campanha para todos"];
          break;
        }

        // ── PRODUCTS ──
        case "products": {
          const topProducts = await db.execute(sql`
            SELECT
              item->>'name' as name,
              item->>'sku' as sku,
              SUM((item->>'quantity')::int) as total_quantity,
              SUM((item->>'total')::numeric) as total_revenue
            FROM orders, jsonb_array_elements(items::jsonb) as item
            WHERE tenant_id = ${tenantId}
              AND placed_at >= NOW() - INTERVAL '30 days'
            GROUP BY item->>'name', item->>'sku'
            ORDER BY total_revenue DESC
            LIMIT 10
          `);

          response = `🏆 **Top Produtos (30 dias)**\n\n`;
          const products = topProducts.rows || [];
          if (products.length === 0) {
            response += "Sem dados de produtos ainda. Conecte uma loja para começar.";
          } else {
            for (let i = 0; i < products.length; i++) {
              const p = products[i] as any;
              response += `${i + 1}. **${p.name}** — ${fmtN(parseInt(p.total_quantity))} vendidos — ${fmt(p.total_revenue)}\n`;
            }
          }

          suggestions = ["Ver faturamento", "Clientes que compraram o top 1", "Visão geral"];
          data = { products };
          break;
        }

        // ── RFM ──
        case "rfm": {
          const segDist = await getSegmentDistribution(tenantId);
          const total = segDist.reduce((s: number, seg: any) => s + seg.count, 0);

          response = `🎯 **Distribuição RFM**\n\n`;
          for (const seg of segDist) {
            const label = SEGMENT_LABELS[seg.segment] || seg.segment;
            const pct = total > 0 ? ((seg.count / total) * 100).toFixed(0) : "0";
            const bar = "█".repeat(Math.max(1, Math.round(parseFloat(pct) / 5)));
            response += `${label} ${bar} ${seg.count} (${pct}%) — ${fmt(seg.totalSpent)}\n`;
          }

          const atRisk = segDist.find((s: any) => s.segment === "at_risk");
          const lost = segDist.find((s: any) => s.segment === "lost");
          if (atRisk && atRisk.count > 0) {
            response += `\n⚠️ ${atRisk.count} clientes em risco. Recomendo campanha de reengajamento!`;
          }
          if (lost && lost.count > total * 0.3) {
            response += `\n🚨 ${((lost.count / total) * 100).toFixed(0)}% dos clientes estão perdidos. Ação urgente necessária.`;
          }

          suggestions = ["Ver clientes em risco", "Criar campanha de reativação", "Comparar períodos"];
          data = { segments: segDist, total };
          break;
        }

        // ── COMPARE ──
        case "compare": {
          const current = await getRevenueForPeriod(tenantId, 7, 0);
          const previous = await getRevenueForPeriod(tenantId, 14, 7);
          const revChange = previous.revenue > 0 ? (((current.revenue - previous.revenue) / previous.revenue) * 100).toFixed(1) : "N/A";
          const ordChange = previous.orders > 0 ? (((current.orders - previous.orders) / previous.orders) * 100).toFixed(1) : "N/A";

          response = `📊 **Comparativo Semanal**\n\n`;
          response += `| Métrica | Esta semana | Semana anterior | Variação |\n`;
          response += `|---|---|---|---|\n`;
          response += `| Faturamento | ${fmt(current.revenue)} | ${fmt(previous.revenue)} | ${revChange}% |\n`;
          response += `| Pedidos | ${current.orders} | ${previous.orders} | ${ordChange}% |\n`;
          response += `| Ticket Médio | ${fmt(current.avgValue)} | ${fmt(previous.avgValue)} | — |\n`;

          suggestions = ["Ver faturamento diário", "Top produtos", "Visão geral"];
          data = { current, previous };
          break;
        }

        // ── STORES ──
        case "stores": {
          const allStores = await db.query.stores.findMany({
            where: eq(stores.tenantId, tenantId),
          });

          response = `🏪 **Lojas Conectadas**\n\n`;
          if (allStores.length === 0) {
            response += "Nenhuma loja conectada. Acesse Configurações > Lojas para conectar WooCommerce ou Magento.";
          } else {
            for (const s of allStores) {
              const statusEmoji = s.syncStatus === "synced" ? "✅" : s.syncStatus === "syncing" ? "🔄" : s.syncStatus === "error" ? "❌" : "⏳";
              response += `${statusEmoji} **${s.name}** (${s.platform})\n`;
              response += `  URL: ${s.apiUrl} | Status: ${s.syncStatus} | Último sync: ${s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleDateString("pt-BR") : "nunca"}\n`;
            }
          }

          suggestions = ["Sincronizar loja", "Ver pedidos", "Visão geral"];
          data = { stores: allStores };
          break;
        }

        // ── SYNC ──
        case "sync": {
          const allStores = await db.query.stores.findMany({
            where: eq(stores.tenantId, tenantId),
          });

          if (allStores.length === 0) {
            response = "Nenhuma loja conectada para sincronizar.";
          } else {
            const { Queue } = await import("bullmq");
            const { redisConnection } = await import("../../lib/redis");
            const syncQueue = new Queue("sync", { connection: redisConnection });

            for (const store of allStores) {
              await syncQueue.add("sync-store", { storeId: store.id, tenantId, type: "full" });
            }

            response = `🔄 Sincronização iniciada para ${allStores.length} loja(s).\nIsso pode levar alguns minutos dependendo do volume de dados.`;
          }

          suggestions = ["Ver status das lojas", "Visão geral"];
          break;
        }

        // ── HELP ──
        case "help": {
          response = `🤖 **Assistente Sellzin — O que posso fazer:**\n\n`;
          response += `📊 **"Como estão as vendas?"** — Visão geral completa\n`;
          response += `💰 **"Faturamento da semana"** — Receita detalhada\n`;
          response += `👥 **"Quantos clientes novos?"** — Stats de contatos\n`;
          response += `🏆 **"Clientes VIP"** — Lista campeões/leais\n`;
          response += `⚠️ **"Clientes em risco"** — Quem precisa de atenção\n`;
          response += `🔍 **"Buscar Maria Silva"** — Encontrar contato\n`;
          response += `🛒 **"Carrinhos abandonados"** — Stats de abandono\n`;
          response += `🚀 **"Recuperar carrinhos"** — Dispara WhatsApp\n`;
          response += `📢 **"Criar campanha"** — Nova campanha\n`;
          response += `🏆 **"Top produtos"** — Mais vendidos\n`;
          response += `🎯 **"Segmentos RFM"** — Distribuição\n`;
          response += `📊 **"Comparar semanas"** — Evolução\n`;
          response += `🏪 **"Minhas lojas"** — Status integrações\n`;
          response += `🔄 **"Sincronizar"** — Atualizar dados\n`;
          suggestions = ["Como estão as vendas?", "Clientes em risco", "Recuperar carrinhos"];
          break;
        }

        // ── UNKNOWN ──
        default: {
          response = `Não entendi completamente, mas posso ajudar com:\n\n`;
          response += `• Vendas e faturamento\n• Contatos e segmentos RFM\n• Pedidos\n• Carrinhos abandonados\n• Campanhas\n• Analytics\n\n`;
          response += `Tente algo como "como estão as vendas?" ou "recuperar carrinhos".`;
          suggestions = ["Como estão as vendas?", "Clientes VIP", "Carrinhos abandonados", "Ajuda"];
        }
      }
    } catch (err: any) {
      console.error("[assistant] Error:", err);
      response = `❌ Erro ao processar: ${err.message}. Tente novamente.`;
    }

    // Log to assistant_messages
    try {
      const convId = conversationId || `conv_${Date.now()}`;
      await db.insert(assistantMessages).values([
        { tenantId, conversationId: convId, role: "user", content: message, intent, confidence, channel: "web" },
        { tenantId, conversationId: convId, role: "assistant", content: response, intent, confidence, channel: "web" },
      ]);
    } catch (e) {}

    return {
      message: response,
      intent,
      confidence,
      data,
      actions,
      suggestions,
      timestamp: new Date().toISOString(),
    };
  });

  // ── GET /v1/assistant/suggestions ──
  app.get("/assistant/suggestions", { preHandler: [app.authenticate] }, async (req) => {
    const tenantId = req.user.tenantId;

    // Smart suggestions based on current state
    const suggestions: string[] = [];

    try {
      const cartStats = await getCartsSummary(tenantId);
      if (cartStats.abandoned > 0 && cartStats.recoveryRate < 15) {
        suggestions.push(`🛒 ${cartStats.abandoned} carrinhos abandonados — recuperar agora`);
      }

      const segDist = await getSegmentDistribution(tenantId);
      const atRisk = segDist.find((s: any) => s.segment === "at_risk");
      if (atRisk && atRisk.count > 5) {
        suggestions.push(`⚠️ ${atRisk.count} clientes em risco — criar campanha`);
      }

      suggestions.push("📊 Como estão as vendas?");
      suggestions.push("🏆 Top produtos do mês");
      suggestions.push("👥 Clientes VIP");
    } catch (e) {}

    return { suggestions };
  });

  // ── POST /v1/assistant/openclaw/webhook ──
  // Receives messages from OpenClaw gateway via the Sellzin skill
  app.post("/assistant/openclaw/webhook", async (req, reply) => {
    const { apiKey, message, channel, senderId } = req.body as any;
    if (!apiKey) return reply.status(401).send({ error: "API key required" });

    // Find tenant by API key
    const tenantResult = await db.execute(
      sql`SELECT id, name, email FROM tenants WHERE api_key = ${apiKey} LIMIT 1`
    );
    if (tenantResult.rows.length === 0) {
      return reply.status(401).send({ error: "Invalid API key" });
    }
    const tenant = tenantResult.rows[0] as any;

    // Generate a JWT for internal use
    const token = app.jwt.sign({ tenantId: tenant.id, email: tenant.email });

    // Call the chat endpoint internally
    const internalResponse = await app.inject({
      method: "POST",
      url: "/v1/assistant/chat",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      payload: { message, conversationId: `oc_${senderId || "default"}` },
    });

    const result = JSON.parse(internalResponse.body);

    return { response: result.message, intent: result.intent, channel: channel || "openclaw" };
  });

  // ── GET /v1/assistant/history ──
  app.get("/assistant/history", { preHandler: [app.authenticate] }, async (req) => {
    const tenantId = req.user.tenantId;
    const result = await db.query.assistantMessages.findMany({
      where: eq(assistantMessages.tenantId, tenantId),
      orderBy: [desc(assistantMessages.createdAt)],
      limit: 50,
    });
    return {
      messages: result.reverse().map((r: any) => ({
        id: r.id,
        role: r.role,
        content: r.content,
        intent: r.intent,
        channel: r.channel,
        timestamp: r.createdAt,
      })),
    };
  });
}

// ── Helper functions ──
async function getRevenueSummary(tenantId: string) {
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN placed_at >= NOW() - INTERVAL '30 days' THEN total::numeric END), 0) as current_revenue,
      COALESCE(SUM(CASE WHEN placed_at >= NOW() - INTERVAL '60 days' AND placed_at < NOW() - INTERVAL '30 days' THEN total::numeric END), 0) as previous_revenue
    FROM orders WHERE tenant_id = ${tenantId} AND status != 'cancelled'
  `);
  const row = (result.rows[0] || {}) as any;
  const current = parseFloat(row.current_revenue) || 0;
  const previous = parseFloat(row.previous_revenue) || 0;
  const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  return { current, previous, change };
}

async function getRevenueForPeriod(tenantId: string, daysAgo: number, daysEnd: number) {
  const result = await db.execute(sql`
    SELECT COUNT(*) as orders, COALESCE(SUM(total::numeric), 0) as revenue, COALESCE(AVG(total::numeric), 0) as avg_value
    FROM orders WHERE tenant_id = ${tenantId} AND status != 'cancelled'
      AND placed_at >= NOW() - INTERVAL '1 day' * ${daysAgo}
      AND placed_at < NOW() - INTERVAL '1 day' * ${daysEnd}
  `);
  const row = (result.rows[0] || {}) as any;
  return { orders: parseInt(row.orders) || 0, revenue: parseFloat(row.revenue) || 0, avgValue: parseFloat(row.avg_value) || 0 };
}

async function getRecentRevenue(tenantId: string, days: number) {
  const result = await db.execute(sql`
    SELECT DATE(placed_at) as period, COUNT(*) as orders, COALESCE(SUM(total::numeric), 0) as revenue
    FROM orders WHERE tenant_id = ${tenantId} AND status != 'cancelled' AND placed_at >= NOW() - INTERVAL '1 day' * ${days}
    GROUP BY DATE(placed_at) ORDER BY period
  `);
  return result.rows;
}

async function getOrdersSummary(tenantId: string) {
  const result = await db.execute(sql`
    SELECT COUNT(*) as total, COALESCE(SUM(total::numeric), 0) as total_revenue, COALESCE(AVG(total::numeric), 0) as avg_value,
      COUNT(CASE WHEN status IN ('pending', 'processing') THEN 1 END) as pending_shipment
    FROM orders WHERE tenant_id = ${tenantId} AND placed_at >= NOW() - INTERVAL '30 days'
  `);
  const row = (result.rows[0] || {}) as any;
  return {
    total: parseInt(row.total) || 0, totalRevenue: parseFloat(row.total_revenue) || 0,
    avgValue: parseFloat(row.avg_value) || 0, pendingShipment: parseInt(row.pending_shipment) || 0,
  };
}

async function getContactsSummary(tenantId: string) {
  const result = await db.execute(sql`
    SELECT COUNT(*) as total,
      COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_this_month,
      COUNT(CASE WHEN total_orders > 0 THEN 1 END) as with_orders,
      COUNT(CASE WHEN total_orders > 1 THEN 1 END) as repeat_customers,
      COUNT(CASE WHEN is_opted_in = true THEN 1 END) as opted_in
    FROM contacts WHERE tenant_id = ${tenantId}
  `);
  const row = (result.rows[0] || {}) as any;
  const total = parseInt(row.total) || 0;
  const withOrders = parseInt(row.with_orders) || 0;
  const repeat = parseInt(row.repeat_customers) || 0;
  return {
    total, newThisMonth: parseInt(row.new_this_month) || 0, withOrders,
    optedIn: parseInt(row.opted_in) || 0,
    repurchaseRate: withOrders > 0 ? ((repeat / withOrders) * 100).toFixed(1) : "0",
  };
}

async function getCartsSummary(tenantId: string) {
  const result = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(total::numeric), 0) as total_value,
      COUNT(CASE WHEN is_recovered = true THEN 1 END) as recovered,
      COALESCE(SUM(CASE WHEN is_recovered = true THEN total::numeric END), 0) as recovered_value
    FROM abandoned_carts WHERE tenant_id = ${tenantId} AND abandoned_at >= NOW() - INTERVAL '30 days'
  `);
  const row = (result.rows[0] || {}) as any;
  const abandoned = parseInt(row.total) || 0;
  const recovered = parseInt(row.recovered) || 0;
  return {
    abandoned, totalValue: parseFloat(row.total_value) || 0,
    recovered, recoveredValue: parseFloat(row.recovered_value) || 0,
    recoveryRate: abandoned > 0 ? ((recovered / abandoned) * 100).toFixed(1) : "0",
  };
}

async function getSegmentDistribution(tenantId: string) {
  const result = await db.execute(sql`
    SELECT rfm_segment as segment, COUNT(*) as count, COALESCE(SUM(total_spent::numeric), 0) as total_spent
    FROM contacts WHERE tenant_id = ${tenantId} AND rfm_segment IS NOT NULL
    GROUP BY rfm_segment ORDER BY count DESC
  `);
  return result.rows;
}
