"use client";
// @ts-nocheck
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, ShoppingBag, Store, TrendingUp, Shield, LogOut, Edit2, Trash2, CheckCircle, XCircle, ChevronLeft, ChevronRight } from "lucide-react";

function formatCurrency(v: any) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(v) || 0);
}
function formatDate(d: any) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-blue-50 text-blue-700 border border-blue-100",
  growth: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  enterprise: "bg-amber-50 text-amber-700 border border-amber-100",
};

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<any>(null);
  const [editForm, setEditForm] = useState({ plan: "", isActive: true });

  const getToken = () => typeof window !== "undefined" ? localStorage.getItem("sellzin_admin_token") : null;

  const adminFetch = async (path: string, options: any = {}) => {
    const token = getToken();
    if (!token) { router.push("/admin/login"); throw new Error("No token"); }
    const res = await fetch(`${window.location.protocol}//${window.location.hostname}:3001/v1/admin${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
    });
    if (res.status === 401 || res.status === 403) { router.push("/admin/login"); throw new Error("Unauthorized"); }
    return res.json();
  };

  const loadAll = async (page = 1) => {
    setLoading(true);
    try {
      const [statsData, tenantsData] = await Promise.all([
        adminFetch("/stats"),
        adminFetch(`/tenants?page=${page}`),
      ]);
      setStats(statsData);
      setTenants(tenantsData.tenants || []);
      setPagination(tenantsData.pagination || { page: 1, pages: 1, total: 0 });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!getToken()) { router.push("/admin/login"); return; }
    loadAll();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("sellzin_admin_token");
    router.push("/admin/login");
  };

  const openEdit = (tenant: any) => {
    setEditModal(tenant);
    setEditForm({ plan: tenant.plan, isActive: tenant.isActive });
  };

  const handleEdit = async () => {
    try {
      await adminFetch(`/tenants/${editModal.id}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      setEditModal(null);
      await loadAll(pagination.page);
    } catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir permanentemente o tenant "${name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await adminFetch(`/tenants/${id}`, { method: "DELETE" });
      await loadAll(pagination.page);
    } catch (e: any) { alert(e.message); }
  };

  const handleToggleActive = async (tenant: any) => {
    try {
      await adminFetch(`/tenants/${tenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !tenant.isActive }),
      });
      await loadAll(pagination.page);
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold text-sm">S</div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">Sellzin Admin</h1>
            <p className="text-xs text-gray-400">Painel de super administrador</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-gray-500 hover:text-red-500 transition">
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Tenants", value: stats.tenants.total, sub: `+${stats.tenants.newThisMonth} este mês`, icon: <Shield className="w-4 h-4" />, color: "text-red-600 bg-red-50" },
              { label: "Receita Total", value: formatCurrency(stats.orders.revenue), sub: formatCurrency(stats.orders.revenueThisMonth) + " este mês", icon: <TrendingUp className="w-4 h-4" />, color: "text-emerald-600 bg-emerald-50" },
              { label: "Contatos", value: stats.contacts.total.toLocaleString("pt-BR"), sub: "em todos os tenants", icon: <Users className="w-4 h-4" />, color: "text-blue-600 bg-blue-50" },
              { label: "Lojas", value: stats.stores.total, sub: "conectadas", icon: <Store className="w-4 h-4" />, color: "text-amber-600 bg-amber-50" },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{s.label}</span>
                  <span className={`p-1.5 rounded-lg ${s.color}`}>{s.icon}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Plan distribution */}
        {stats && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Distribuição por Plano</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Starter", count: stats.tenants.starter, color: "bg-blue-500" },
                { label: "Growth", count: stats.tenants.growth, color: "bg-emerald-500" },
                { label: "Enterprise", count: stats.tenants.enterprise, color: "bg-amber-500" },
              ].map(p => {
                const pct = stats.tenants.total > 0 ? (p.count / stats.tenants.total) * 100 : 0;
                return (
                  <div key={p.label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-gray-600">{p.label}</span>
                      <span className="text-xs font-semibold text-gray-800">{p.count} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${p.color} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tenants table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Tenants ({pagination.total})</h3>
          </div>

          {loading ? (
            <div className="py-20 text-center text-gray-400 text-sm">Carregando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {["Empresa", "Email", "Plano", "Pedidos", "Receita", "Contatos", "Lojas", "Criado em", "Status", ""].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tenants.map((t: any) => (
                    <tr key={t.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{t.name}</p>
                        <p className="text-xs text-gray-400">{t.id.slice(0, 8)}...</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{t.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-md ${PLAN_COLORS[t.plan]}`}>
                          {t.plan.charAt(0).toUpperCase() + t.plan.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{t.stats?.orders || 0}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium">{formatCurrency(t.stats?.revenue)}</td>
                      <td className="px-4 py-3 text-gray-600">{t.stats?.contacts || 0}</td>
                      <td className="px-4 py-3 text-gray-600">{t.stats?.stores || 0}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(t.createdAt)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleToggleActive(t)} title={t.isActive ? "Desativar" : "Ativar"}>
                          {t.isActive
                            ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                            : <XCircle className="w-4 h-4 text-red-400" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(t.id, t.name)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination.pages > 1 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">Página {pagination.page} de {pagination.pages}</span>
              <div className="flex gap-1">
                <button onClick={() => loadAll(pagination.page - 1)} disabled={pagination.page <= 1}
                  className="p-1.5 rounded-lg bg-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-200 transition">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => loadAll(pagination.page + 1)} disabled={pagination.page >= pagination.pages}
                  className="p-1.5 rounded-lg bg-gray-100 text-gray-600 disabled:opacity-30 hover:bg-gray-200 transition">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditModal(null)} />
          <div className="relative bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Editar: {editModal.name}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">Plano</label>
                <select value={editForm.plan} onChange={e => setEditForm(f => ({ ...f, plan: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-red-500">
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="isActive" checked={editForm.isActive}
                  onChange={e => setEditForm(f => ({ ...f, isActive: e.target.checked }))}
                  className="rounded border-gray-300" />
                <label htmlFor="isActive" className="text-sm text-gray-700">Conta ativa</label>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={handleEdit}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition">
                Salvar
              </button>
              <button onClick={() => setEditModal(null)}
                className="flex-1 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
