"use client";
// @ts-nocheck
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { PageHeader, Button, Input, Badge } from "@/components/ui";
import { Settings, Copy, Eye, EyeOff, Check, Key, CreditCard, Bell } from "lucide-react";

export default function SettingsPage() {
  const { tenant } = useAuth();
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notifications, setNotifications] = useState([true, true, false, true]);

  const toggleNotif = (i: number) =>
    setNotifications(prev => prev.map((v, idx) => idx === i ? !v : v));

  const copyApiKey = () => {
    if (tenant?.apiKey) {
      navigator.clipboard.writeText(tenant.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const planDetails: Record<string, any> = {
    starter: { name: "Starter", price: "R$ 97/mês", color: "#6366f1", contacts: "2.000", stores: "1", messages: "500" },
    growth: { name: "Growth", price: "R$ 297/mês", color: "#10b981", contacts: "15.000", stores: "3", messages: "Ilimitado" },
    enterprise: { name: "Enterprise", price: "Sob consulta", color: "#f59e0b", contacts: "Ilimitado", stores: "Ilimitado", messages: "Ilimitado" },
  };

  const plan = planDetails[tenant?.plan || "starter"];
  const trialDays = tenant?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / 86400000)) : 0;

  return (
    <div>
      <PageHeader title="Configurações" description="Gerencie sua conta e integrações" />

      <div className="space-y-6 max-w-2xl">
        {/* Account */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-500" /> Conta
          </h3>
          <div className="space-y-4">
            <Input label="Nome da empresa" value={tenant?.name || ""} readOnly />
            <Input label="Email" value={tenant?.email || ""} readOnly />
          </div>
        </div>

        {/* Plan */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-gray-500" /> Plano
          </h3>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Badge color={plan.color} size="sm">{plan.name}</Badge>
              <span className="text-sm text-gray-600">{plan.price}</span>
            </div>
            {trialDays > 0 && (
              <Badge color="#fbbf24" size="xs">Trial: {trialDays} dias restantes</Badge>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-sm font-bold text-gray-800">{plan.contacts}</p>
              <p className="text-[10px] text-gray-400">Contatos</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-sm font-bold text-gray-800">{plan.stores}</p>
              <p className="text-[10px] text-gray-400">Lojas</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-sm font-bold text-gray-800">{plan.messages}</p>
              <p className="text-[10px] text-gray-400">Msgs WhatsApp/mês</p>
            </div>
          </div>

          {tenant?.plan === "starter" && (
            <Button size="sm" className="w-full">Upgrade para Growth — R$ 297/mês</Button>
          )}
        </div>

        {/* API Key */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Key className="w-4 h-4 text-gray-500" /> Chave da API
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Use sua API key para integrar com o assistente IA e outras ferramentas.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 font-mono text-sm text-gray-600">
              {showApiKey ? tenant?.apiKey : "sk_••••••••••••••••••••••••••••••"}
            </div>
            <button onClick={() => setShowApiKey(!showApiKey)} className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:text-gray-700 transition">
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button onClick={copyApiKey} className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:text-gray-700 transition">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-gray-500" /> Notificações
          </h3>
          <div className="space-y-3">
            {[
              { label: "Novos pedidos", desc: "Receber alerta quando um pedido é realizado" },
              { label: "Carrinhos abandonados", desc: "Notificar quando um carrinho é abandonado" },
              { label: "Clientes em risco", desc: "Alertar quando clientes mudam para segmento 'em risco'" },
              { label: "Relatório semanal", desc: "Resumo das métricas por email toda segunda" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm text-gray-700">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
                <button onClick={() => toggleNotif(i)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${notifications[i] ? "bg-red-500" : "bg-gray-300"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${notifications[i] ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
