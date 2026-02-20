"use client";
// @ts-nocheck
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber, getSegmentLabel, getSegmentColor } from "@/lib/utils";
import { StatCard, Loading, PageHeader, Button } from "@/components/ui";
import {
  DollarSign, ShoppingCart, Users, TrendingUp, Package,
  ArrowUpRight, BarChart3, RefreshCw, Zap
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const [overview, setOverview] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    try {
      const [ov, rev, seg, prod] = await Promise.all([
        api.getOverview(), api.getRevenue("day"), api.getRfm(), api.getTopProducts(5),
      ]);
      setOverview(ov);
      setRevenueData(rev.data || []);
      setSegments(seg.segments || []);
      setTopProducts(prod.products || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  if (loading) return <Loading />;
  const ov = overview;
  const recoveryRate = ov && ov.recovery.abandoned > 0
    ? ((ov.recovery.recovered / ov.recovery.abandoned) * 100).toFixed(1) : "0";
  const maxRevenue = Math.max(...revenueData.map((d: any) => d.revenue), 1);

  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral do seu e-commerce"
        actions={<Button variant="ghost" size="sm" onClick={loadDashboard}><RefreshCw className="w-4 h-4" /> Atualizar</Button>} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Faturamento" value={formatCurrency(ov?.revenue.current || 0)} sub="Últimos 30 dias"
          icon={<DollarSign className="w-4 h-4" />}
          trend={ov?.revenue.change !== "0" ? { value: `${ov?.revenue.change}%`, positive: parseFloat(ov?.revenue.change || "0") > 0 } : undefined} />
        <StatCard label="Pedidos" value={formatNumber(ov?.orders.total || 0)}
          sub={`Ticket médio: ${formatCurrency(ov?.orders.avgValue || 0)}`} icon={<Package className="w-4 h-4" />} />
        <StatCard label="Contatos" value={formatNumber(ov?.contacts.total || 0)}
          sub={`${ov?.contacts.new || 0} novos este mês`} icon={<Users className="w-4 h-4" />} />
        <StatCard label="Recuperação" value={`${recoveryRate}%`}
          sub={`${formatCurrency(ov?.recovery.recoveredValue || 0)} recuperados`} icon={<ShoppingCart className="w-4 h-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div><h3 className="text-sm font-semibold text-gray-900">Faturamento</h3><p className="text-xs text-gray-400">Últimos 90 dias</p></div>
            <Link href="/dashboard/analytics" className="text-xs text-red-600 hover:text-red-500 flex items-center gap-1">Ver detalhes <ArrowUpRight className="w-3 h-3" /></Link>
          </div>
          {revenueData.length > 0 ? (
            <div className="h-48 flex items-end gap-[2px]">
              {revenueData.slice(-30).map((d: any, i: number) => {
                const height = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0;
                return (
                  <div key={i} className="flex-1 min-w-0 group relative">
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                      {formatCurrency(d.revenue)}<br />{new Date(d.period).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </div>
                    <div className="w-full rounded-sm bg-red-500/70 hover:bg-red-500 transition-all cursor-pointer" style={{ height: `${Math.max(height, 2)}%` }} />
                  </div>
                );
              })}
            </div>
          ) : (<div className="h-48 flex items-center justify-center text-gray-300 text-sm">Sem dados ainda</div>)}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Segmentos RFM</h3>
            <Link href="/dashboard/contacts" className="text-xs text-red-600 hover:text-red-500 flex items-center gap-1">Ver todos <ArrowUpRight className="w-3 h-3" /></Link>
          </div>
          {segments.length > 0 ? (
            <div className="space-y-3">
              {segments.sort((a: any, b: any) => b.count - a.count).slice(0, 6).map((s: any) => {
                const total = segments.reduce((sum: number, seg: any) => sum + seg.count, 0);
                const pct = total > 0 ? (s.count / total) * 100 : 0;
                return (
                  <div key={s.segment}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: getSegmentColor(s.segment) }}>{getSegmentLabel(s.segment)}</span>
                      <span className="text-xs text-gray-400">{s.count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: getSegmentColor(s.segment) }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (<div className="h-40 flex items-center justify-center text-gray-300 text-sm">Conecte uma loja</div>)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Top Produtos (30 dias)</h3>
          {topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-300 w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0"><p className="text-sm text-gray-700 truncate">{p.name}</p><p className="text-xs text-gray-400">{p.total_quantity} vendidos</p></div>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(p.total_revenue)}</span>
                </div>
              ))}
            </div>
          ) : (<div className="h-40 flex items-center justify-center text-gray-300 text-sm">Sem vendas ainda</div>)}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: "/dashboard/carts", icon: ShoppingCart, label: "Recuperar Carrinhos" },
              { href: "/dashboard/campaigns", icon: Zap, label: "Nova Campanha" },
              { href: "/dashboard/contacts", icon: Users, label: "Ver Contatos" },
              { href: "/dashboard/analytics", icon: BarChart3, label: "Analytics" },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-50 border border-gray-200 hover:border-red-300 hover:bg-red-50/50 transition text-center group">
                <a.icon className="w-5 h-5 text-gray-400 group-hover:text-red-600 transition" />
                <span className="text-xs font-medium text-gray-500 group-hover:text-gray-700">{a.label}</span>
              </Link>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-100">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-3.5 h-3.5 text-red-600" /><span className="text-xs font-semibold text-red-600">Dica</span></div>
            <p className="text-xs text-gray-500">Taxa de recompra: <span className="text-gray-700 font-medium">{ov?.contacts.repurchaseRate || 0}%</span>.
              {parseFloat(ov?.contacts.repurchaseRate || "0") < 20 ? " Crie uma campanha de reengajamento." : " Ótimo resultado!"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
