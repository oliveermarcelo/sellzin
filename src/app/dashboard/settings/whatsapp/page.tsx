"use client";
// @ts-nocheck
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageHeader, Button, Input, Badge, Loading, Modal } from "@/components/ui";
import { MessageSquare, Plus, Trash2, RefreshCw, Wifi, WifiOff, Loader2, QrCode, Copy, Check, ExternalLink } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  connected: "Conectado",
  connecting: "Conectando",
  disconnected: "Desconectado",
  error: "Erro",
};

const STATUS_COLORS: Record<string, string> = {
  connected: "#10b981",
  connecting: "#f59e0b",
  disconnected: "#6b7280",
  error: "#ef4444",
};

export default function WhatsAppSettingsPage() {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [qrModal, setQrModal] = useState<any>(null);
  const [qrPolling, setQrPolling] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Poll QR when modal is open without a QR
  useEffect(() => {
    if (!qrModal || qrModal.qr) return;
    let attempts = 0;
    const maxAttempts = 10;
    setQrPolling(true);
    const interval = setInterval(async () => {
      attempts++;
      try {
        const data = await api.request(`/whatsapp/channels/${qrModal.channel.id}/qr`);
        const qr = extractQrBase64(data.qr);
        if (qr) {
          setQrModal((prev: any) => prev ? { ...prev, qr } : null);
          setQrPolling(false);
          clearInterval(interval);
          return;
        }
      } catch (e) {}
      if (attempts >= maxAttempts) {
        setQrPolling(false);
        clearInterval(interval);
      }
    }, 3000);
    return () => { clearInterval(interval); setQrPolling(false); };
  }, [qrModal?.channel?.id, !!qrModal?.qr]);

  const [form, setForm] = useState({
    provider: "evolution",
    name: "",
    instanceName: "",
    evolutionUrl: "http://evolution:8080",
    evolutionKey: "sellzin-evolution-key",
    phoneNumberId: "",
    accessToken: "",
    verifyToken: "",
    businessAccountId: "",
  });

  const loadChannels = async () => {
    try {
      const data = await api.request("/whatsapp/channels");
      setChannels(data.channels || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadChannels(); }, []);

  const extractQrBase64 = (qr: any): string | null => {
    if (!qr) return null;
    const raw = qr.base64 || qr.qrcode?.base64 || qr.code || null;
    if (!raw) return null;
    // Strip data URI prefix if present
    return raw.replace(/^data:image\/[^;]+;base64,/, "");
  };

  const handleAdd = async () => {
    setActionLoading("add");
    try {
      const res = await api.request("/whatsapp/channels", { method: "POST", body: form });
      const { channel, qr } = res;
      setAddModal(false);
      setForm({ provider: "evolution", name: "", instanceName: "", evolutionUrl: "http://evolution:8080", evolutionKey: "sellzin-evolution-key", phoneNumberId: "", accessToken: "", verifyToken: "", businessAccountId: "" });
      await loadChannels();

      // Show QR from create response (already returned by backend)
      if (form.provider === "evolution") {
        const qrBase64 = extractQrBase64(qr);
        if (qrBase64) {
          setQrModal({ channel, qr: qrBase64 });
        } else {
          // Fallback: fetch QR separately
          try {
            const data = await api.request(`/whatsapp/channels/${channel.id}/qr`);
            setQrModal({ channel, qr: extractQrBase64(data.qr) });
          } catch (e) { /* QR not ready yet */ }
        }
      }
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este canal WhatsApp?")) return;
    setActionLoading(id);
    try {
      await api.request(`/whatsapp/channels/${id}`, { method: "DELETE" });
      await loadChannels();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(null); }
  };

  const handleQR = async (channel: any) => {
    setActionLoading(channel.id + "-qr");
    try {
      const data = await api.request(`/whatsapp/channels/${channel.id}/qr`);
      setQrModal({ channel, qr: extractQrBase64(data.qr) });
      await loadChannels();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(null); }
  };

  const handleReconnect = async (id: string) => {
    setActionLoading(id + "-reconnect");
    try {
      const data = await api.request(`/whatsapp/channels/${id}/reconnect`, { method: "POST", body: {} });
      await loadChannels();
      if (data.status !== "connected") {
        const ch = channels.find(c => c.id === id);
        const qrBase64 = extractQrBase64(data.qr);
        setQrModal({ channel: ch, qr: qrBase64 || null });
      }
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(null); }
  };

  const copyWebhookUrl = (channel: any) => {
    const url = `${window.location.protocol}//${window.location.hostname}:3001/v1/whatsapp/webhook/evolution/${channel.instanceName}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const officialWebhookUrl = `${typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:3001` : ""}/v1/whatsapp/webhook/official`;

  return (
    <div>
      <PageHeader
        title="WhatsApp"
        description="Configure canais WhatsApp para envio de mensagens"
        actions={
          <Button size="sm" onClick={() => setAddModal(true)}>
            <Plus className="w-3.5 h-3.5" /> Novo Canal
          </Button>
        }
      />

      {loading ? (
        <Loading />
      ) : channels.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-6 h-6 text-green-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Nenhum canal configurado</h3>
          <p className="text-sm text-gray-400 mb-4">Conecte a Evolution API ou a API Oficial do WhatsApp</p>
          <Button size="sm" onClick={() => setAddModal(true)}>
            <Plus className="w-3.5 h-3.5" /> Adicionar Canal
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map((ch: any) => (
            <div key={ch.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{ch.name}</h3>
                      <Badge color={STATUS_COLORS[ch.status]}>{STATUS_LABELS[ch.status] || ch.status}</Badge>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
                        {ch.provider === "evolution" ? "Evolution API" : "API Oficial"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {ch.provider === "evolution" ? `Instância: ${ch.instanceName}` : `Número: ${ch.phoneNumber || "—"}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {ch.provider === "evolution" && ch.status !== "connected" && (
                    <Button size="sm" variant="secondary" onClick={() => handleQR(ch)}
                      loading={actionLoading === ch.id + "-qr"}>
                      <QrCode className="w-3.5 h-3.5" /> QR Code
                    </Button>
                  )}
                  {ch.provider === "evolution" && (
                    <Button size="sm" variant="secondary" onClick={() => handleReconnect(ch.id)}
                      loading={actionLoading === ch.id + "-reconnect"}>
                      <RefreshCw className="w-3.5 h-3.5" /> Reconectar
                    </Button>
                  )}
                  {ch.provider === "evolution" && (
                    <button onClick={() => copyWebhookUrl(ch)}
                      className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:text-gray-700 transition" title="Copiar URL do Webhook">
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                  <button onClick={() => handleDelete(ch.id)}
                    className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:text-red-500 transition"
                    disabled={actionLoading === ch.id}>
                    {actionLoading === ch.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {ch.provider === "evolution" && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    <span className="font-medium text-gray-500">Webhook URL:</span>{" "}
                    <span className="font-mono">{`...${"/v1/whatsapp/webhook/evolution/" + ch.instanceName}`}</span>
                    {" "}— Configure na Evolution API
                  </p>
                </div>
              )}

              {ch.provider === "official" && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    <span className="font-medium text-gray-500">Webhook URL:</span>{" "}
                    <span className="font-mono">/v1/whatsapp/webhook/official</span>
                    {" "}— Configure no Meta Business Manager
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Channel Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Adicionar Canal WhatsApp" size="lg">
        <div className="space-y-4">
          {/* Provider selector */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Provedor</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "evolution", label: "Evolution API", desc: "Self-hosted, QR Code" },
                { value: "official", label: "API Oficial Meta", desc: "WhatsApp Business API" },
              ].map(p => (
                <button key={p.value} onClick={() => setForm(f => ({ ...f, provider: p.value }))}
                  className={`p-3 rounded-lg border text-left transition ${
                    form.provider === p.value
                      ? "border-red-500 bg-red-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}>
                  <p className={`text-sm font-medium ${form.provider === p.value ? "text-red-700" : "text-gray-800"}`}>{p.label}</p>
                  <p className="text-xs text-gray-500">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <Input label="Nome do canal" value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Ex: WhatsApp Principal" />

          {form.provider === "evolution" && (
            <>
              <Input label="URL da Evolution API" value={form.evolutionUrl}
                onChange={(e) => setForm(f => ({ ...f, evolutionUrl: e.target.value }))}
                placeholder="http://37.27.205.228:8080" />
              <Input label="API Key da Evolution" value={form.evolutionKey}
                onChange={(e) => setForm(f => ({ ...f, evolutionKey: e.target.value }))}
                placeholder="sua-chave-evolution" />
              <Input label="Nome da instância (opcional)" value={form.instanceName}
                onChange={(e) => setForm(f => ({ ...f, instanceName: e.target.value }))}
                placeholder="Gerado automaticamente por tenant" />
            </>
          )}

          {form.provider === "official" && (
            <>
              <Input label="Phone Number ID" value={form.phoneNumberId}
                onChange={(e) => setForm(f => ({ ...f, phoneNumberId: e.target.value }))}
                placeholder="123456789012345" />
              <Input label="Access Token" value={form.accessToken}
                onChange={(e) => setForm(f => ({ ...f, accessToken: e.target.value }))}
                placeholder="EAAxxxxx..." />
              <Input label="Business Account ID" value={form.businessAccountId}
                onChange={(e) => setForm(f => ({ ...f, businessAccountId: e.target.value }))}
                placeholder="987654321098765" />
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <p className="text-xs text-blue-700 font-medium mb-1">Configuração do Webhook no Meta</p>
                <p className="text-xs text-blue-600">URL: <span className="font-mono">{officialWebhookUrl}</span></p>
                <p className="text-xs text-blue-600 mt-1">O Verify Token será gerado automaticamente após salvar.</p>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleAdd} loading={actionLoading === "add"} className="flex-1">
              Criar Canal
            </Button>
            <Button variant="secondary" onClick={() => setAddModal(false)} className="flex-1">
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* QR Code Modal */}
      <Modal open={!!qrModal} onClose={() => setQrModal(null)} title="Escanear QR Code" size="sm">
        {qrModal && (
          <div className="text-center space-y-4">
            <p className="text-sm text-gray-500">
              Abra o WhatsApp no celular → Aparelhos Conectados → Conectar aparelho
            </p>
            {qrModal.qr ? (
              <img src={`data:image/png;base64,${qrModal.qr}`} alt="QR Code"
                className="mx-auto w-64 h-64 rounded-lg border border-gray-200" />
            ) : (
              <div className="w-64 h-64 mx-auto rounded-lg border border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-2">
                {qrPolling ? (
                  <>
                    <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                    <p className="text-sm text-gray-400">Aguardando QR Code...</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">QR Code não disponível</p>
                )}
              </div>
            )}
            <p className="text-xs text-gray-400">
              O QR code expira em ~60 segundos. Clique em Reconectar para gerar um novo.
            </p>
            <Button variant="secondary" size="sm" onClick={() => setQrModal(null)} className="w-full">
              Fechar
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
