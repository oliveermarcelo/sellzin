"use client";
// @ts-nocheck
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber, formatRelativeTime, getInitials } from "@/lib/utils";
import { PageHeader, Button, Table, Badge, Loading, Modal, StatCard, EmptyState } from "@/components/ui";
import { ShoppingCart, DollarSign, TrendingUp, Send, Zap, AlertTriangle, CheckCircle, Gift } from "lucide-react";

export default function CartsPage() {
  const [carts, setCarts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [conversion, setConversion] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recoveryModal, setRecoveryModal] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedCarts, setSelectedCarts] = useState<string[]>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [c, s, cv] = await Promise.all([
        api.getAbandonedCarts(), api.getCartStats(), api.getCartConversion(),
      ]);
      setCarts(c.carts || []);
      setStats(s.stats);
      setConversion(cv.conversion || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function recoverCarts() {
    setSending(true);
    try {
      const data: any = {};
      if (selectedCarts.length > 0) data.cartIds = selectedCarts;
      if (couponCode) data.couponCode = couponCode;
      if (customMessage) data.message = customMessage;
      const result = await api.recoverCarts(data);
      alert(`${result.queued} recuperações agendadas!`);
      setRecoveryModal(false);
      setCouponCode("");
      setCustomMessage("");
      setSelectedCarts([]);
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  }

  const toggleSelect = (id: string) => {
    setSelectedCarts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader title="Carrinhos Abandonados" description="Recupere vendas perdidas"
        actions={
          <div className="flex gap-2">
            {selectedCarts.length > 0 && (
              <Button size="sm" onClick={() => setRecoveryModal(true)}>
                <Send className="w-3.5 h-3.5" /> Recuperar ({selectedCarts.length})
              </Button>
            )}
            <Button size="sm" onClick={() => { setSelectedCarts([]); setRecoveryModal(true); }}>
              <Zap className="w-3.5 h-3.5" /> Recuperar Todos
            </Button>
          </div>
        }
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <StatCard label="Abandonados (30d)" value={formatNumber(stats.total)} icon={<ShoppingCart className="w-4 h-4" />} />
          <StatCard label="Valor Perdido" value={formatCurrency(stats.totalValue)} icon={<AlertTriangle className="w-4 h-4" />} />
          <StatCard label="Recuperados" value={formatNumber(stats.recovered)} icon={<CheckCircle className="w-4 h-4" />} />
          <StatCard label="Valor Recuperado" value={formatCurrency(stats.recoveredValue)} icon={<DollarSign className="w-4 h-4" />} />
          <StatCard label="Taxa Recuperação" value={`${stats.recoveryRate}%`} icon={<TrendingUp className="w-4 h-4" />}
            trend={parseFloat(stats.recoveryRate) > 10 ? { value: "Bom", positive: true } : undefined} />
        </div>
      )}

      {/* Conversion chart */}
      {conversion.length > 0 && (
        <div className="bg-[#0f0f12] border border-zinc-800/60 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-white mb-4">Evolução de Recuperação</h3>
          <div className="h-32 flex items-end gap-4">
            {conversion.map((c: any, i: number) => {
              const rate = c.total > 0 ? (c.recovered / c.total) * 100 : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-zinc-500">{rate.toFixed(0)}%</span>
                  <div className="w-full flex gap-1" style={{ height: "80px" }}>
                    <div className="flex-1 bg-zinc-800 rounded-sm" style={{ height: `${Math.min((c.total / Math.max(...conversion.map((x: any) => x.total), 1)) * 100, 100)}%`, marginTop: "auto" }} />
                    <div className="flex-1 bg-emerald-500/50 rounded-sm" style={{ height: `${Math.min((c.recovered / Math.max(...conversion.map((x: any) => x.total), 1)) * 100, 100)}%`, marginTop: "auto" }} />
                  </div>
                  <span className="text-[10px] text-zinc-600">{new Date(c.month).toLocaleDateString("pt-BR", { month: "short" })}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-[10px] text-zinc-500"><span className="w-2 h-2 rounded-sm bg-zinc-800" /> Abandonados</span>
            <span className="flex items-center gap-1.5 text-[10px] text-zinc-500"><span className="w-2 h-2 rounded-sm bg-emerald-500/50" /> Recuperados</span>
          </div>
        </div>
      )}

      {/* Carts Table */}
      <Table headers={["", "Cliente", "Itens", "Valor", "Tentativas", "Abandonado em"]} empty={carts.length === 0}>
        {carts.map((c: any) => (
          <tr key={c.id} className="hover:bg-zinc-800/20 transition">
            <td className="px-4 py-3 w-10">
              <input type="checkbox" checked={selectedCarts.includes(c.id)}
                onChange={() => toggleSelect(c.id)} className="rounded bg-zinc-800 border-zinc-700" />
            </td>
            <td className="px-4 py-3">
              {c.contact ? (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                    {getInitials(c.contact.firstName, c.contact.lastName)}
                  </div>
                  <div>
                    <p className="text-sm text-zinc-300">{c.contact.firstName} {c.contact.lastName}</p>
                    <p className="text-xs text-zinc-600">{c.contact.phone || c.contact.email}</p>
                  </div>
                </div>
              ) : (
                <div><p className="text-sm text-zinc-400">{c.email || c.phone || "Anônimo"}</p></div>
              )}
            </td>
            <td className="px-4 py-3">
              <div className="max-w-xs">
                {(c.items || []).slice(0, 2).map((item: any, i: number) => (
                  <p key={i} className="text-xs text-zinc-500 truncate">{item.name} ({item.quantity}x)</p>
                ))}
                {(c.items || []).length > 2 && (
                  <p className="text-[10px] text-zinc-600">+{c.items.length - 2} itens</p>
                )}
              </div>
            </td>
            <td className="px-4 py-3 text-sm font-semibold text-zinc-300">{formatCurrency(c.total)}</td>
            <td className="px-4 py-3">
              <span className={`text-xs font-medium ${c.recoveryAttempts > 0 ? "text-amber-400" : "text-zinc-600"}`}>
                {c.recoveryAttempts || 0}/3
              </span>
            </td>
            <td className="px-4 py-3 text-xs text-zinc-500">{formatRelativeTime(c.abandonedAt)}</td>
          </tr>
        ))}
      </Table>

      {/* Recovery Modal */}
      <Modal open={recoveryModal} onClose={() => setRecoveryModal(false)} title="Recuperar Carrinhos" size="md">
        <div className="space-y-4">
          <p className="text-sm text-zinc-500">
            {selectedCarts.length > 0 ? `${selectedCarts.length} carrinhos selecionados` : "Todos os carrinhos de ontem serão incluídos"}
          </p>

          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Cupom de desconto (opcional)</label>
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-zinc-600" />
              <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)}
                placeholder="ex: VOLTA10"
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Mensagem personalizada (opcional)</label>
            <textarea value={customMessage} onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="A IA vai gerar a mensagem se deixar em branco..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none" />
          </div>

          <div className="bg-zinc-900/50 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-zinc-400 mb-2">Fluxo de recuperação</h4>
            <div className="space-y-2">
              {[
                { time: "30 min", msg: "Lembrete sutil com link do carrinho" },
                { time: "24 horas", msg: "Mensagem com urgência + cupom" },
                { time: "72 horas", msg: "Última chance + oferta especial" },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center text-[10px] font-bold text-indigo-400">{i + 1}</div>
                  <div>
                    <span className="text-xs font-medium text-zinc-300">{step.time}</span>
                    <span className="text-xs text-zinc-600 ml-2">{step.msg}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setRecoveryModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={recoverCarts} loading={sending} className="flex-1">
              <Send className="w-4 h-4" /> Disparar Recuperação
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
