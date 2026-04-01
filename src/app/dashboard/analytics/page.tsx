"use client";
// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber, getSegmentLabel, getSegmentColor } from "@/lib/utils";
import { PageHeader, Loading, Tabs, StatCard, DateRangePicker } from "@/components/ui";
import { DollarSign, Users, ShoppingCart, ArrowUp, ArrowDown, TrendingUp } from "lucide-react";

// ── Shared chart helpers ──

function Sparkline({ values, color = "#ef4444", height = 44 }: { values: number[]; color?: string; height?: number }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = 100 - ((v - min) / range) * 86 - 5;
    return `${x},${y}`;
  });
  const line = pts.join(" ");
  const area = `0,100 ${line} 100,100`;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height, width: "100%", display: "block" }}>
      <polygon points={area} fill={color} fillOpacity="0.12" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2.5"
        vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OrdersLineOverlay({ data }: { data: any[] }) {
  if (data.length < 2) return null;
  const maxO = Math.max(...data.map(d => parseInt(d.orders) || 0), 1);
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((parseInt(d.orders) || 0) / maxO) * 82 - 5;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full pointer-events-none">
      <polyline points={pts} fill="none" stroke="#6366f1" strokeWidth="2"
        vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((parseInt(d.orders) || 0) / maxO) * 82 - 5;
        return <circle key={i} cx={`${x}%`} cy={`${y}%`} r="1.5" fill="#6366f1"
          vectorEffect="non-scaling-stroke" className="opacity-0 group-hover:opacity-100" />;
      })}
    </svg>
  );
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:    { label: "Pendente",     color: "#fbbf24" },
  processing: { label: "Processando",  color: "#6366f1" },
  shipped:    { label: "Enviado",      color: "#38bdf8" },
  delivered:  { label: "Entregue",     color: "#10b981" },
  cancelled:  { label: "Cancelado",    color: "#ef4444" },
  refunded:   { label: "Reembolsado",  color: "#f97316" },
};

const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function AnalyticsPage() {
  const [overview,      setOverview]      = useState<any>(null);
  const [revenueData,   setRevenueData]   = useState<any[]>([]);
  const [customersData, setCustomersData] = useState<any[]>([]);
  const [segments,      setSegments]      = useState<any[]>([]);
  const [topProducts,   setTopProducts]   = useState<any[]>([]);
  const [comparison,    setComparison]    = useState<any[]>([]);
  const [statusData,    setStatusData]    = useState<any[]>([]);
  const [weekdayData,   setWeekdayData]   = useState<any[]>([]);
  const [revenueGroup,  setRevenueGroup]  = useState("day");
  const [startDate,     setStartDate]     = useState("");
  const [endDate,       setEndDate]       = useState("");
  const [loading,       setLoading]       = useState(true);

  const loadRevenue = useCallback(async () => {
    const params = startDate && endDate ? { startDate, endDate } : undefined;
    try {
      const [rev, cust] = await Promise.all([
        api.getRevenue(revenueGroup, params),
        api.getCustomers(revenueGroup, params),
      ]);
      setRevenueData(rev.data || []);
      setCustomersData(cust.data || []);
    } catch (e) { console.error(e); }
  }, [revenueGroup, startDate, endDate]);

  const loadAll = useCallback(async () => {
    const params = startDate && endDate ? { startDate, endDate } : undefined;
    try {
      const [ov, seg, prod, comp, stat, wday] = await Promise.all([
        api.getOverview(params),
        api.getRfm(),
        api.getTopProducts(10, params),
        api.getComparison(),
        api.getOrdersByStatus(params),
        api.getWeekdayActivity(params),
      ]);
      setOverview(ov);
      setSegments(seg.segments || []);
      setTopProducts(prod.products || []);
      setComparison(comp.comparison || []);
      setStatusData(stat.statuses || []);
      setWeekdayData(wday.weekdays || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { loadAll(); },    [loadAll]);
  useEffect(() => { loadRevenue(); }, [loadRevenue]);

  if (loading) return <Loading />;

  // ── Derived values ──
  const maxRevenue    = Math.max(...revenueData.map(d => parseFloat(d.revenue) || 0), 1);
  const chartRevTotal = revenueData.reduce((s, d) => s + (parseFloat(d.revenue) || 0), 0);
  const chartOrdTotal = revenueData.reduce((s, d) => s + (parseInt(d.orders) || 0), 0);
  const chartAvgOrd   = chartOrdTotal > 0 ? chartRevTotal / chartOrdTotal : 0;
  const avgTickValues = revenueData.map(d => parseFloat(d.avg_order_value) || 0);
  const newCustValues = customersData.map(d => parseInt(d.new_customers) || 0);

  const current  = comparison.find(c => c.period === "current");
  const previous = comparison.find(c => c.period === "previous");
  const revChange  = previous?.revenue > 0 ? (((current?.revenue - previous?.revenue)  / previous?.revenue)  * 100).toFixed(1) : "0";
  const ordChange  = previous?.orders  > 0 ? (((current?.orders  - previous?.orders)   / previous?.orders)   * 100).toFixed(1) : "0";
  const avgChange  = previous?.avg_value > 0 ? (((current?.avg_value - previous?.avg_value) / previous?.avg_value) * 100).toFixed(1) : "0";

  const totalStatuses = statusData.reduce((s, d) => s + parseInt(d.count), 0) || 1;
  const maxWday       = Math.max(...weekdayData.map(d => parseInt(d.orders) || 0), 1);

  const periodLabel = startDate && endDate
    ? `${new Date(startDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${new Date(endDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
    : "90 dias";
  const totalContacts = segments.reduce((s, seg) => s + seg.count, 0);

  return (
    <div>
      <PageHeader title="Analytics" description="Métricas detalhadas do seu e-commerce"
        actions={
          <DateRangePicker startDate={startDate} endDate={endDate}
            onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
        }
      />

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label={`Faturamento (${periodLabel})`} value={formatCurrency(chartRevTotal)}
          icon={<DollarSign className="w-4 h-4" />}
          trend={!startDate ? { value: `${revChange}%`, positive: parseFloat(revChange) >= 0 } : undefined}
          sub={!startDate ? "vs semana anterior" : undefined} />
        <StatCard label={`Pedidos (${periodLabel})`} value={formatNumber(chartOrdTotal)}
          icon={<ShoppingCart className="w-4 h-4" />}
          trend={!startDate ? { value: `${ordChange}%`, positive: parseFloat(ordChange) >= 0 } : undefined}
          sub={!startDate ? "vs semana anterior" : undefined} />
        <StatCard label="Ticket Médio" value={formatCurrency(chartAvgOrd)}
          icon={<TrendingUp className="w-4 h-4" />}
          trend={!startDate ? { value: `${avgChange}%`, positive: parseFloat(avgChange) >= 0 } : undefined} />
        <StatCard label="Recompra" value={`${overview?.contacts?.repurchaseRate || 0}%`}
          icon={<Users className="w-4 h-4" />} />
      </div>

      {/* ── Revenue + Orders Dual Chart ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Faturamento & Pedidos</h3>
            <div className="flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Faturamento
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className="w-5 h-0.5 bg-indigo-500 inline-block rounded-full" /> Pedidos
              </span>
            </div>
          </div>
          <Tabs tabs={[
            { id: "day", label: "Diário" },
            { id: "week", label: "Semanal" },
            { id: "month", label: "Mensal" },
          ]} active={revenueGroup} onChange={setRevenueGroup} />
        </div>

        {revenueData.length > 0 ? (
          <div>
            <div className="h-56 relative mt-4 group">
              {/* Revenue bars */}
              <div className="absolute inset-0 flex items-end gap-[3px]">
                {revenueData.map((d, i) => {
                  const h = maxRevenue > 0 ? (parseFloat(d.revenue) / maxRevenue) * 100 : 0;
                  const maxO = Math.max(...revenueData.map(x => parseInt(x.orders) || 0), 1);
                  return (
                    <div key={i} className="flex-1 min-w-0 h-full flex items-end relative">
                      <div className="absolute bottom-full mb-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1.5 rounded whitespace-nowrap opacity-0 hover:opacity-100 transition pointer-events-none z-10 shadow-lg">
                        <p className="font-semibold">{formatCurrency(d.revenue)}</p>
                        <p className="text-indigo-300">{d.orders} pedidos</p>
                        <p className="text-gray-400">{new Date(d.period).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <div className="w-full rounded-sm bg-red-500 hover:bg-red-400 transition-all cursor-pointer"
                        style={{ height: `${Math.max(h, 2)}%` }} />
                    </div>
                  );
                })}
              </div>
              {/* Orders line overlay */}
              <OrdersLineOverlay data={revenueData} />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-gray-400">
              <span>{revenueData[0] ? new Date(revenueData[0].period).toLocaleDateString("pt-BR", { month: "short", day: "numeric" }) : ""}</span>
              <span>{revenueData.length > 0 ? new Date(revenueData[revenueData.length - 1].period).toLocaleDateString("pt-BR", { month: "short", day: "numeric" }) : ""}</span>
            </div>
          </div>
        ) : (
          <div className="h-56 flex items-center justify-center text-gray-400 text-sm mt-4">Sem dados ainda</div>
        )}
      </div>

      {/* ── Status + Weekday + Avg Ticket ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

        {/* Orders by Status */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Pedidos por Status</h3>
          {statusData.length > 0 ? (
            <div className="space-y-3">
              {statusData.sort((a, b) => parseInt(b.count) - parseInt(a.count)).map(s => {
                const meta = STATUS_META[s.status] || { label: s.status, color: "#6b7280" };
                const pct = (parseInt(s.count) / totalStatuses) * 100;
                return (
                  <div key={s.status}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                        <span className="text-xs text-gray-700">{meta.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400">{pct.toFixed(0)}%</span>
                        <span className="text-xs font-semibold text-gray-700">{formatNumber(s.count)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: meta.color }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                <span>Total</span>
                <span className="font-semibold text-gray-700">{formatNumber(totalStatuses)}</span>
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Sem dados</div>
          )}
        </div>

        {/* Day of Week Activity */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Atividade por Dia da Semana</h3>
          {weekdayData.length > 0 ? (
            <div>
              <div className="h-32 flex items-end gap-2">
                {DOW_LABELS.map((label, day) => {
                  const entry = weekdayData.find(d => parseInt(d.day) === day);
                  const orders = parseInt(entry?.orders || "0");
                  const h = maxWday > 0 ? (orders / maxWday) * 100 : 0;
                  const isMax = orders === maxWday && maxWday > 0;
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1 group">
                      <span className="text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition">
                        {formatNumber(orders)}
                      </span>
                      <div className="w-full flex items-end" style={{ height: "80px" }}>
                        <div className="w-full rounded-t-sm transition-all"
                          style={{
                            height: `${Math.max(h, 4)}%`,
                            backgroundColor: isMax ? "#ef4444" : "#fca5a5",
                          }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-2">
                {DOW_LABELS.map(l => (
                  <div key={l} className="flex-1 text-center text-[10px] text-gray-400">{l}</div>
                ))}
              </div>
              {weekdayData.length > 0 && (() => {
                const busiest = weekdayData.reduce((a, b) => parseInt(a.orders) > parseInt(b.orders) ? a : b);
                return (
                  <p className="text-[11px] text-gray-400 mt-3 text-center">
                    Mais ativo: <span className="font-medium text-gray-600">{DOW_LABELS[parseInt(busiest.day)]}</span>
                    {" "}— {formatNumber(busiest.orders)} pedidos
                  </p>
                );
              })()}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Sem dados</div>
          )}
        </div>

        {/* Avg Ticket & New Customers Sparklines */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-semibold text-gray-700">Ticket Médio</h4>
              <span className="text-sm font-bold text-gray-900">{formatCurrency(chartAvgOrd)}</span>
            </div>
            <Sparkline values={avgTickValues} color="#ef4444" height={48} />
            <p className="text-[10px] text-gray-400 mt-1">Tendência no período</p>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-semibold text-gray-700">Novos Clientes</h4>
              <span className="text-sm font-bold text-gray-900">
                {formatNumber(newCustValues.reduce((s, v) => s + v, 0))}
              </span>
            </div>
            <Sparkline values={newCustValues} color="#10b981" height={48} />
            <p className="text-[10px] text-gray-400 mt-1">Aquisição no período</p>
          </div>
        </div>
      </div>

      {/* ── RFM + Top Products ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Distribuição RFM</h3>
          {segments.length > 0 ? (
            <div className="space-y-3">
              {segments.sort((a, b) => b.count - a.count).map(s => {
                const pct = totalContacts > 0 ? (s.count / totalContacts) * 100 : 0;
                return (
                  <div key={s.segment}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: getSegmentColor(s.segment) }} />
                        <span className="text-xs font-medium text-gray-700">{getSegmentLabel(s.segment)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{s.count} ({pct.toFixed(0)}%)</span>
                        <span className="text-xs font-medium text-gray-600">{formatCurrency(s.totalSpent)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: getSegmentColor(s.segment) }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Sem dados</div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Top Produtos</h3>
          {topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.map((p, i) => {
                const maxRev = parseFloat(topProducts[0]?.total_revenue) || 1;
                const pct = (parseFloat(p.total_revenue) / maxRev) * 100;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-300 w-5 shrink-0">{i + 1}</span>
                        <span className="text-xs text-gray-700 truncate max-w-[180px]">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-gray-400">{p.total_quantity}un</span>
                        <span className="text-xs font-semibold text-gray-700">{formatCurrency(p.total_revenue)}</span>
                      </div>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Sem dados</div>
          )}
        </div>
      </div>

      {/* ── Comparison ── */}
      {current && previous && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-5">Comparativo — Semana Atual vs Anterior</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { label: "Faturamento", curr: current.revenue, prev: previous.revenue, fmt: formatCurrency, change: revChange },
              { label: "Pedidos",     curr: current.orders,  prev: previous.orders,  fmt: formatNumber,   change: ordChange },
              { label: "Ticket Médio",curr: current.avg_value,prev: previous.avg_value,fmt: formatCurrency,change: avgChange },
            ].map(m => {
              const pos = parseFloat(m.change) >= 0;
              const max = Math.max(parseFloat(m.curr) || 0, parseFloat(m.prev) || 0, 1);
              const currPct = ((parseFloat(m.curr) || 0) / max) * 100;
              const prevPct = ((parseFloat(m.prev) || 0) / max) * 100;
              return (
                <div key={m.label}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-gray-600">{m.label}</span>
                    <div className="flex items-center gap-1">
                      {pos ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-red-400" />}
                      <span className={`text-xs font-bold ${pos ? "text-emerald-500" : "text-red-400"}`}>{m.change}%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px] text-gray-500">Atual</span>
                        <span className="text-xs font-semibold text-gray-800">{m.fmt(m.curr)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${currPct}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px] text-gray-400">Anterior</span>
                        <span className="text-xs text-gray-500">{m.fmt(m.prev)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-300 rounded-full transition-all" style={{ width: `${prevPct}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
