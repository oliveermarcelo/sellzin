"use client";
// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import {
  TrendingDown, TrendingUp, Minus, Search, RefreshCw,
  ExternalLink, AlertTriangle, CheckCircle, Clock, BarChart3,
  ChevronDown, ChevronUp, Package, Zap
} from "lucide-react";

function fmt(n: any) {
  const v = parseFloat(n);
  if (isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PriceDiffBadge({ diff }: { diff: number | null }) {
  if (diff === null) return <span className="text-gray-400 text-xs">—</span>;
  const d = parseFloat(String(diff));
  if (d > 2) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
      <TrendingDown className="w-3 h-3" /> {d.toFixed(1)}% mais barato
    </span>
  );
  if (d < -2) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
      <TrendingUp className="w-3 h-3" /> {Math.abs(d).toFixed(1)}% mais caro
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
      <Minus className="w-3 h-3" /> Em linha
    </span>
  );
}

function CompetitorRow({ comp, expanded, onToggle }: any) {
  const competitors = comp.competitors || [];
  const diff = parseFloat(comp.price_diff ?? comp.priceDiff ?? "0");

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-4 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition"
        onClick={onToggle}
      >
        {/* Product name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{comp.product_name || comp.productName}</p>
          {(comp.product_sku || comp.productSku) && (
            <p className="text-xs text-gray-400">SKU: {comp.product_sku || comp.productSku}</p>
          )}
        </div>

        {/* Our price */}
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-400">Nosso preço</p>
          <p className="text-sm font-semibold text-gray-900">{fmt(comp.our_price ?? comp.ourPrice)}</p>
        </div>

        {/* Lowest competitor */}
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-400">Menor concorrente</p>
          <p className="text-sm font-semibold text-gray-700">{fmt(comp.lowest_price ?? comp.lowestPrice)}</p>
          {(comp.lowest_store || comp.lowestStore) && (
            <p className="text-xs text-gray-400 truncate max-w-[120px]">{comp.lowest_store || comp.lowestStore}</p>
          )}
        </div>

        {/* Diff badge */}
        <div className="shrink-0">
          <PriceDiffBadge diff={isNaN(diff) ? null : diff} />
        </div>

        {/* Expand */}
        <div className="shrink-0 text-gray-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {expanded && competitors.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {competitors.length} resultado(s) no Google Shopping
          </p>
          <div className="space-y-2">
            {competitors.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-3 py-2">
                {c.thumbnail && (
                  <img src={c.thumbnail} alt={c.store} className="w-8 h-8 object-contain rounded shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{c.store}</p>
                  {c.title && <p className="text-[10px] text-gray-400 truncate">{c.title}</p>}
                </div>
                <p className="text-sm font-bold text-gray-900 shrink-0">{fmt(c.price)}</p>
                {c.link && (
                  <a href={c.link} target="_blank" rel="noopener noreferrer"
                    className="text-gray-400 hover:text-blue-500 transition shrink-0"
                    onClick={e => e.stopPropagation()}>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
          {comp.scanned_at && (
            <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Escaneado {new Date(comp.scanned_at).toLocaleString("pt-BR")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function CompetitorsPage() {
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanQuery, setScanQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "cheaper" | "expensive">("all");
  const [serpError, setSerpError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getCompetitors(100);
      setComparisons(data.comparisons || []);
      setStats(data.stats);
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function scanOne() {
    if (!scanQuery.trim()) return;
    setScanning(true);
    setSerpError("");
    try {
      await api.scanCompetitor(undefined, scanQuery.trim());
      setScanQuery("");
      await load();
    } catch (e: any) {
      setSerpError(e.message || "Erro ao escanear");
    } finally { setScanning(false); }
  }

  async function scanAll() {
    setScanning(true);
    setSerpError("");
    try {
      const res = await api.scanAllCompetitors(20);
      await load();
      alert(`✅ ${res.scanned} produtos escaneados${res.errors > 0 ? ` (${res.errors} erros)` : ""}`);
    } catch (e: any) {
      setSerpError(e.message || "Erro ao escanear");
    } finally { setScanning(false); }
  }

  const filtered = comparisons.filter(c => {
    const diff = parseFloat(c.price_diff ?? c.priceDiff ?? "0");
    if (filter === "cheaper") return diff > 2;
    if (filter === "expensive") return diff < -2;
    return true;
  });

  const statCards = [
    { label: "Produtos monitorados", value: stats?.total ?? 0, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Somos mais baratos", value: stats?.cheaper ?? 0, icon: TrendingDown, color: "text-green-600", bg: "bg-green-50" },
    { label: "Somos mais caros", value: stats?.moreExpensive ?? 0, icon: TrendingUp, color: "text-red-600", bg: "bg-red-50" },
    { label: "Em linha com mercado", value: stats?.equal ?? 0, icon: Minus, color: "text-gray-600", bg: "bg-gray-50" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-red-500" />
            Monitor de Preços
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Compare seus preços com concorrentes via Google Shopping
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
          <button
            onClick={scanAll}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white transition"
          >
            <Zap className="w-3.5 h-3.5" />
            {scanning ? "Escaneando..." : "Escanear top 20 produtos"}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-4.5 h-4.5 ${c.color}`} style={{ width: 18, height: 18 }} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{c.value}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-tight">{c.label}</p>
            </div>
          );
        })}
      </div>

      {/* Search / scan single */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Buscar produto específico</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={scanQuery}
            onChange={e => setScanQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && scanOne()}
            placeholder="Ex: Caiaque Duplo Caiaker Merco..."
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-300 text-gray-900"
          />
          <button
            onClick={scanOne}
            disabled={scanning || !scanQuery.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white transition"
          >
            <Search className="w-4 h-4" />
            Buscar
          </button>
        </div>
        {serpError && (
          <div className="mt-2 flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {serpError.includes("SERPAPI_KEY") ? (
              <span>
                <strong>SERPAPI_KEY não configurada.</strong> Adicione no arquivo <code>.env</code> da VPS:<br />
                <code className="bg-red-100 px-1 rounded">SERPAPI_KEY=sua_chave_aqui</code>{" "}
                e reinicie com <code className="bg-red-100 px-1 rounded">docker compose up -d --build</code>.<br />
                Obtenha sua chave gratuita em{" "}
                <a href="https://serpapi.com" target="_blank" rel="noopener noreferrer" className="underline">serpapi.com</a>
                {" "}(100 buscas/mês grátis).
              </span>
            ) : serpError}
          </div>
        )}
      </div>

      {/* Filters */}
      {comparisons.length > 0 && (
        <div className="flex items-center gap-2">
          {[
            { key: "all", label: "Todos" },
            { key: "cheaper", label: "Somos mais baratos" },
            { key: "expensive", label: "Somos mais caros" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === f.key
                  ? "bg-red-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f.label}
              {f.key !== "all" && (
                <span className="ml-1 opacity-70">
                  ({f.key === "cheaper" ? stats?.cheaper : stats?.moreExpensive})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="space-y-2">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-xl border border-gray-200">
            <BarChart3 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">Nenhuma comparação encontrada</p>
            <p className="text-gray-400 text-xs mt-1">
              Clique em "Escanear top 20 produtos" ou busque um produto acima
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Você precisa ter produtos sincronizados em{" "}
              <a href="/dashboard/settings/stores" className="text-blue-500 underline">Configurações → Lojas</a>
            </p>
          </div>
        ) : (
          filtered.map((comp, i) => {
            const key = comp.id || i;
            return (
              <CompetitorRow
                key={key}
                comp={comp}
                expanded={expanded === String(key)}
                onToggle={() => setExpanded(expanded === String(key) ? null : String(key))}
              />
            );
          })
        )}
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
          <BarChart3 className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-blue-900">Como funciona</p>
          <p className="text-xs text-blue-700 mt-0.5">
            Usamos a API do Google Shopping (SerpAPI) para buscar seus produtos e comparar com os preços dos concorrentes.
            O plano gratuito inclui 100 buscas/mês. Para monitoramento contínuo, recomendamos o plano pago da SerpAPI.
          </p>
        </div>
      </div>
    </div>
  );
}
