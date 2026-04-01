"use client";
// @ts-nocheck
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  Activity, Eye, ShoppingCart, Users, Globe, Clock,
  RefreshCw, Radio, Package, Phone, Mail, ExternalLink,
  Filter, ChevronDown
} from "lucide-react";

const EVENT_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  active_on_site:  { label: "Navegando",         color: "bg-blue-100 text-blue-700",   icon: Globe },
  viewed_product:  { label: "Viu produto",        color: "bg-purple-100 text-purple-700", icon: Eye },
  added_to_cart:   { label: "Adicionou ao carrinho", color: "bg-orange-100 text-orange-700", icon: ShoppingCart },
};

function timeSince(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  return `${Math.floor(diff / 3600)}h atrás`;
}

function EventBadge({ event }: { event: string }) {
  const meta = EVENT_LABELS[event] || { label: event, color: "bg-gray-100 text-gray-600", icon: Activity };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
    </span>
  );
}

export default function TrackingPage() {
  const [stats, setStats]       = useState<any>(null);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [events, setEvents]     = useState<any[]>([]);
  const [eventFilter, setEventFilter] = useState("");
  const [tab, setTab]           = useState<"visitors" | "events">("visitors");
  const [loading, setLoading]   = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, v, e] = await Promise.all([
        api.getTrackingStats(),
        api.getLiveVisitors(),
        api.getTrackingEvents(eventFilter || undefined),
      ]);
      setStats(s.stats);
      setVisitors(v.visitors || []);
      setEvents(e.events || []);
      setLastRefresh(new Date());
    } catch {}
    finally { setLoading(false); }
  }, [eventFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const statCards = [
    { label: "Ao vivo agora",    value: stats?.live_now        ?? "–", icon: Radio,       color: "text-green-600",  bg: "bg-green-50"  },
    { label: "Visitantes únicos (7d)", value: stats?.unique_visitors ?? "–", icon: Users, color: "text-blue-600",   bg: "bg-blue-50"   },
    { label: "Produtos vistos (24h)", value: stats?.product_views_24h ?? "–", icon: Eye,  color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Carrinhos (24h)",   value: stats?.cart_events_24h ?? "–", icon: ShoppingCart, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Pageviews (24h)",   value: stats?.page_views_24h  ?? "–", icon: Activity,   color: "text-indigo-600", bg: "bg-indigo-50" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Radio className="w-6 h-6 text-green-500" />
            Rastreamento ao Vivo
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Monitore visitantes e eventos em tempo real na sua loja
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            Atualizado {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <button
            onClick={() => setAutoRefresh(a => !a)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
              autoRefresh
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-gray-50 text-gray-600 border-gray-200"
            }`}
          >
            <LiveDot />
            {autoRefresh ? "Auto (15s)" : "Pausado"}
          </button>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
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

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center border-b border-gray-200 px-4">
          <button
            onClick={() => setTab("visitors")}
            className={`py-3.5 px-4 text-sm font-medium border-b-2 transition -mb-px ${
              tab === "visitors"
                ? "border-red-500 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Visitantes ao vivo
              {visitors.length > 0 && (
                <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">
                  {visitors.length}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setTab("events")}
            className={`py-3.5 px-4 text-sm font-medium border-b-2 transition -mb-px ${
              tab === "events"
                ? "border-red-500 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Feed de eventos
            </span>
          </button>

          {tab === "events" && (
            <div className="ml-auto flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={eventFilter}
                onChange={e => setEventFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-red-300"
              >
                <option value="">Todos os eventos</option>
                <option value="active_on_site">Navegando</option>
                <option value="viewed_product">Viu produto</option>
                <option value="added_to_cart">Adicionou ao carrinho</option>
              </select>
            </div>
          )}
        </div>

        {/* Visitors tab */}
        {tab === "visitors" && (
          <div>
            {loading ? (
              <div className="py-16 text-center text-gray-400 text-sm">Carregando...</div>
            ) : visitors.length === 0 ? (
              <div className="py-16 text-center">
                <Radio className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-medium">Nenhum visitante ativo nos últimos 10 minutos</p>
                <p className="text-gray-400 text-xs mt-1">Instale o script de rastreamento na sua loja para ver visitantes aqui</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {visitors.map((v: any, i: number) => {
                  const name = v.first_name
                    ? `${v.first_name} ${v.last_name || ""}`.trim()
                    : v.email || "Visitante anônimo";
                  const hasCart = v.has_cart === true || v.has_cart === "true";
                  const hasProduct = v.has_product_view === true || v.has_product_view === "true";
                  return (
                    <div key={v.visitor_id || i} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 text-sm">{name}</span>
                          {hasCart && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-700 font-medium">
                              <ShoppingCart className="w-3 h-3" /> Tem carrinho
                            </span>
                          )}
                          {hasProduct && !hasCart && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700 font-medium">
                              <Eye className="w-3 h-3" /> Viu produto
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {v.email && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Mail className="w-3 h-3" /> {v.email}
                            </span>
                          )}
                          {v.phone && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Phone className="w-3 h-3" /> {v.phone}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Eye className="w-3 h-3" /> {v.page_views} pageview{v.page_views !== 1 ? "s" : ""}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="w-3 h-3" /> {timeSince(v.last_seen)}
                          </span>
                        </div>

                        {v.last_url && (
                          <a
                            href={v.last_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-500 hover:underline mt-1 truncate max-w-sm"
                          >
                            <Globe className="w-3 h-3 shrink-0" />
                            <span className="truncate">{v.last_url}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        )}

                        {v.last_product && (
                          <div className="flex items-center gap-1 text-xs text-purple-600 mt-0.5">
                            <Package className="w-3 h-3" /> {v.last_product}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Events tab */}
        {tab === "events" && (
          <div>
            {loading ? (
              <div className="py-16 text-center text-gray-400 text-sm">Carregando...</div>
            ) : events.length === 0 ? (
              <div className="py-16 text-center">
                <Activity className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-medium">Nenhum evento registrado</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {events.map((ev: any, i: number) => {
                  const name = ev.first_name
                    ? `${ev.first_name} ${ev.last_name || ""}`.trim()
                    : ev.email || ev.visitor_id?.slice(0, 10) + "…";
                  return (
                    <div key={ev.id || i} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition">
                      <EventBadge event={ev.event} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{name}</span>
                          {ev.product_name && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Package className="w-3 h-3" /> {ev.product_name}
                              {ev.product_price && (
                                <span className="text-gray-400 ml-1">
                                  R$ {parseFloat(ev.product_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        {ev.url && (
                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline truncate max-w-sm block mt-0.5"
                          >
                            {ev.url}
                          </a>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
                        {timeSince(ev.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tracking script hint */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
          <Globe className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-blue-900">Script de rastreamento</p>
          <p className="text-xs text-blue-700 mt-0.5">
            Para ver dados aqui, instale o script JS na sua loja.{" "}
            <a href="/dashboard/settings/stores" className="underline font-medium">
              Copie o script em Configurações → Lojas
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
