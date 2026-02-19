"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { formatCurrency, formatNumber, formatDate, formatRelativeTime, getStatusLabel, getStatusColor } from "@/lib/utils";
import { PageHeader, Button, Table, Badge, Loading, Modal, StatCard, Select, Tabs, Input } from "@/components/ui";
import { Megaphone, Send, Plus, BarChart3, Eye, Zap, Users, MessageCircle, MousePointer, DollarSign } from "lucide-react";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [statsModal, setStatsModal] = useState<any>(null);
  const [form, setForm] = useState({ name: "", channel: "whatsapp", template: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadCampaigns(); }, [tab]);

  async function loadCampaigns() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (tab !== "all") params.status = tab;
      const data = await api.getCampaigns(params);
      setCampaigns(data.campaigns || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function createCampaign() {
    if (!form.name) return;
    setSaving(true);
    try {
      await api.createCampaign(form);
      setCreateModal(false);
      setForm({ name: "", channel: "whatsapp", template: "" });
      loadCampaigns();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function viewStats(id: string) {
    try {
      const data = await api.getCampaignStats(id);
      setStatsModal(data);
    } catch (e) { console.error(e); }
  }

  const channelIcons: Record<string, any> = {
    whatsapp: "🟢", email: "📧", sms: "💬", telegram: "✈️",
  };

  return (
    <div>
      <PageHeader title="Campanhas" description="Engaje seus clientes com campanhas direcionadas"
        actions={
          <Button size="sm" onClick={() => setCreateModal(true)}>
            <Plus className="w-3.5 h-3.5" /> Nova Campanha
          </Button>
        }
      />

      <Tabs tabs={[
        { id: "all", label: "Todas" },
        { id: "draft", label: "Rascunhos" },
        { id: "running", label: "Em execução" },
        { id: "completed", label: "Concluídas" },
      ]} active={tab} onChange={setTab} />

      <div className="mt-4">
        {loading ? <Loading /> : campaigns.length === 0 ? (
          <div className="bg-[#0f0f12] border border-zinc-800/60 rounded-xl p-12 text-center">
            <Megaphone className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-zinc-400 mb-1">Nenhuma campanha</h3>
            <p className="text-sm text-zinc-600 mb-4">Crie sua primeira campanha para engajar seus clientes</p>
            <Button size="sm" onClick={() => setCreateModal(true)}><Plus className="w-3.5 h-3.5" /> Criar Campanha</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((c: any) => {
              const deliveryRate = c.totalSent > 0 ? ((c.totalDelivered / c.totalSent) * 100).toFixed(0) : "0";
              const readRate = c.totalDelivered > 0 ? ((c.totalRead / c.totalDelivered) * 100).toFixed(0) : "0";
              return (
                <div key={c.id} className="bg-[#0f0f12] border border-zinc-800/60 rounded-xl p-5 hover:border-zinc-700/60 transition">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{channelIcons[c.channel] || "📨"}</span>
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-200">{c.name}</h3>
                        <p className="text-[10px] text-zinc-600">{formatRelativeTime(c.createdAt)}</p>
                      </div>
                    </div>
                    <Badge color={getStatusColor(c.status)} size="xs">{getStatusLabel(c.status)}</Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center">
                      <p className="text-sm font-bold text-zinc-300">{formatNumber(c.totalRecipients)}</p>
                      <p className="text-[10px] text-zinc-600">Destinatários</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-zinc-300">{deliveryRate}%</p>
                      <p className="text-[10px] text-zinc-600">Entregues</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-zinc-300">{readRate}%</p>
                      <p className="text-[10px] text-zinc-600">Lidas</p>
                    </div>
                  </div>

                  {c.totalConverted > 0 && (
                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg px-3 py-2 mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-emerald-400">{c.totalConverted} conversões</span>
                        <span className="text-xs font-semibold text-emerald-400">{formatCurrency(c.revenue)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => viewStats(c.id)} className="flex-1">
                      <BarChart3 className="w-3 h-3" /> Stats
                    </Button>
                    {c.status === "draft" && (
                      <Button size="sm" className="flex-1"><Send className="w-3 h-3" /> Enviar</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Campaign Modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Nova Campanha" size="md">
        <div className="space-y-4">
          <Input label="Nome da campanha" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Black Friday 2024" />

          <Select label="Canal" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}
            options={[
              { value: "whatsapp", label: "🟢 WhatsApp" },
              { value: "email", label: "📧 Email" },
              { value: "sms", label: "💬 SMS" },
            ]} />

          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Mensagem / Template</label>
            <textarea value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })}
              placeholder="Olá {nome}, temos uma oferta especial para você..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none" />
            <p className="text-[10px] text-zinc-600 mt-1">Variáveis: {"{nome}"}, {"{email}"}, {"{ultimo_produto}"}, {"{cupom}"}</p>
          </div>

          <div className="bg-zinc-900/50 rounded-lg p-3">
            <p className="text-xs text-zinc-500">
              <Zap className="w-3 h-3 inline mr-1 text-indigo-400" />
              A IA pode gerar mensagens personalizadas para cada contato. Deixe o template em branco para ativação automática.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCreateModal(false)} className="flex-1">Cancelar</Button>
            <Button onClick={createCampaign} loading={saving} className="flex-1">Criar Campanha</Button>
          </div>
        </div>
      </Modal>

      {/* Stats Modal */}
      <Modal open={!!statsModal} onClose={() => setStatsModal(null)} title="Estatísticas da Campanha" size="md">
        {statsModal && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-white">{statsModal.campaign.name}</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-900/50 rounded-lg p-3 text-center">
                <Users className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{formatNumber(statsModal.campaign.totalRecipients)}</p>
                <p className="text-[10px] text-zinc-600">Destinatários</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3 text-center">
                <Send className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{formatNumber(statsModal.campaign.totalSent)}</p>
                <p className="text-[10px] text-zinc-600">Enviadas</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3 text-center">
                <Eye className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{statsModal.rates.readRate}%</p>
                <p className="text-[10px] text-zinc-600">Taxa de Leitura</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-3 text-center">
                <MousePointer className="w-4 h-4 text-zinc-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-white">{statsModal.rates.conversionRate}%</p>
                <p className="text-[10px] text-zinc-600">Conversão</p>
              </div>
            </div>

            {/* Funnel */}
            <div>
              <h4 className="text-xs font-semibold text-zinc-400 mb-3">Funil</h4>
              {[
                { label: "Enviadas", value: statsModal.campaign.totalSent, color: "#6366f1" },
                { label: "Entregues", value: statsModal.campaign.totalDelivered, color: "#38bdf8" },
                { label: "Lidas", value: statsModal.campaign.totalRead, color: "#a78bfa" },
                { label: "Clicadas", value: statsModal.campaign.totalClicked, color: "#fbbf24" },
                { label: "Convertidas", value: statsModal.campaign.totalConverted, color: "#10b981" },
              ].map((step, i) => {
                const maxVal = statsModal.campaign.totalSent || 1;
                const pct = (step.value / maxVal) * 100;
                return (
                  <div key={i} className="mb-2">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-zinc-500">{step.label}</span>
                      <span className="text-xs font-medium text-zinc-400">{formatNumber(step.value)}</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: step.color }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {parseFloat(statsModal.campaign.revenue) > 0 && (
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-4 text-center">
                <DollarSign className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-xl font-bold text-emerald-400">{formatCurrency(statsModal.campaign.revenue)}</p>
                <p className="text-xs text-zinc-500">Receita gerada</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
