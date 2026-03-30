"use client";
// @ts-nocheck
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Store, TrendingUp, Shield, LogOut, Edit2, Trash2,
  CheckCircle, XCircle, ChevronLeft, ChevronRight, UserPlus,
  LogIn, Clock, LayoutDashboard, Settings, CreditCard, RefreshCw,
  AlertCircle, Package
} from "lucide-react";

const fmt = (v: any) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(v) || 0);
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const fmtNum = (v: any) => Number(v || 0).toLocaleString("pt-BR");

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-blue-50 text-blue-700 border-blue-200",
  growth: "bg-emerald-50 text-emerald-700 border-emerald-200",
  enterprise: "bg-amber-50 text-amber-700 border-amber-200",
};

const PLANS = [
  { id: "starter", label: "Starter", price: "R$ 97/mês", contacts: 2000, stores: 1, messages: 500, color: "#3b82f6" },
  { id: "growth", label: "Growth", price: "R$ 297/mês", contacts: 15000, stores: 3, messages: 99999, color: "#10b981" },
  { id: "enterprise", label: "Enterprise", price: "Sob consulta", contacts: 99999, stores: 99, messages: 99999, color: "#f59e0b" },
];

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState("tenants");
  const [stats, setStats] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ type: string; tenant?: any } | null>(null);
  const [form, setForm] = useState<any>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const getToken = () => typeof window !== "undefined" ? localStorage.getItem("sellzin_admin_token") : null;

  const req = async (path: string, options: any = {}) => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); throw new Error("No token"); }
    const res = await fetch(`${window.location.protocol}//${window.location.hostname}:3001/v1/admin${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
    });
    if (res.status === 401 || res.status === 403) { router.push("/admin/login"); throw new Error("Unauthorized"); }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro");
    return data;
  };

  const loadAll = async (page = 1) => {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([req("/stats"), req(`/tenants?page=${page}`)]);
      setStats(s);
      setTenants(t.tenants || []);
      setPagination(t.pagination || { page: 1, pages: 1, total: 0 });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!getToken()) { router.push("/admin/login"); return; }
    loadAll();
  }, []);

  const openModal = (type: string, tenant?: any) => {
    setModal({ type, tenant });
    if (type === "edit") setForm({ plan: tenant.plan, isActive: tenant.isActive, name: tenant.name });
    if (type === "trial") setForm({ days: 14 });
    if (type === "create") setForm({ name: "", email: "", password: "", plan: "starter" });
  };

  const handleEdit = async () => {
    setActionLoading("edit");
    try {
      await req(`/tenants/${modal!.tenant.id}`, { method: "PATCH", body: JSON.stringify(form) });
      showToast("Tenant atualizado!");
      setModal(null);
      await loadAll(pagination.page);
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(null); }
  };

  const handleCreate = async () => {
    setActionLoading("create");
    try {
      await req("/tenants", { method: "POST", body: JSON.stringify(form) });
      showToast("Tenant criado com sucesso!");
      setModal(null);
      await loadAll(1);
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(null); }
  };

  const handleExtendTrial = async () => {
    setActionLoading("trial");
    try {
      await req(`/tenants/${modal!.tenant.id}/extend-trial`, { method: "POST", body: JSON.stringify({ days: parseInt(form.days) }) });
      showToast(`Trial estendido por ${form.days} dias!`);
      setModal(null);
      await loadAll(pagination.page);
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(null); }
  };

  const handleDelete = async (t: any) => {
    if (!confirm(`Excluir permanentemente "${t.name}"? Todos os dados serão perdidos.`)) return;
    setActionLoading("del-" + t.id);
    try {
      await req(`/tenants/${t.id}`, { method: "DELETE" });
      showToast("Tenant excluído.");
      await loadAll(pagination.page);
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(null); }
  };

  const handleImpersonate = async (t: any) => {
    setActionLoading("imp-" + t.id);
    try {
      const data = await req(`/tenants/${t.id}/impersonate`, { method: "POST" });
      localStorage.setItem("sellzin_token", data.token);
      window.open("/dashboard", "_blank");
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(null); }
  };

  const handleToggle = async (t: any) => {
    try {
      await req(`/tenants/${t.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !t.isActive }) });
      showToast(t.isActive ? "Tenant desativado." : "Tenant ativado!");
      await loadAll(pagination.page);
    } catch (e: any) { alert(e.message); }
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "tenants", label: "Tenants", icon: Users },
    { id: "plans", label: "Planos", icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-[#111] border-r border-gray-800 flex flex-col shrink-0">
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold text-sm">S</div>
          <div>
            <p className="text-sm font-bold text-white">Sellzin</p>
            <p className="text-[10px] text-gray-500">Super Admin</p>
          </div>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => setTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition text-left ${
                  tab === item.id ? "bg-red-600/15 text-red-400" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60"
                }`}>
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-gray-800 p-3">
          <button onClick={() => { localStorage.removeItem("sellzin_admin_token"); router.push("/admin/login"); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-gray-800/50 transition">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">

          {/* Dashboard Tab */}
          {tab === "dashboard" && stats && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-6">Dashboard Global</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Tenants", value: fmtNum(stats.tenants.total), sub: `+${stats.tenants.newThisMonth} este mês`, color: "bg-red-50 text-red-600" },
                  { label: "Receita Total", value: fmt(stats.orders.revenue), sub: fmt(stats.orders.revenueThisMonth) + " este mês", color: "bg-emerald-50 text-emerald-600" },
                  { label: "Pedidos", value: fmtNum(stats.orders.total), sub: "em todos os tenants", color: "bg-blue-50 text-blue-600" },
                  { label: "Contatos", value: fmtNum(stats.contacts.total), sub: "cadastrados", color: "bg-amber-50 text-amber-600" },
                ].map(s => (
                  <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-5">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{s.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                    <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Distribuição por Plano</h3>
                <div className="space-y-3">
                  {[
                    { label: "Starter", count: stats.tenants.starter, color: "bg-blue-500" },
                    { label: "Growth", count: stats.tenants.growth, color: "bg-emerald-500" },
                    { label: "Enterprise", count: stats.tenants.enterprise, color: "bg-amber-500" },
                  ].map(p => {
                    const pct = stats.tenants.total > 0 ? (p.count / stats.tenants.total) * 100 : 0;
                    return (
                      <div key={p.label} className="flex items-center gap-4">
                        <span className="text-sm text-gray-600 w-20">{p.label}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${p.color} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-sm font-semibold text-gray-800 w-20 text-right">{p.count} ({pct.toFixed(0)}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tenants Tab */}
          {tab === "tenants" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">Tenants ({pagination.total})</h2>
                <button onClick={() => openModal("create")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition">
                  <UserPlus className="w-4 h-4" /> Novo Tenant
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {loading ? (
                  <div className="py-20 text-center text-gray-400">Carregando...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          {["Empresa", "Email", "Plano", "Pedidos", "Receita", "Trial", "Status", "Ações"].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {tenants.map((t: any) => {
                          const trialDays = t.trialEndsAt ? Math.ceil((new Date(t.trialEndsAt).getTime() - Date.now()) / 86400000) : null;
                          return (
                            <tr key={t.id} className="hover:bg-gray-50 transition">
                              <td className="px-4 py-3">
                                <p className="font-semibold text-gray-900">{t.name}</p>
                                <p className="text-xs text-gray-400">{t.id.slice(0, 8)}...</p>
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-xs">{t.email}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-semibold px-2 py-1 rounded-md border ${PLAN_COLORS[t.plan]}`}>
                                  {t.plan.charAt(0).toUpperCase() + t.plan.slice(1)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-700">{fmtNum(t.stats?.orders)}</td>
                              <td className="px-4 py-3 text-gray-700 font-medium">{fmt(t.stats?.revenue)}</td>
                              <td className="px-4 py-3">
                                {trialDays !== null && trialDays > 0 ? (
                                  <span className="text-xs text-amber-600 font-medium">{trialDays}d restantes</span>
                                ) : trialDays !== null ? (
                                  <span className="text-xs text-red-500">Expirado</span>
                                ) : <span className="text-xs text-gray-400">—</span>}
                              </td>
                              <td className="px-4 py-3">
                                <button onClick={() => handleToggle(t)} title={t.isActive ? "Desativar" : "Ativar"}>
                                  {t.isActive
                                    ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                                    : <XCircle className="w-4 h-4 text-red-400" />}
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <button onClick={() => openModal("edit", t)} title="Editar plano/status"
                                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs transition">
                                    <Edit2 className="w-3 h-3" /> Editar
                                  </button>
                                  <button onClick={() => openModal("trial", t)} title="Estender trial"
                                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs transition">
                                    <Clock className="w-3 h-3" /> Trial
                                  </button>
                                  <button onClick={() => handleImpersonate(t)} title="Acessar como este tenant"
                                    disabled={actionLoading === "imp-" + t.id}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs transition disabled:opacity-50">
                                    <LogIn className="w-3 h-3" /> Acessar
                                  </button>
                                  <button onClick={() => handleDelete(t)} title="Excluir"
                                    disabled={actionLoading === "del-" + t.id}
                                    className="p-1.5 rounded-md bg-red-50 hover:bg-red-100 text-red-500 transition disabled:opacity-50">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {pagination.pages > 1 && (
                  <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Página {pagination.page} de {pagination.pages}</span>
                    <div className="flex gap-1">
                      <button onClick={() => loadAll(pagination.page - 1)} disabled={pagination.page <= 1}
                        className="p-1.5 rounded-lg bg-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-200">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button onClick={() => loadAll(pagination.page + 1)} disabled={pagination.page >= pagination.pages}
                        className="p-1.5 rounded-lg bg-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-200">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Plans Tab */}
          {tab === "plans" && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-6">Planos</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {PLANS.map(p => (
                  <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-base font-bold text-gray-900">{p.label}</h3>
                        <p className="text-sm text-gray-500">{p.price}</p>
                      </div>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: "Contatos", value: p.contacts >= 99999 ? "Ilimitado" : fmtNum(p.contacts) },
                        { label: "Lojas", value: p.stores >= 99 ? "Ilimitado" : p.stores },
                        { label: "Msgs WhatsApp/mês", value: p.messages >= 99999 ? "Ilimitado" : fmtNum(p.messages) },
                      ].map(f => (
                        <div key={f.label} className="flex justify-between py-2 border-b border-gray-50">
                          <span className="text-sm text-gray-500">{f.label}</span>
                          <span className="text-sm font-semibold text-gray-800">{f.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-400">
                        {stats ? (
                          <>
                            {stats.tenants[p.id] || 0} tenant{(stats.tenants[p.id] || 0) !== 1 ? "s" : ""} neste plano
                          </>
                        ) : "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  Os limites dos planos são definidos no código. Para alterar preços ou limites, edite as configurações e faça o redeploy.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Edit Modal */}
      {modal?.type === "edit" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal(null)} />
          <div className="relative bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Editar Tenant</h2>
            <p className="text-sm text-gray-500 mb-5">{modal.tenant.name} · {modal.tenant.email}</p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Nome</label>
                <input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Plano</label>
                <select value={form.plan} onChange={e => setForm((f: any) => ({ ...f, plan: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-red-500">
                  <option value="starter">Starter — R$ 97/mês</option>
                  <option value="growth">Growth — R$ 297/mês</option>
                  <option value="enterprise">Enterprise — Sob consulta</option>
                </select>
              </div>
              <div className="flex items-center gap-3 py-2">
                <input type="checkbox" id="isActive" checked={form.isActive}
                  onChange={e => setForm((f: any) => ({ ...f, isActive: e.target.checked }))}
                  className="rounded border-gray-300 text-red-600" />
                <label htmlFor="isActive" className="text-sm text-gray-700">Conta ativa</label>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={handleEdit} disabled={actionLoading === "edit"}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition disabled:opacity-50">
                {actionLoading === "edit" ? "Salvando..." : "Salvar Alterações"}
              </button>
              <button onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trial Modal */}
      {modal?.type === "trial" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal(null)} />
          <div className="relative bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Estender Trial</h2>
            <p className="text-sm text-gray-500 mb-5">{modal.tenant.name}</p>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Dias adicionais</label>
              <input type="number" value={form.days} min={1} max={365}
                onChange={e => setForm((f: any) => ({ ...f, days: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-red-500" />
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleExtendTrial} disabled={actionLoading === "trial"}
                className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition disabled:opacity-50">
                {actionLoading === "trial" ? "Salvando..." : `Estender ${form.days} dias`}
              </button>
              <button onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {modal?.type === "create" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal(null)} />
          <div className="relative bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-5">Criar Novo Tenant</h2>
            <div className="space-y-4">
              {[
                { label: "Nome da empresa", key: "name", type: "text", placeholder: "Ex: Loja do João" },
                { label: "Email", key: "email", type: "email", placeholder: "joao@empresa.com" },
                { label: "Senha inicial", key: "password", type: "password", placeholder: "Mínimo 8 caracteres" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-gray-600 block mb-1.5">{f.label}</label>
                  <input type={f.type} value={form[f.key] || ""} placeholder={f.placeholder}
                    onChange={e => setForm((prev: any) => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-red-500" />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Plano inicial</label>
                <select value={form.plan} onChange={e => setForm((f: any) => ({ ...f, plan: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-red-500">
                  <option value="starter">Starter — R$ 97/mês</option>
                  <option value="growth">Growth — R$ 297/mês</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={handleCreate} disabled={actionLoading === "create"}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition disabled:opacity-50">
                {actionLoading === "create" ? "Criando..." : "Criar Tenant"}
              </button>
              <button onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
