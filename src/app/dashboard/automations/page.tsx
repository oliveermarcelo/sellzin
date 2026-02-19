"use client";
// @ts-nocheck
import { useState } from "react";
import { PageHeader, Button, Badge, Modal, Input, Select } from "@/components/ui";
import { Zap, Plus, Play, Pause, ShoppingCart, Package, UserPlus, Calendar, TrendingUp, MessageCircle, Mail, Gift, Clock, ArrowRight, MoreVertical } from "lucide-react";

const PRESET_AUTOMATIONS = [
  {
    id: "cart_30min",
    name: "Carrinho Abandonado — 30 min",
    description: "Envia lembrete 30 minutos após abandono",
    trigger: "cart_abandoned",
    icon: ShoppingCart,
    color: "#f97316",
    actions: [
      { type: "wait", delay: "30 minutos" },
      { type: "whatsapp", message: "Lembrete sutil com link do carrinho" },
    ],
  },
  {
    id: "cart_24h",
    name: "Carrinho Abandonado — 24h",
    description: "Mensagem com urgência e cupom após 24 horas",
    trigger: "cart_abandoned",
    icon: ShoppingCart,
    color: "#f97316",
    actions: [
      { type: "wait", delay: "24 horas" },
      { type: "whatsapp", message: "Urgência + cupom de desconto" },
    ],
  },
  {
    id: "cart_72h",
    name: "Carrinho Abandonado — 72h",
    description: "Última chance com oferta especial",
    trigger: "cart_abandoned",
    icon: ShoppingCart,
    color: "#f97316",
    actions: [
      { type: "wait", delay: "72 horas" },
      { type: "whatsapp", message: "Última chance + frete grátis" },
    ],
  },
  {
    id: "welcome",
    name: "Boas-vindas",
    description: "Mensagem de boas-vindas para novos clientes",
    trigger: "customer_created",
    icon: UserPlus,
    color: "#10b981",
    actions: [
      { type: "wait", delay: "5 minutos" },
      { type: "whatsapp", message: "Boas-vindas personalizada" },
    ],
  },
  {
    id: "post_purchase",
    name: "Pós-venda",
    description: "Acompanhamento após entrega",
    trigger: "order_delivered",
    icon: Package,
    color: "#6366f1",
    actions: [
      { type: "wait", delay: "2 dias" },
      { type: "whatsapp", message: "Pedir avaliação + NPS" },
      { type: "wait", delay: "7 dias" },
      { type: "whatsapp", message: "Sugerir produtos relacionados" },
    ],
  },
  {
    id: "birthday",
    name: "Aniversário",
    description: "Cupom de desconto no aniversário do cliente",
    trigger: "customer_birthday",
    icon: Calendar,
    color: "#ec4899",
    actions: [
      { type: "whatsapp", message: "Parabéns + cupom especial" },
    ],
  },
  {
    id: "reactivation",
    name: "Reativação de Inativos",
    description: "Reengaja clientes que não compram há 30 dias",
    trigger: "rfm_segment_change",
    icon: TrendingUp,
    color: "#fbbf24",
    actions: [
      { type: "whatsapp", message: "Sentimos sua falta + oferta" },
      { type: "wait", delay: "5 dias" },
      { type: "whatsapp", message: "Última oferta exclusiva" },
    ],
  },
  {
    id: "order_shipped",
    name: "Pedido Enviado",
    description: "Notifica cliente com código de rastreamento",
    trigger: "order_shipped",
    icon: Package,
    color: "#38bdf8",
    actions: [
      { type: "whatsapp", message: "Pedido enviado + link rastreamento" },
    ],
  },
];

const triggerLabels: Record<string, string> = {
  cart_abandoned: "Carrinho Abandonado",
  order_placed: "Pedido Realizado",
  order_shipped: "Pedido Enviado",
  order_delivered: "Pedido Entregue",
  customer_created: "Novo Cliente",
  customer_birthday: "Aniversário",
  rfm_segment_change: "Mudança de Segmento",
  nps_response: "Resposta NPS",
  manual: "Manual",
};

export default function AutomationsPage() {
  const [automations, setAutomations] = useState(PRESET_AUTOMATIONS.map(a => ({ ...a, active: false, executions: 0, conversions: 0 })));
  const [detailModal, setDetailModal] = useState<any>(null);

  const toggleAutomation = (id: string) => {
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  const actionIcons: Record<string, any> = {
    wait: Clock,
    whatsapp: MessageCircle,
    email: Mail,
    coupon: Gift,
  };

  return (
    <div>
      <PageHeader title="Automações" description="Fluxos automáticos de engajamento" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#0f0f12] border border-zinc-800/60 rounded-xl p-5 text-center">
          <p className="text-2xl font-bold text-white">{automations.filter(a => a.active).length}</p>
          <p className="text-xs text-zinc-500">Ativas</p>
        </div>
        <div className="bg-[#0f0f12] border border-zinc-800/60 rounded-xl p-5 text-center">
          <p className="text-2xl font-bold text-white">{automations.reduce((s, a) => s + a.executions, 0)}</p>
          <p className="text-xs text-zinc-500">Execuções</p>
        </div>
        <div className="bg-[#0f0f12] border border-zinc-800/60 rounded-xl p-5 text-center">
          <p className="text-2xl font-bold text-white">{automations.reduce((s, a) => s + a.conversions, 0)}</p>
          <p className="text-xs text-zinc-500">Conversões</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {automations.map((a) => {
          const Icon = a.icon;
          return (
            <div key={a.id} className={`bg-[#0f0f12] border rounded-xl p-5 transition ${a.active ? "border-indigo-500/30" : "border-zinc-800/60"}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: a.color + "15" }}>
                    <Icon className="w-4 h-4" style={{ color: a.color }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-200">{a.name}</h3>
                    <p className="text-xs text-zinc-600">{a.description}</p>
                  </div>
                </div>
                <button onClick={() => toggleAutomation(a.id)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${a.active ? "bg-indigo-500" : "bg-zinc-700"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${a.active ? "left-5.5 left-[22px]" : "left-0.5"}`} />
                </button>
              </div>

              <div className="flex items-center gap-1 mb-3">
                <Badge color={a.color} size="xs">{triggerLabels[a.trigger]}</Badge>
                <ArrowRight className="w-3 h-3 text-zinc-700" />
                {a.actions.map((action, i) => {
                  const ActionIcon = actionIcons[action.type] || Zap;
                  return (
                    <div key={i} className="flex items-center gap-1">
                      <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center" title={action.message || action.delay}>
                        <ActionIcon className="w-3 h-3 text-zinc-500" />
                      </div>
                      {i < a.actions.length - 1 && <ArrowRight className="w-2.5 h-2.5 text-zinc-700" />}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-zinc-600">
                  <span>{a.executions} execuções</span>
                  <span>{a.conversions} conversões</span>
                </div>
                <button onClick={() => setDetailModal(a)} className="text-xs text-indigo-400 hover:text-indigo-300">
                  Editar fluxo
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Modal */}
      <Modal open={!!detailModal} onClose={() => setDetailModal(null)} title={detailModal?.name || ""} size="md">
        {detailModal && (
          <div className="space-y-4">
            <div className="bg-zinc-900/50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-zinc-400 mb-1">Gatilho</h4>
              <Badge color={detailModal.color}>{triggerLabels[detailModal.trigger]}</Badge>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-zinc-400 mb-3">Fluxo de Ações</h4>
              <div className="space-y-3">
                {detailModal.actions.map((action: any, i: number) => {
                  const ActionIcon = actionIcons[action.type] || Zap;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                          <ActionIcon className="w-4 h-4 text-zinc-400" />
                        </div>
                        {i < detailModal.actions.length - 1 && <div className="w-px h-6 bg-zinc-800" />}
                      </div>
                      <div className="pt-1">
                        <p className="text-sm font-medium text-zinc-300">
                          {action.type === "wait" ? `Aguardar ${action.delay}` : action.type === "whatsapp" ? "WhatsApp" : action.type}
                        </p>
                        {action.message && <p className="text-xs text-zinc-500 mt-0.5">{action.message}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-3">
              <p className="text-xs text-zinc-500">
                <Zap className="w-3 h-3 inline mr-1 text-indigo-400" />
                As mensagens são geradas automaticamente pela IA com base no perfil do cliente e contexto da compra.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
