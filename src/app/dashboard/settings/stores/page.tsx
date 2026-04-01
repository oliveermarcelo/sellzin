"use client";
// @ts-nocheck
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import { PageHeader, Button, Modal, Input, Select, Badge, Loading, EmptyState } from "@/components/ui";
import {
  Store, Plus, RefreshCw, Trash2, Link2, CheckCircle, AlertCircle,
  Clock, Copy, Check, Package, Code2, ChevronDown, ChevronUp, Activity, Users,
} from "lucide-react";

export default function StoresPage() {
  const { tenant } = useAuth();
  const [stores,        setStores]        = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [connectModal,  setConnectModal]  = useState(false);
  const [form,          setForm]          = useState({ name: "", platform: "woocommerce", apiUrl: "", apiKey: "", apiSecret: "" });
  const [saving,        setSaving]        = useState(false);
  const [syncing,       setSyncing]       = useState<string | null>(null);
  const [syncingCat,    setSyncingCat]    = useState<string | null>(null);
  const [copied,        setCopied]        = useState<string | null>(null);
  const [expandScript,  setExpandScript]  = useState<string | null>(null);
  const [liveStats,     setLiveStats]     = useState<any>(null);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [customUrl,     setCustomUrl]     = useState("");

  useEffect(() => { loadStores(); loadLiveStats(); }, []);

  async function loadStores() {
    try {
      const data = await api.getStores();
      setStores(data.stores || []);
      // Load product counts
      try {
        const prods = await api.getProducts();
        const counts: Record<string, number> = {};
        (prods.products || []).forEach((p: any) => {
          counts[p.storeId] = (counts[p.storeId] || 0) + 1;
        });
        setProductCounts(counts);
      } catch (e) {}
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function loadLiveStats() {
    try {
      const data = await api.getTrackingStats();
      setLiveStats(data.stats);
    } catch (e) {}
  }

  async function connectStore() {
    if (!form.name || !form.apiUrl || !form.apiKey) return;
    setSaving(true);
    try {
      await api.createStore(form);
      setConnectModal(false);
      setForm({ name: "", platform: "woocommerce", apiUrl: "", apiKey: "", apiSecret: "" });
      loadStores();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function syncStore(id: string) {
    setSyncing(id);
    try {
      await api.syncStore(id);
      setTimeout(() => { setSyncing(null); loadStores(); }, 2000);
    } catch (e) { setSyncing(null); }
  }

  async function syncCatalog(id: string) {
    setSyncingCat(id);
    try {
      const res = await api.syncProducts(id);
      alert(`✅ ${res.synced} produtos sincronizados com sucesso!`);
      loadStores();
    } catch (e: any) { alert("Erro ao sincronizar: " + e.message); }
    finally { setSyncingCat(null); }
  }

  async function deleteStore(id: string) {
    if (!confirm("Tem certeza que deseja desconectar esta loja?")) return;
    try { await api.deleteStore(id); loadStores(); } catch (e) {}
  }

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const getTrackingScript = (apiKey: string, crmOrigin: string) => `<script>
(function(){
  var CRM_KEY="${apiKey}";
  var CRM_URL="${crmOrigin}/api/track";
  var vid=localStorage.getItem("_crm_vid")||("v_"+Math.random().toString(36).slice(2,10));
  localStorage.setItem("_crm_vid",vid);
  function send(evt,data){
    var p=Object.assign({event:evt,visitorId:vid,tenantKey:CRM_KEY,url:location.href},data||{});
    if(navigator.sendBeacon){navigator.sendBeacon(CRM_URL,new Blob([JSON.stringify(p)],{type:"application/json"}));}
    else{fetch(CRM_URL,{method:"POST",body:JSON.stringify(p),headers:{"Content-Type":"application/json"},keepalive:true}).catch(function(){});}
  }
  // Active on site
  send("active_on_site",{page:document.title});
  // Viewed product (Magento 2)
  var skuEl=document.querySelector("[itemprop='sku']");
  var nameEl=document.querySelector(".page-title .base, h1.product-name");
  var priceEl=document.querySelector(".price-final_price .price, .price");
  if(skuEl&&nameEl){send("viewed_product",{productSku:(skuEl.textContent||"").trim(),productName:(nameEl.textContent||"").trim(),productPrice:(priceEl?priceEl.textContent:"").replace(/[^0-9.,]/g,"")});}
  // Add to cart click (Magento 2)
  document.addEventListener("click",function(e){
    var btn=e.target.closest("#product-addtocart-button,.tocart,[data-role='tocart']");
    if(btn){var form=btn.closest("form");var sku=form&&form.querySelector("[name='product']")?form.querySelector("[name='product']").value:"";send("added_to_cart",{productSku:sku});}
  },true);
  // Identify logged-in customer (Magento 2)
  try{require(["Magento_Customer/js/model/customer"],function(c){if(c.isLoggedIn&&c.isLoggedIn()){var d=c.customerData;if(d&&d.email)send("identify",{email:d.email});}});}catch(e){}
  // Capture email on checkout (Magento 2 + WooCommerce) — works with SPA via MutationObserver
  function attachEmailCapture(){
    var sel="#customer-email,input[name='username'],#billing_email,.input-text[autocomplete='email'],input[type='email']";
    document.querySelectorAll(sel).forEach(function(el){
      if(el._crmBound)return;el._crmBound=true;
      if(el.value&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim()))send("identify",{email:el.value.trim()});
      el.addEventListener("blur",function(){var v=this.value.trim();if(v&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))send("identify",{email:v});});
    });
  }
  attachEmailCapture();
  var _crmObs=new MutationObserver(function(){attachEmailCapture();});
  _crmObs.observe(document.body,{childList:true,subtree:true});
  // WooCommerce add to cart
  document.addEventListener("click",function(e){
    var btn=e.target.closest(".add_to_cart_button,.single_add_to_cart_button");
    if(btn){var sku=btn.dataset.productSku||btn.closest("[data-product_sku]")&&btn.closest("[data-product_sku]").dataset.product_sku||"";send("added_to_cart",{productSku:sku,productName:document.querySelector("h1.product_title")&&document.querySelector("h1.product_title").textContent||""});}
  },true);
})();
</script>`;

  const syncStatusIcon = (status: string) => {
    if (status === "synced")  return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    if (status === "syncing") return <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />;
    if (status === "error")   return <AlertCircle className="w-4 h-4 text-red-400" />;
    return <Clock className="w-4 h-4 text-gray-400" />;
  };

  const CRM_ORIGIN = customUrl.trim()
    || (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.host}` : "");

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

      {/* Live tracking stats */}
      {liveStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Ao vivo agora", value: liveStats.live_now || 0, icon: <Activity className="w-4 h-4 text-emerald-500" />, color: "text-emerald-600" },
            { label: "Visitas (24h)", value: liveStats.page_views_24h || 0, icon: <Users className="w-4 h-4 text-gray-400" />, color: "text-gray-800" },
            { label: "Produtos vistos (24h)", value: liveStats.product_views_24h || 0, icon: <Package className="w-4 h-4 text-gray-400" />, color: "text-gray-800" },
            { label: "Carrinhos (24h)", value: liveStats.cart_events_24h || 0, icon: <Store className="w-4 h-4 text-gray-400" />, color: "text-gray-800" },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">{s.icon}<p className="text-xs text-gray-500">{s.label}</p></div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {stores.length === 0 ? (
        <EmptyState icon={<Store className="w-6 h-6" />} title="Nenhuma loja conectada"
          description="Conecte sua loja WooCommerce ou Magento para sincronizar clientes, pedidos e carrinhos."
          action={<Button size="sm" onClick={() => setConnectModal(true)}><Plus className="w-3.5 h-3.5" /> Conectar Loja</Button>} />
      ) : (
        <div className="space-y-4">
          {stores.map((store: any) => {
            const scriptOpen = expandScript === store.id;
            const script = getTrackingScript(tenant?.apiKey || "SUA_API_KEY", CRM_ORIGIN);
            return (
              <div key={store.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{store.platform === "woocommerce" ? "🟣" : "🟠"}</span>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-800">{store.name}</h3>
                        <p className="text-xs text-gray-500">
                          {store.platform === "woocommerce" ? "WooCommerce" : "Magento 2"} · {store.apiUrl}
                        </p>
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
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Status sync</p>
                      <p className="text-sm font-medium text-gray-700 capitalize">{store.syncStatus || "pendente"}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Último sync</p>
                      <p className="text-sm font-medium text-gray-700">{formatRelativeTime(store.lastSyncAt)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Produtos</p>
                      <p className="text-sm font-medium text-gray-700">{productCounts[store.id] || 0} sincronizados</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Conectada em</p>
                      <p className="text-sm font-medium text-gray-700">{formatDate(store.createdAt)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => syncStore(store.id)}
                      loading={syncing === store.id}>
                      <RefreshCw className="w-3.5 h-3.5" /> Sync Pedidos
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => syncCatalog(store.id)}
                      loading={syncingCat === store.id}>
                      <Package className="w-3.5 h-3.5" /> Sync Catálogo
                    </Button>
                    <Button variant="secondary" size="sm"
                      onClick={() => setExpandScript(scriptOpen ? null : store.id)}>
                      <Code2 className="w-3.5 h-3.5" />
                      Script de Rastreamento
                      {scriptOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => deleteStore(store.id)}>
                      <Trash2 className="w-3.5 h-3.5" /> Desconectar
                    </Button>
                  </div>
                </div>

                {/* Tracking Script Panel */}
                {scriptOpen && expandScript === store.id && (
                  <div className="border-t border-gray-100 bg-yellow-50 px-5 py-3 flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        URL pública do CRM <span className="text-gray-400 font-normal">(se usar proxy/domínio próprio)</span>
                      </label>
                      <input
                        type="text"
                        value={customUrl}
                        onChange={e => setCustomUrl(e.target.value)}
                        placeholder={`Ex: https://efish.com.br (deixe vazio para usar ${typeof window !== "undefined" ? window.location.host : ""})`}
                        className="w-full text-xs border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      />
                    </div>
                  </div>
                )}
                {scriptOpen && (
                  <div className="border-t border-gray-100 bg-gray-50 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                          <Code2 className="w-4 h-4 text-indigo-500" />
                          Script de Rastreamento Web
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Cole este código antes de <code className="bg-gray-200 px-1 rounded text-xs">&lt;/body&gt;</code> em todas as páginas da sua loja.
                        </p>
                      </div>
                      <button onClick={() => copyText(script, store.id + "-script")}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-800 transition">
                        {copied === store.id + "-script" ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                      </button>
                    </div>

                    <pre className="bg-gray-900 text-gray-200 text-[11px] rounded-lg p-4 overflow-x-auto leading-relaxed max-h-48 overflow-y-auto">
                      {script}
                    </pre>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { icon: "👁️", label: "active_on_site", desc: "Visitante ativo na loja" },
                        { icon: "🔍", label: "viewed_product", desc: "Produto visualizado" },
                        { icon: "🛒", label: "added_to_cart", desc: "Produto adicionado ao carrinho" },
                      ].map(ev => (
                        <div key={ev.label} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2.5">
                          <span className="text-base">{ev.icon}</span>
                          <div>
                            <p className="text-[10px] font-mono font-semibold text-indigo-600">{ev.label}</p>
                            <p className="text-[10px] text-gray-400">{ev.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="text-[11px] text-gray-400 mt-3">
                      O script detecta automaticamente Magento 2 e WooCommerce. Para identificar clientes logados, o Magento 2 é suportado nativamente.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Connect Store Modal */}
      <Modal open={connectModal} onClose={() => setConnectModal(false)} title="Conectar Loja" size="md">
        <div className="space-y-4">
          <Select label="Plataforma" value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
            options={[
              { value: "woocommerce", label: "🟣 WooCommerce" },
              { value: "magento",     label: "🟠 Magento 2" },
            ]} />

          <Input label="Nome da loja" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Minha Loja Principal" />

          <Input label="URL base da loja" value={form.apiUrl}
            onChange={(e) => setForm({ ...form, apiUrl: e.target.value })}
            placeholder="https://sualoja.com" />

          <Input label={form.platform === "woocommerce" ? "Consumer Key" : "Access Token"} value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            placeholder={form.platform === "woocommerce" ? "ck_xxxxxxxxxxxx" : "access_token"} />

          {form.platform === "woocommerce" && (
            <Input label="Consumer Secret" value={form.apiSecret}
              onChange={(e) => setForm({ ...form, apiSecret: e.target.value })}
              placeholder="cs_xxxxxxxxxxxx" />
          )}

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-gray-600 mb-2">
              {form.platform === "woocommerce" ? "Credenciais WooCommerce:" : "Token de integração Magento 2:"}
            </h4>
            {form.platform === "woocommerce" ? (
              <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
                <li>WooCommerce → Configurações → Avançado → REST API</li>
                <li>Adicionar chave com permissão Leitura/Escrita</li>
                <li>Copie Consumer Key e Secret</li>
              </ol>
            ) : (
              <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
                <li>Admin Magento → System → Integrations → Add New</li>
                <li>Permissões: Sales, Customers, Catalog</li>
                <li>Ativar e copiar o Access Token</li>
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
