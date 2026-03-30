"use client";
// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber, getSegmentLabel, getSegmentColor } from "@/lib/utils";
import { PageHeader, Loading, Tabs, StatCard, DateRangePicker } from "@/components/ui";
import { BarChart3, TrendingUp, DollarSign, Users, ShoppingCart, ArrowUp, ArrowDown } from "lucide-react";

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [comparison, setComparison] = useState<any[]>([]);
  const [revenueGroup, setRevenueGroup] = useState("day");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);

  const dateParams = startDate && endDate ? { startDate, endDate } : undefined;

  const loadRevenue = useCallback(async () => {
    try {
      const params = startDate && endDate ? { startDate, endDate } : undefined;
      const data = await api.getRevenue(revenueGroup, params);
      setRevenueData(data.data || []);
    } catch (e) { console.error(e); }
  }, [revenueGroup, startDate, endDate]);

  const loadAll = useCallback(async () => {
    try {
      const params = startDate && endDate ? { startDate, endDate } : undefined;
      const [ov, seg, prod, comp] = await Promise.all([
        api.getOverview(params), api.getRfm(), api.getTopProducts(10, params), api.getComparison(),
      ]);
      setOverview(ov);
      setSegments(seg.segments || []);
      setTopProducts(prod.products || []);
      setComparison(comp.comparison || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [startDate, endDate]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { loadRevenue(); }, [loadRevenue]);

  if (loading) return <Loading />;

  const maxRevenue = Math.max(...revenueData.map((d: any) => parseFloat(d.revenue) || 0), 1);
  const current = comparison.find((c: any) => c.period === "current");
  const previous = comparison.find((c: any) => c.period === "previous");
  const revenueChange = previous?.revenue > 0
    ? (((current?.revenue - previous?.revenue) / previous?.revenue) * 100).toFixed(1) : "0";
  const ordersChange = previous?.orders > 0
    ? (((current?.orders - previous?.orders) / previous?.orders) * 100).toFixed(1) : "0";

  const totalContacts = segments.reduce((s: number, seg: any) => s + seg.count, 0);

  return (
    <div>
      <PageHeader title="Analytics" description="Métricas detalhadas do seu e-commerce"
        actions={
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
          />
        }
      />

      {/* Comparison Cards */}
      {(() => {
        const periodLabel = startDate && endDate
          ? `${new Date(startDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${new Date(endDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
          : "7d";
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard label={`Faturamento (${periodLabel})`} value={formatCurrency(startDate && endDate ? overview?.revenue?.current || 0 : current?.revenue || 0)}
              icon={<DollarSign className="w-4 h-4" />}
              trend={!startDate ? { value: `${revenueChange}%`, positive: parseFloat(revenueChange) >= 0 } : undefined}
              sub={!startDate ? "vs semana anterior" : undefined} />
            <StatCard label={`Pedidos (${periodLabel})`} value={formatNumber(startDate && endDate ? overview?.orders?.total || 0 : current?.orders || 0)}
              icon={<ShoppingCart className="w-4 h-4" />}
              trend={!startDate ? { value: `${ordersChange}%`, positive: parseFloat(ordersChange) >= 0 } : undefined}
              sub={!startDate ? "vs semana anterior" : undefined} />
            <StatCard label="Ticket Médio" value={formatCurrency(startDate && endDate ? overview?.orders?.avgValue || 0 : current?.avg_value || 0)} />
            <StatCard label="Recompra" value={`${overview?.contacts?.repurchaseRate || 0}%`}
              icon={<Users className="w-4 h-4" />} />
          </div>
        );
      })()}

      {/* Revenue Chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Faturamento</h3>
          <Tabs tabs={[
            { id: "day", label: "Diário" },
            { id: "week", label: "Semanal" },
            { id: "month", label: "Mensal" },
          ]} active={revenueGroup} onChange={setRevenueGroup} />
        </div>

        {revenueData.length > 0 ? (
          <div>
            <div className="h-56 flex items-end gap-[3px]">
              {revenueData.map((d: any, i: number) => {
                const height = maxRevenue > 0 ? (parseFloat(d.revenue) / maxRevenue) * 100 : 0;
                return (
                  <div key={i} className="flex-1 min-w-0 group relative h-full flex items-end">
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 shadow-lg">
                      <p className="font-semibold">{formatCurrency(d.revenue)}</p>
                      <p className="text-gray-300">{d.orders} pedidos</p>
                      <p className="text-gray-400">{new Date(d.period).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div className="w-full rounded-sm bg-red-500 hover:bg-red-400 transition-all cursor-pointer"
                      style={{ height: `${Math.max(height, 2)}%` }} />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-gray-400">
              <span>{revenueData[0] ? new Date(revenueData[0].period).toLocaleDateString("pt-BR", { month: "short", day: "numeric" }) : ""}</span>
              <span>{revenueData.length > 0 ? new Date(revenueData[revenueData.length - 1].period).toLocaleDateString("pt-BR", { month: "short", day: "numeric" }) : ""}</span>
            </div>
          </div>
        ) : (
          <div className="h-56 flex items-center justify-center text-gray-400 text-sm">Sem dados ainda</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* RFM Segments */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Distribuição RFM</h3>
          {segments.length > 0 ? (
            <div className="space-y-4">
              {segments.sort((a: any, b: any) => b.count - a.count).map((s: any) => {
                const pct = totalContacts > 0 ? (s.count / totalContacts) * 100 : 0;
                return (
                  <div key={s.segment}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getSegmentColor(s.segment) }} />
                        <span className="text-xs font-medium text-gray-700">{getSegmentLabel(s.segment)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{s.count} ({pct.toFixed(0)}%)</span>
                        <span className="text-xs font-medium text-gray-600">{formatCurrency(s.totalSpent)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: getSegmentColor(s.segment) }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Sem dados</div>
          )}
        </div>

        {/* Top Products */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Top Produtos (30 dias)</h3>
          {topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.map((p: any, i: number) => {
                const maxRev = topProducts[0]?.total_revenue || 1;
                const pct = (p.total_revenue / maxRev) * 100;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                        <span className="text-xs text-gray-700 truncate max-w-[200px]">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
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

      {/* Comparison Table */}
      {current && previous && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Comparativo Semanal</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Faturamento", current: formatCurrency(current.revenue), previous: formatCurrency(previous.revenue), change: revenueChange },
              { label: "Pedidos", current: formatNumber(current.orders), previous: formatNumber(previous.orders), change: ordersChange },
              { label: "Ticket Médio", current: formatCurrency(current.avg_value), previous: formatCurrency(previous.avg_value),
                change: previous.avg_value > 0 ? (((current.avg_value - previous.avg_value) / previous.avg_value) * 100).toFixed(1) : "0" },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <p className="text-xs text-gray-500 mb-2">{m.label}</p>
                <p className="text-lg font-bold text-gray-900">{m.current}</p>
                <div className="flex items-center justify-center gap-1 mt-1">
                  {parseFloat(m.change) >= 0 ? (
                    <ArrowUp className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <ArrowDown className="w-3 h-3 text-red-400" />
                  )}
                  <span className={`text-xs font-semibold ${parseFloat(m.change) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {m.change}%
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">Anterior: {m.previous}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
