"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import { PageHeader, Button, Modal, Input, Select, Badge, Loading, EmptyState } from "@/components/ui";
import { Store, Plus, RefreshCw, Trash2, Link2, CheckCircle, AlertCircle, Clock, ExternalLink, Copy, Check } from "lucide-react";

export default function StoresPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectModal, setConnectModal] = useState(false);
  const [form, setForm] = useState({ name: "", platform: "woocommerce", apiUrl: "", apiKey: "", apiSecret: "" });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { loadStores(); }, []);

  async function loadStores() {
    try {
      const data = await api.getStores();
      setStores(data.stores || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function connectStore() {
    if (!form.name || !form.apiUrl || !form.apiKey) return;
    setSaving(true);
    try {
      await api.createStore(form);
      setConnectModal(false);
      setForm({ name: "", platform: "woocommerce", apiUrl: "", apiKey: "", apiSecret: "" });
      loadStores();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function syncStore(id: string) {
    setSyncing(id);
    try {
      await api.syncStore(id);
      setTimeout(() => { setSyncing(null); loadStores(); }, 2000);
    } catch (e) { console.error(e); setSyncing(null); }
  }

  async function deleteStore(id: string) {
    if (!confirm("Tem certeza que deseja desconectar esta loja?")) return;
    try {
      await api.deleteStore(id);
      loadStores();
    } catch (e) { console.error(e); }
  }

  const copyWebhook = (storeId: string, platform: string) => {
    const url = `${window.location.origin}/api/v1/webhooks/${platform}/${storeId}`;
    navigator.clipboard.writeText(url);
    setCopied(storeId);
    setTimeout(() => setCopied(null), 2000);
  };

  const syncStatusIcon = (status: string) => {
    switch (status) {
      case "synced": return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case "syncing": return <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />;
      case "error": return <AlertCircle className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-zinc-500" />;
    }
  };

  const platformLogos: Record<string, string> = {
    woocommerce: "🟣",
    magento: "🟠",
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader title="Lojas Conectadas" description="Gerencie suas integrações de e-commerce"
        actions={
          <Button size="sm" onClick={() => setConnectModal(true)}>
            <Plus className="w-3.5 h-3.5" /> Conectar Loja
          </Button>
        }
      />

      {stores.length === 0 ? (
        <EmptyState icon={<Store className="w-6 h-6" />} title="Nenhuma loja conectada"
          description="Conecte sua loja WooCommerce ou Magento para sincronizar clientes, pedidos e carrinhos."
          action={<Button size="sm" onClick={() => setConnectModal(true)}><Plus className="w-3.5 h-3.5" /> Conectar Loja</Button>} />
      ) : (
        <div className="space-y-4">
          {stores.map((store: any) => (
            <div key={store.id} className="bg-[#0f0f12] border border-zinc-800/60 rounded-xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{platformLogos[store.platform]}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-200">{store.name}</h3>
                    <p className="text-xs text-zinc-500">{store.platform === "woocommerce" ? "WooCommerce" : "Magento 2"} · {store.apiUrl}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {syncStatusIcon(store.syncStatus)}
                  <Badge color={store.isActive ? "#10b981" : "#ef4444"} size="xs">
                    {store.isActive ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-zinc-900/40 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">Status sync</p>
                  <p className="text-sm font-medium text-zinc-300 capitalize">{store.syncStatus || "pendente"}</p>
                </div>
                <div className="bg-zinc-900/40 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">Último sync</p>
                  <p className="text-sm font-medium text-zinc-300">{formatRelativeTime(store.lastSyncAt)}</p>
                </div>
                <div className="bg-zinc-900/40 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">Conectada em</p>
                  <p className="text-sm font-medium text-zinc-300">{formatDate(store.createdAt)}</p>
                </div>
                <div className="bg-zinc-900/40 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">Webhook</p>
                  <button onClick={() => copyWebhook(store.id, store.platform)}
                    className="text-sm font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                    {copied === store.id ? <><Check className="w-3 h-3" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar URL</>}
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => syncStore(store.id)}
                  loading={syncing === store.id}>
                  <RefreshCw className="w-3.5 h-3.5" /> Sincronizar
                </Button>
                <Button variant="danger" size="sm" onClick={() => deleteStore(store.id)}>
                  <Trash2 className="w-3.5 h-3.5" /> Desconectar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Connect Store Modal */}
      <Modal open={connectModal} onClose={() => setConnectModal(false)} title="Conectar Loja" size="md">
        <div className="space-y-4">
          <Select label="Plataforma" value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
            options={[
              { value: "woocommerce", label: "🟣 WooCommerce" },
              { value: "magento", label: "🟠 Magento 2" },
            ]} />

          <Input label="Nome da loja" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Minha Loja Principal" />

          <Input label="URL da API" value={form.apiUrl}
            onChange={(e) => setForm({ ...form, apiUrl: e.target.value })}
            placeholder={form.platform === "woocommerce" ? "https://sualoja.com" : "https://sualoja.com/rest/V1"} />

          <Input label={form.platform === "woocommerce" ? "Consumer Key" : "API Token"} value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            placeholder={form.platform === "woocommerce" ? "ck_xxxxxxxxxxxx" : "Bearer token"} />

          {form.platform === "woocommerce" && (
            <Input label="Consumer Secret" value={form.apiSecret}
              onChange={(e) => setForm({ ...form, apiSecret: e.target.value })}
              placeholder="cs_xxxxxxxxxxxx" />
          )}

          {/* Instructions */}
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-zinc-400 mb-2">
              {form.platform === "woocommerce" ? "Como obter as credenciais WooCommerce:" : "Como obter o token Magento:"}
            </h4>
            {form.platform === "woocommerce" ? (
              <ol className="text-xs text-zinc-500 space-y-1 list-decimal list-inside">
                <li>Acesse WordPress Admin → WooCommerce → Configurações → Avançado → REST API</li>
                <li>Clique em "Adicionar chave" com permissão de Leitura/Escrita</li>
                <li>Copie Consumer Key e Consumer Secret</li>
              </ol>
            ) : (
              <ol className="text-xs text-zinc-500 space-y-1 list-decimal list-inside">
                <li>Acesse Admin → System → Integrations → Add New</li>
                <li>Configure os recursos com acesso a Sales, Customers, Catalog</li>
                <li>Ative e copie o Access Token</li>
              </ol>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConnectModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={connectStore} loading={saving} className="flex-1">
              <Link2 className="w-4 h-4" /> Conectar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
