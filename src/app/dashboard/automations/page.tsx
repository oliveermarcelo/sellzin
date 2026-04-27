"use client";
// @ts-nocheck
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { PageHeader, Button, Badge, Modal, Input, Loading } from "@/components/ui";
import {
  Zap, Plus, ShoppingCart, Package, UserPlus, Calendar,
  TrendingUp, MessageCircle, Clock, ArrowRight, Trash2,
  Play, History, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";

// ── Trigger definitions ──
const TRIGGERS = [
  { value: "cart_abandoned",    label: "Carrinho Abandonado", icon: ShoppingCart, color: "#f97316" },
  { value: "order_placed",      label: "Pedido Realizado",    icon: Package,      color: "#6366f1" },
  { value: "order_shipped",     label: "Pedido Enviado",      icon: Package,      color: "#38bdf8" },
  { value: "order_delivered",   label: "Pedido Entregue",     icon: Package,      color: "#10b981" },
  { value: "customer_created",  label: "Novo Cliente",        icon: UserPlus,     color: "#10b981" },
  { value: "customer_birthday", label: "Aniversário",         icon: Calendar,     color: "#ec4899" },
  { value: "rfm_segment_change",label: "Mudança de Segmento", icon: TrendingUp,   color: "#fbbf24" },
  { value: "manual",            label: "Manual",              icon: Zap,          color: "#6b7280" },
];

const TEMPLATES = [
  {
    name: "Carrinho Abandonado — 30min",
    description: "Lembrete 30 minutos após abandono",
    trigger: "cart_abandoned",
    actions: [
      { type: "wait", delayValue: 30, delayUnit: "minutes" },
      { type: "whatsapp", message: "Oi {{nome}}! Vi que você deixou itens no carrinho 🛒 Posso te ajudar com alguma dúvida?" },
    ],
  },
  {
    name: "Carrinho Abandonado — 24h",
    description: "Cupom de desconto após 24 horas",
    trigger: "cart_abandoned",
    actions: [
      { type: "wait", delayValue: 24, delayUnit: "hours" },
      { type: "whatsapp", message: "{{nome}}, seu carrinho ainda está esperando! Use o cupom VOLTA10 para 10% de desconto. Válido por 24h ⏰" },
    ],
  },
  {
    name: "Carrinho Abandonado — 72h",
    description: "Última chance com oferta especial",
    trigger: "cart_abandoned",
    actions: [
      { type: "wait", delayValue: 72, delayUnit: "hours" },
      { type: "whatsapp", message: "Última chance, {{nome}}! Seu carrinho vai expirar. Frete grátis na sua próxima compra se finalizar agora 🎁" },
    ],
  },
  {
    name: "Boas-vindas",
    description: "Mensagem de boas-vindas para novos clientes",
    trigger: "customer_created",
    actions: [
      { type: "wait", delayValue: 5, delayUnit: "minutes" },
      { type: "whatsapp", message: "Olá {{nome}}, seja bem-vindo(a)! 🎉 Ficamos felizes em tê-lo(a) como cliente. Qualquer dúvida estamos aqui!" },
    ],
  },
  {
    name: "Pós-venda",
    description: "Acompanhamento após entrega do pedido",
    trigger: "order_delivered",
    actions: [
      { type: "wait", delayValue: 2, delayUnit: "days" },
      { type: "whatsapp", message: "Oi {{nome}}! Seu pedido chegou bem? 😊 Adoraríamos saber o que achou!" },
      { type: "wait", delayValue: 7, delayUnit: "days" },
      { type: "whatsapp", message: "{{nome}}, esperamos que tenha adorado! Temos novidades te esperando na loja 🛍️" },
    ],
  },
  {
    name: "Pedido Enviado",
    description: "Notifica com código de rastreamento",
    trigger: "order_shipped",
    actions: [
      { type: "whatsapp", message: "{{nome}}, seu pedido foi enviado! 🚚 Previsão de entrega: 3–7 dias úteis." },
    ],
  },
  {
    name: "Aniversário",
    description: "Cupom especial no aniversário do cliente",
    trigger: "customer_birthday",
    actions: [
      { type: "whatsapp", message: "Parabéns {{nome}}! 🎂🎉 Neste dia especial, preparamos um presente: use ANIVER15 para 15% de desconto. Válido por 7 dias!" },
    ],
  },
  {
    name: "Reativação de Inativos",
    description: "Reengaja clientes sem compra há 30 dias",
    trigger: "rfm_segment_change",
    actions: [
      { type: "whatsapp", message: "{{nome}}, sentimos sua falta! 💙 Temos uma oferta especial só para você. Confira as novidades!" },
      { type: "wait", delayValue: 5, delayUnit: "days" },
      { type: "whatsapp", message: "Última chance {{nome}}! Seu desconto exclusivo expira hoje ⏰" },
    ],
  },
];

function getTrigger(value: string) {
  return TRIGGERS.find(t => t.value === value) || TRIGGERS[TRIGGERS.length - 1];
}

function formatDelay(a: any) {
  const unit = a.delayUnit === "minutes" ? "min" : a.delayUnit === "hours" ? "h" : "d";
  return `${a.delayValue}${unit}`;
}

function blankAction(type = "whatsapp") {
  if (type === "wait") return { type: "wait", delayValue: 1, delayUnit: "hours" };
  if (type === "tag")  return { type: "tag", tag: "", action: "add" };
  return { type: "whatsapp", message: "" };
}

const ACTION_ICONS: Record<string, any> = { wait: Clock, whatsapp: MessageCircle, tag: Zap };

function RunStatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
  if (status === "failed")    return <XCircle className="w-3.5 h-3.5 text-red-500" />;
  if (status === "running")   return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
  return <Clock className="w-3.5 h-3.5 text-gray-400" />;
}

function timeAgo(date: string) {
  const d = new Date(date);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60)   return "agora";
  if (s < 3600) return `${Math.floor(s / 60)}min atrás`;
  if (s < 86400) return `${Math.floor(s / 3600)}h atrás`;
  return `${Math.floor(s / 86400)}d atrás`;
}

export default function AutomationsPage() {
  const [automationsList, setAutomationsList] = useState<any[]>([]);
  const [recentRuns, setRecentRuns]           = useState<any[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [saving, setSaving]                   = useState(false);
  const [modal, setModal]                     = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId]             = useState<string | null>(null);
  const [showTemplates, setShowTemplates]     = useState(true);
  const [togglingId, setTogglingId]           = useState<string | null>(null);
  const [deletingId, setDeletingId]           = useState<string | null>(null);
  const [runningId, setRunningId]             = useState<string | null>(null);
  const [testModal, setTestModal]             = useState<{ id: string; name: string } | null>(null);
  const [testPhone, setTestPhone]             = useState("");
  const [testName, setTestName]               = useState("Teste");
  const [activeTab, setActiveTab]             = useState<"list" | "history">("list");
  const [expandedId, setExpandedId]           = useState<string | null>(null);
  const [automationRuns, setAutomationRuns]   = useState<any[]>([]);
  const [loadingRuns, setLoadingRuns]         = useState(false);

  const EMPTY = { name: "", description: "", trigger: "cart_abandoned", actions: [] as any[] };
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    try {
      const [data, runsData] = await Promise.all([
        api.getAutomations(),
        api.getRecentRuns().catch(() => ({ runs: [] })),
      ]);
      setAutomationsList(data.automations || []);
      setRecentRuns(runsData.runs || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm(EMPTY);
    setEditingId(null);
    setShowTemplates(true);
    setModal("create");
  };

  const openEdit = (a: any) => {
    setForm({ name: a.name, description: a.description || "", trigger: a.trigger, actions: a.actions || [] });
    setEditingId(a.id);
    setShowTemplates(false);
    setModal("edit");
  };

  const applyTemplate = (t: any) => {
    setForm({ name: t.name, description: t.description, trigger: t.trigger, actions: t.actions });
    setShowTemplates(false);
  };

  const updateAction = (idx: number, patch: any) =>
    setForm(f => ({ ...f, actions: f.actions.map((a, i) => i === idx ? { ...a, ...patch } : a) }));

  const changeActionType = (idx: number, type: string) =>
    setForm(f => ({ ...f, actions: f.actions.map((a, i) => i === idx ? blankAction(type) : a) }));

  const removeAction = (idx: number) =>
    setForm(f => ({ ...f, actions: f.actions.filter((_, i) => i !== idx) }));

  const addStep = (type: string) =>
    setForm(f => ({ ...f, actions: [...f.actions, blankAction(type)] }));

  const save = async () => {
    if (!form.name.trim()) { alert("Nome é obrigatório"); return; }
    if (form.actions.length === 0) { alert("Adicione pelo menos uma ação"); return; }
    setSaving(true);
    try {
      if (editingId) {
        await api.updateAutomation(editingId, form);
      } else {
        await api.createAutomation(form);
      }
      await load();
      setModal(null);
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const toggle = async (id: string) => {
    setTogglingId(id);
    try {
      const res = await api.toggleAutomation(id);
      setAutomationsList(prev => prev.map(a => a.id === id ? { ...a, isActive: res.automation.isActive } : a));
    } catch (e: any) { alert(e.message); }
    finally { setTogglingId(null); }
  };

  const del = async (id: string) => {
    if (!confirm("Excluir esta automação?")) return;
    setDeletingId(id);
    try {
      await api.deleteAutomation(id);
      setAutomationsList(prev => prev.filter(a => a.id !== id));
    } catch (e: any) { alert(e.message); }
    finally { setDeletingId(null); }
  };

  const openTestModal = (a: any) => {
    setTestModal({ id: a.id, name: a.name });
    setTestPhone("");
    setTestName("Teste");
  };

  const runManual = async () => {
    if (!testModal) return;
    if (!testPhone.trim()) { alert("Informe o número de WhatsApp para teste"); return; }
    setRunningId(testModal.id);
    try {
      await api.runAutomation(testModal.id, { phone: testPhone.trim(), name: testName.trim() || "Teste" });
      setTestModal(null);
      await load();
      setTimeout(() => setActiveTab("history"), 300);
    } catch (e: any) { alert(e.message); }
    finally { setRunningId(null); }
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    setLoadingRuns(true);
    try {
      const data = await api.getAutomationRuns(id);
      setAutomationRuns(data.runs || []);
    } catch { setAutomationRuns([]); }
    finally { setLoadingRuns(false); }
  };

  if (loading) return <Loading />;

  const activeCount = automationsList.filter(a => a.isActive).length;
  const totalExec   = automationsList.reduce((s, a) => s + (a.totalExecutions  || 0), 0);
  const totalConv   = automationsList.reduce((s, a) => s + (a.totalConversions || 0), 0);

  return (
    <div>
      <PageHeader
        title="Automações"
        description="Fluxos automáticos de engajamento"
        actions={<Button size="sm" onClick={openCreate}><Plus className="w-3.5 h-3.5" /> Nova Automação</Button>}
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Ativas",      value: activeCount },
          { label: "Execuções",   value: totalExec },
          { label: "Conversões",  value: totalConv },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {[
          { key: "list",    label: "Automações" },
          { key: "history", label: `Histórico${recentRuns.length > 0 ? ` (${recentRuns.length})` : ""}` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition -mb-px ${
              activeTab === tab.key
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "list" ? (
        <>
          {/* Automation List */}
          {automationsList.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-indigo-500" />
              </div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Nenhuma automação criada</h3>
              <p className="text-sm text-gray-400 mb-4">Crie fluxos automáticos para engajar seus clientes</p>
              <Button size="sm" onClick={openCreate}><Plus className="w-3.5 h-3.5" /> Criar Automação</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {automationsList.map(a => {
                const trig = getTrigger(a.trigger);
                const TrigIcon = trig.icon;
                const isExpanded = expandedId === a.id;
                return (
                  <div key={a.id} className={`bg-white border rounded-xl overflow-hidden transition ${a.isActive ? "border-indigo-200" : "border-gray-200"}`}>
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: trig.color + "18" }}>
                            <TrigIcon className="w-4 h-4" style={{ color: trig.color }} />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-800">{a.name}</h3>
                            {a.description && <p className="text-xs text-gray-400 mt-0.5">{a.description}</p>}
                          </div>
                        </div>
                        {/* Toggle */}
                        <button
                          onClick={() => toggle(a.id)}
                          disabled={!!togglingId}
                          className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${a.isActive ? "bg-indigo-500" : "bg-gray-300"}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${a.isActive ? "left-[22px]" : "left-0.5"}`} />
                        </button>
                      </div>

                      {/* Flow preview */}
                      <div className="flex items-center gap-1 mb-3 flex-wrap">
                        <Badge color={trig.color} size="xs">{trig.label}</Badge>
                        {(a.actions || []).slice(0, 6).map((action: any, i: number) => {
                          const AIcon = ACTION_ICONS[action.type] || Zap;
                          return (
                            <div key={i} className="flex items-center gap-1">
                              <ArrowRight className="w-2.5 h-2.5 text-gray-300" />
                              <div className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center"
                                title={action.type === "wait" ? `Aguardar ${formatDelay(action)}` : action.message || action.type}>
                                <AIcon className="w-3 h-3 text-gray-500" />
                              </div>
                              {action.type === "wait" && (
                                <span className="text-[10px] text-gray-400">{formatDelay(action)}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span>{a.totalExecutions || 0} execuções</span>
                          <span>{a.totalConversions || 0} conversões</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleExpand(a.id)}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                          >
                            <History className="w-3.5 h-3.5" />
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => openTestModal(a)}
                            disabled={!!runningId}
                            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                            title="Disparar manualmente com um número de teste"
                          >
                            <Play className="w-3.5 h-3.5" />
                            Testar
                          </button>
                          <button onClick={() => openEdit(a)}
                            className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                            Editar
                          </button>
                          <button onClick={() => del(a.id)} disabled={deletingId === a.id}
                            className="text-xs text-gray-400 hover:text-red-500">
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Inline run history */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                        {loadingRuns ? (
                          <p className="text-xs text-gray-400 text-center py-2">Carregando...</p>
                        ) : automationRuns.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-2">Nenhuma execução ainda</p>
                        ) : (
                          <div className="space-y-1.5">
                            {automationRuns.slice(0, 5).map((run: any) => (
                              <div key={run.id} className="flex items-center gap-2 text-xs text-gray-600">
                                <RunStatusIcon status={run.status} />
                                <span className="capitalize">{run.status}</span>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-400">{timeAgo(run.started_at)}</span>
                                {run.contact_id && (
                                  <>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-gray-500 truncate max-w-[120px]">
                                      {run.first_name || run.contact_email || "Contato"}
                                    </span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* ── History Tab ── */
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {recentRuns.length === 0 ? (
            <div className="py-12 text-center">
              <History className="w-8 h-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Nenhuma execução registrada ainda</p>
              <p className="text-xs text-gray-400 mt-1">
                As execuções aparecerão aqui quando automações forem disparadas
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Automação</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contato</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Iniciado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentRuns.map((run: any) => {
                  const trig = getTrigger(run.automation_trigger);
                  return (
                    <tr key={run.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800 text-xs">{run.automation_name || "—"}</p>
                        <p className="text-[10px] text-gray-400">{trig.label}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {run.contact_id
                          ? ([run.first_name, run.last_name].filter(Boolean).join(" ") || run.contact_email || "—")
                          : <span className="text-gray-400">Sem contato</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          run.status === "completed" ? "bg-green-100 text-green-700" :
                          run.status === "failed"    ? "bg-red-100 text-red-700" :
                          run.status === "running"   ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          <RunStatusIcon status={run.status} />
                          {run.status === "completed" ? "Concluído" :
                           run.status === "failed"    ? "Erro" :
                           run.status === "running"   ? "Executando" : "Ignorado"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {timeAgo(run.started_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Test Modal */}
      <Modal
        open={!!testModal}
        onClose={() => setTestModal(null)}
        title={`Testar: ${testModal?.name}`}
        size="sm"
      >
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
            A automação será disparada agora e percorrerá todos os passos (incluindo esperas). A mensagem de WhatsApp será enviada para o número informado.
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">Número de WhatsApp para teste</label>
            <input
              type="tel"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              placeholder="Ex: 5511999999999"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-indigo-400"
              onKeyDown={e => e.key === "Enter" && runManual()}
            />
            <p className="text-[10px] text-gray-400">Formato: código país + DDD + número (sem +, espaços ou traços)</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">Nome para {"{{nome}}"}</label>
            <input
              type="text"
              value={testName}
              onChange={e => setTestName(e.target.value)}
              placeholder="Nome do contato de teste"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={runManual} loading={!!runningId} className="flex-1">
              <Play className="w-3.5 h-3.5" /> Disparar Agora
            </Button>
            <Button variant="secondary" onClick={() => setTestModal(null)} className="flex-1">
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal === "edit" ? "Editar Automação" : "Nova Automação"}
        size="lg"
      >
        {modal === "create" && showTemplates ? (
          /* ── Templates ── */
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Escolha um template ou crie do zero:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
              {TEMPLATES.map((t, i) => {
                const trig = getTrigger(t.trigger);
                const TIcon = trig.icon;
                return (
                  <button key={i} onClick={() => applyTemplate(t)}
                    className="text-left p-3 rounded-lg border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition">
                    <div className="flex items-center gap-2 mb-1">
                      <TIcon className="w-4 h-4 shrink-0" style={{ color: trig.color }} />
                      <span className="text-sm font-medium text-gray-800">{t.name}</span>
                    </div>
                    <p className="text-xs text-gray-400">{t.description}</p>
                  </button>
                );
              })}
            </div>
            <Button variant="secondary" size="sm" onClick={() => setShowTemplates(false)} className="w-full">
              Criar do Zero
            </Button>
          </div>
        ) : (
          /* ── Form ── */
          <div className="space-y-4">
            {modal === "create" && (
              <button onClick={() => setShowTemplates(true)}
                className="text-xs text-indigo-500 hover:underline">
                ← Voltar aos templates
              </button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Nome da automação" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Carrinho Abandonado" />
              <Input label="Descrição (opcional)" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Breve descrição do fluxo" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Gatilho</label>
              <select value={form.trigger}
                onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-red-500 transition">
                {TRIGGERS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Actions builder */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">
                Passos do Fluxo ({form.actions.length})
              </label>

              <div className="space-y-2">
                {form.actions.map((action, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                      {/* Type selector */}
                      <select value={action.type}
                        onChange={e => changeActionType(idx, e.target.value)}
                        className="w-full px-2 py-1.5 rounded-md bg-white border border-gray-300 text-xs text-gray-700 focus:outline-none focus:border-red-500">
                        <option value="wait">⏱ Aguardar</option>
                        <option value="whatsapp">💬 Enviar WhatsApp</option>
                        <option value="tag">🏷 Adicionar / Remover Tag</option>
                      </select>

                      {/* Wait fields */}
                      {action.type === "wait" && (
                        <div className="flex gap-2">
                          <input type="number" min={1} value={action.delayValue || 1}
                            onChange={e => updateAction(idx, { delayValue: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-20 px-2 py-1.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:border-red-500" />
                          <select value={action.delayUnit || "hours"}
                            onChange={e => updateAction(idx, { delayUnit: e.target.value })}
                            className="flex-1 px-2 py-1.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:border-red-500">
                            <option value="minutes">minutos</option>
                            <option value="hours">horas</option>
                            <option value="days">dias</option>
                          </select>
                        </div>
                      )}

                      {/* WhatsApp fields */}
                      {action.type === "whatsapp" && (
                        <div>
                          <textarea value={action.message || ""}
                            onChange={e => updateAction(idx, { message: e.target.value })}
                            placeholder="Mensagem... Use {{nome}}, {{total}}, {{order_number}}, etc."
                            rows={3}
                            className="w-full px-2 py-1.5 rounded-md border border-gray-300 text-xs text-gray-700 resize-none focus:outline-none focus:border-red-500" />
                          <p className="text-[10px] text-gray-400 mt-1">
                            Variáveis: {"{{nome}}"} {"{{email}}"} {"{{total}}"} {"{{order_number}}"} {"{{items}}"} {"{{checkout_url}}"}
                          </p>
                        </div>
                      )}

                      {/* Tag fields */}
                      {action.type === "tag" && (
                        <div className="flex gap-2">
                          <input value={action.tag || ""}
                            onChange={e => updateAction(idx, { tag: e.target.value })}
                            placeholder="nome-da-tag"
                            className="flex-1 px-2 py-1.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:border-red-500" />
                          <select value={action.action || "add"}
                            onChange={e => updateAction(idx, { action: e.target.value })}
                            className="px-2 py-1.5 rounded-md border border-gray-300 text-xs focus:outline-none focus:border-red-500">
                            <option value="add">Adicionar</option>
                            <option value="remove">Remover</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <button onClick={() => removeAction(idx)}
                      className="mt-1 p-1 rounded text-gray-400 hover:text-red-500 transition shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {form.actions.length === 0 && (
                  <p className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">
                    Nenhum passo adicionado
                  </p>
                )}
              </div>

              {/* Add step buttons */}
              <div className="flex gap-2 mt-3 flex-wrap">
                <button onClick={() => addStep("whatsapp")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </button>
                <button onClick={() => addStep("wait")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
                  <Clock className="w-3.5 h-3.5" /> Aguardar
                </button>
                <button onClick={() => addStep("tag")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
                  <Zap className="w-3.5 h-3.5" /> Tag
                </button>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={save} loading={saving} className="flex-1">
                {modal === "edit" ? "Salvar Alterações" : "Criar Automação"}
              </Button>
              <Button variant="secondary" onClick={() => setModal(null)} className="flex-1">
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
