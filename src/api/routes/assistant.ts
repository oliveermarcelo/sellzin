// @ts-nocheck
import { FastifyInstance } from "fastify";
import { db } from "../../lib/db";
import { contacts, orders, abandonedCarts, campaigns, stores, interactions, assistantMessages } from "../../lib/db/schema";
import { eq, and, sql, desc, ilike, or, gte, lte } from "drizzle-orm";

// ── LLM Integration (OpenAI GPT-4o + Groq fallback) ──
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `Você é o assistente IA do Sellzin CRM.

REGRAS CRÍTICAS:
- Use APENAS dados retornados pelas ferramentas. NUNCA invente números, nomes ou dados.
- Se os dados estiverem vazios, diga que não há informações disponíveis.
- Sempre use uma ferramenta antes de responder sobre dados da loja.
- Responda SOMENTE sobre: vendas, pedidos, clientes, carrinhos, campanhas, produtos e analytics.
- Para perguntas fora do escopo, recuse educadamente.
- Português do Brasil. Tom profissional e direto. Máx 300 palavras.
- Formate valores em R$ (ex: R$ 1.234,56).
- Destaque os números mais importantes em negrito.
- Termine com 1-2 insights ou sugestões práticas baseadas nos dados reais.`;

// ── Tool definitions (OpenAI function calling format) ──
const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_overview",
      description: "Retorna visão geral do e-commerce: faturamento, pedidos, contatos e carrinhos dos últimos 30 dias.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_revenue",
      description: "Retorna faturamento detalhado para um período específico, com comparativo e breakdown diário.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Número de dias para o período (padrão: 30)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_orders",
      description: "Lista pedidos recentes, podendo filtrar por status e período.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Status do pedido: pending, processing, delivered, cancelled" },
          days: { type: "number", description: "Filtrar pedidos dos últimos N dias" },
          limit: { type: "number", description: "Número máximo de pedidos a retornar (padrão: 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contacts",
      description: "Lista contatos/clientes, podendo filtrar por segmento RFM ou busca textual.",
      parameters: {
        type: "object",
        properties: {
          segment: { type: "string", description: "Segmento RFM: champions, loyal, potential, new_customers, at_risk, cant_lose, hibernating, lost" },
          search: { type: "string", description: "Busca por nome, email ou telefone" },
          limit: { type: "number", description: "Número máximo de contatos (padrão: 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_abandoned_carts",
      description: "Retorna estatísticas e lista de carrinhos abandonados não recuperados.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Número máximo de carrinhos a listar (padrão: 5)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_products",
      description: "Retorna os produtos mais vendidos por faturamento em um período.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Período em dias (padrão: 30)" },
          limit: { type: "number", description: "Número de produtos a retornar (padrão: 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_rfm_segments",
      description: "Retorna a distribuição de clientes por segmento RFM (Recência, Frequência, Valor).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_campaigns",
      description: "Lista as campanhas de marketing criadas na loja.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Número máximo de campanhas (padrão: 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_periods",
      description: "Compara o faturamento do período atual com o período anterior.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Tamanho de cada período em dias (padrão: 7)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tracking_stats",
      description: "Retorna estatísticas de rastreamento de eventos (pageviews, eventos web, visitantes).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

// ── Execute a tool by name ──
async function executeTool(name: string, args: any, tenantId: string): Promise<string> {
  try {
    switch (name) {

      case "get_overview": {
        const [rev, ord, ct, cart] = await Promise.all([
          getRevenueSummary(tenantId),
          getOrdersSummary(tenantId),
          getContactsSummary(tenantId),
          getCartsSummary(tenantId),
        ]);
        return JSON.stringify({ revenue: rev, orders: ord, contacts: ct, carts: cart });
      }

      case "get_revenue": {
        const days = args.days ?? 30;
        const [periodData, prevData, recent] = await Promise.all([
          getRevenueForPeriod(tenantId, days, 0),
          getRevenueForPeriod(tenantId, days * 2, days),
          getRecentRevenue(tenantId, days),
        ]);
        return JSON.stringify({ period: periodData, previous: prevData, daily: recent, days });
      }

      case "get_orders": {
        const limit = args.limit ?? 10;
        const days = args.days ?? 30;

        let whereConditions: any[] = [eq(orders.tenantId, tenantId)];
        if (args.status) {
          const statusList = args.status.includes(",")
            ? args.status.split(",").map((s: string) => s.trim())
            : [args.status];
          whereConditions.push(sql`${orders.status} = ANY(ARRAY[${sql.join(statusList.map((s: string) => sql`${s}`), sql`, `)}])`);
        }
        if (days) {
          whereConditions.push(gte(orders.placedAt, sql`NOW() - INTERVAL '1 day' * ${days}`));
        }

        const stats = await getOrdersSummary(tenantId);
        const recent = await db.query.orders.findMany({
          where: and(...whereConditions),
          orderBy: [desc(orders.placedAt)],
          limit,
          with: { contact: true },
        });

        const mapped = recent.map((o: any) => ({
          orderNumber: o.orderNumber,
          contact: o.contact ? `${o.contact.firstName} ${o.contact.lastName}`.trim() : "—",
          total: o.total,
          status: o.status,
          placedAt: o.placedAt,
        }));

        return JSON.stringify({ stats, orders: mapped });
      }

      case "get_contacts": {
        const limit = args.limit ?? 10;
        let whereConditions: any[] = [eq(contacts.tenantId, tenantId)];

        if (args.segment) {
          whereConditions.push(eq(contacts.rfmSegment, args.segment as any));
        }
        if (args.search) {
          const q = args.search;
          whereConditions.push(or(
            ilike(contacts.firstName, `%${q}%`),
            ilike(contacts.lastName, `%${q}%`),
            ilike(contacts.email, `%${q}%`),
            ilike(contacts.phone, `%${q}%`),
          ));
        }

        const result = await db.query.contacts.findMany({
          where: and(...whereConditions),
          orderBy: [desc(contacts.totalSpent)],
          limit,
          with: args.search ? { orders: { limit: 3, orderBy: [desc(orders.placedAt)] } } : undefined,
        });

        const mapped = result.map((c: any) => ({
          name: `${c.firstName} ${c.lastName}`.trim(),
          email: c.email,
          phone: c.phone,
          city: c.city,
          state: c.state,
          rfmSegment: c.rfmSegment,
          rfmScore: c.rfmScore,
          totalOrders: c.totalOrders,
          totalSpent: c.totalSpent,
          recentOrders: c.orders?.map((o: any) => ({ orderNumber: o.orderNumber, total: o.total })),
        }));

        return JSON.stringify({ contacts: mapped, segment: args.segment, search: args.search });
      }

      case "get_abandoned_carts": {
        const limit = args.limit ?? 5;
        const stats = await getCartsSummary(tenantId);
        const recent = await db.query.abandonedCarts.findMany({
          where: and(eq(abandonedCarts.tenantId, tenantId), eq(abandonedCarts.isRecovered, false)),
          orderBy: [desc(abandonedCarts.abandonedAt)],
          limit,
          with: { contact: true },
        });

        const mapped = recent.map((c: any) => ({
          contact: c.contact ? `${c.contact.firstName} ${c.contact.lastName}`.trim() : c.email || "Anônimo",
          total: c.total,
          items: (c.items as any[] || []).slice(0, 3).map((i: any) => i.name),
          recoveryAttempts: c.recoveryAttempts ?? 0,
          abandonedAt: c.abandonedAt,
        }));

        return JSON.stringify({ stats, pendingCarts: mapped });
      }

      case "get_top_products": {
        const days = args.days ?? 30;
        const limit = args.limit ?? 10;

        const result = await db.execute(sql`
          SELECT
            item->>'name' as name,
            item->>'sku' as sku,
            SUM(COALESCE((item->>'quantity')::numeric, 1)) as total_quantity,
            SUM(COALESCE(NULLIF(item->>'total', '')::numeric, COALESCE(NULLIF(item->>'price', '')::numeric, 0) * COALESCE((item->>'quantity')::numeric, 1))) as total_revenue
          FROM orders, jsonb_array_elements(items::jsonb) as item
          WHERE tenant_id = ${tenantId}
            AND placed_at >= NOW() - INTERVAL '1 day' * ${days}
            AND item->>'name' IS NOT NULL
          GROUP BY item->>'name', item->>'sku'
          ORDER BY total_revenue DESC
          LIMIT ${limit}
        `);

        return JSON.stringify({ products: getRows(result), days });
      }

      case "get_rfm_segments": {
        const segDist = await getSegmentDistribution(tenantId);
        const total = segDist.reduce((s: number, seg: any) => s + parseInt(seg.count), 0);
        return JSON.stringify({ segments: segDist, total });
      }

      case "get_campaigns": {
        const limit = args.limit ?? 10;
        const allCampaigns = await db.query.campaigns.findMany({
          where: eq(campaigns.tenantId, tenantId),
          orderBy: [desc(campaigns.createdAt)],
          limit,
        });

        const mapped = allCampaigns.map((c: any) => ({
          name: c.name,
          status: c.status,
          channel: c.channel,
          totalSent: c.totalSent,
          totalRead: c.totalRead,
          totalConverted: c.totalConverted,
          revenue: c.revenue,
          conversionRate: c.totalSent > 0 ? ((c.totalConverted / c.totalSent) * 100).toFixed(1) : "0",
        }));

        return JSON.stringify({ campaigns: mapped });
      }

      case "compare_periods": {
        const days = args.days ?? 7;
        const [current, previous] = await Promise.all([
          getRevenueForPeriod(tenantId, days, 0),
          getRevenueForPeriod(tenantId, days * 2, days),
        ]);
        const revChange = previous.revenue > 0
          ? (((current.revenue - previous.revenue) / previous.revenue) * 100).toFixed(1)
          : null;
        const ordChange = previous.orders > 0
          ? (((current.orders - previous.orders) / previous.orders) * 100).toFixed(1)
          : null;
        return JSON.stringify({ current, previous, revChange, ordChange, days });
      }

      case "get_tracking_stats": {
        const result = await db.execute(sql`
          SELECT
            COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '10 minutes' THEN visitor_id END) as live_now,
            COUNT(DISTINCT CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN visitor_id END) as unique_visitors_24h,
            COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' AND event = 'active_on_site' THEN 1 END) as page_views_24h,
            COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' AND event = 'viewed_product' THEN 1 END) as product_views_24h,
            COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' AND event = 'added_to_cart' THEN 1 END) as cart_events_24h,
            COUNT(DISTINCT visitor_id) as total_visitors_7d
          FROM tracking_events
          WHERE tenant_id = ${tenantId}
            AND created_at > NOW() - INTERVAL '7 days'
        `);
        return JSON.stringify(getRows(result)[0] || { live_now: 0, unique_visitors_24h: 0, page_views_24h: 0, product_views_24h: 0, cart_events_24h: 0 });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err: any) {
    console.error(`[tool:${name}] Error:`, err);
    return JSON.stringify({ error: err.message });
  }
}

// ── Call LLM with function calling support ──
// Returns the raw message object (may contain tool_calls)
async function callLLMWithTools(messages: any[]): Promise<any> {
  const body = {
    model: OPENAI_MODEL,
    messages,
    tools: TOOLS,
    tool_choice: "auto",
    temperature: 0.3,
    max_tokens: 800,
  };

  // Try OpenAI first
  if (OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const json = await res.json();
        const msg = json.choices?.[0]?.message;
        if (msg) return msg;
      } else {
        console.error("[llm] OpenAI error:", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.error("[llm] OpenAI fetch error:", err);
    }
  }

  // Fallback: Groq (llama-3.3-70b-versatile supports function calling)
  if (GROQ_API_KEY) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({ ...body, model: GROQ_MODEL }),
      });
      if (res.ok) {
        const json = await res.json();
        const msg = json.choices?.[0]?.message;
        if (msg) return msg;
      } else {
        console.error("[llm] Groq error:", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.error("[llm] Groq fetch error:", err);
    }
  }

  return { role: "assistant", content: "Não foi possível conectar ao serviço de IA no momento. Tente novamente em instantes." };
}

function fmt(n: number | string | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(String(n ?? 0)) || 0);
}

function fmtN(n: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR").format(n ?? 0);
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

    let finalResponse = "";

    try {
      // Build initial message list
      const messages: any[] = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message },
      ];

      // First LLM call
      let assistantMsg = await callLLMWithTools(messages);
      messages.push(assistantMsg);

      // Function calling loop
      let iterations = 0;
      const MAX_ITERATIONS = 5;
      while (assistantMsg.tool_calls?.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;
        for (const toolCall of assistantMsg.tool_calls) {
          const toolName = toolCall.function.name;
          let toolArgs: any = {};
          try {
            toolArgs = JSON.parse(toolCall.function.arguments || "{}");
          } catch {
            toolArgs = {};
          }

          console.log(`[assistant] Calling tool: ${toolName}`, toolArgs);
          const toolResult = await executeTool(toolName, toolArgs, tenantId);

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }

        // Call LLM again with tool results
        assistantMsg = await callLLMWithTools(messages);
        messages.push(assistantMsg);
      }

      finalResponse = assistantMsg.content || "Não consegui processar sua pergunta. Tente reformulá-la.";
    } catch (err: any) {
      console.error("[assistant] Error:", err);
      finalResponse = `Erro ao processar: ${err.message}. Tente novamente.`;
    }

    // Log to assistant_messages
    try {
      const convId = conversationId || `conv_${Date.now()}`;
      await db.insert(assistantMessages).values([
        { tenantId, conversationId: convId, role: "user", content: message, intent: "function_call", confidence: 1, channel: "web" },
        { tenantId, conversationId: convId, role: "assistant", content: finalResponse, intent: "function_call", confidence: 1, channel: "web" },
      ]);
    } catch (e) {}

    return {
      message: finalResponse,
      intent: "function_call",
      confidence: 1,
      suggestions: [],
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
      if (cartStats.abandoned > 0 && parseFloat(cartStats.recoveryRate) < 15) {
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
// Helper to safely get rows from db.execute result
function getRows(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (result?.rows) return result.rows;
  return [];
}

async function getRevenueSummary(tenantId: string) {
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN placed_at >= NOW() - INTERVAL '30 days' THEN total::numeric END), 0) as current_revenue,
      COALESCE(SUM(CASE WHEN placed_at >= NOW() - INTERVAL '60 days' AND placed_at < NOW() - INTERVAL '30 days' THEN total::numeric END), 0) as previous_revenue
    FROM orders WHERE tenant_id = ${tenantId} AND status != 'cancelled'
  `);
  const row = (getRows(result)[0] || {}) as any;
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
  const row = (getRows(result)[0] || {}) as any;
  return { orders: parseInt(row.orders) || 0, revenue: parseFloat(row.revenue) || 0, avgValue: parseFloat(row.avg_value) || 0 };
}

async function getRecentRevenue(tenantId: string, days: number) {
  const result = await db.execute(sql`
    SELECT DATE(placed_at) as period, COUNT(*) as orders, COALESCE(SUM(total::numeric), 0) as revenue
    FROM orders WHERE tenant_id = ${tenantId} AND status != 'cancelled' AND placed_at >= NOW() - INTERVAL '1 day' * ${days}
    GROUP BY DATE(placed_at) ORDER BY period
  `);
  return getRows(result);
}

async function getOrdersSummary(tenantId: string) {
  const result = await db.execute(sql`
    SELECT COUNT(*) as total, COALESCE(SUM(total::numeric), 0) as total_revenue, COALESCE(AVG(total::numeric), 0) as avg_value,
      COUNT(CASE WHEN status IN ('pending', 'processing') THEN 1 END) as pending_shipment
    FROM orders WHERE tenant_id = ${tenantId} AND placed_at >= NOW() - INTERVAL '30 days'
  `);
  const row = (getRows(result)[0] || {}) as any;
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
  const row = (getRows(result)[0] || {}) as any;
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
  const row = (getRows(result)[0] || {}) as any;
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
  return getRows(result);
}
