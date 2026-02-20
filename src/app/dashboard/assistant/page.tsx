"use client";
// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui";
import {
  Send, Bot, User, Sparkles, ShoppingCart, Users, Package,
  BarChart3, Megaphone, RefreshCw, Zap, ExternalLink, Copy, Check
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  timestamp: Date;
  actions?: { label: string; prompt: string }[];
}

interface Suggestion {
  icon: string;
  text: string;
  action: string;
  prompt: string;
}

function formatMessage(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-900 font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-gray-600 italic">$1</em>')
    .replace(/_(.+?)_/g, '<em class="text-gray-400 text-xs">$1</em>')
    .replace(/\n/g, "<br/>");
}

const intentIcons: Record<string, any> = {
  overview: BarChart3, revenue: BarChart3, orders: Package,
  contacts_stats: Users, contacts_segment: Users, search_contact: Users,
  carts: ShoppingCart, recover: ShoppingCart, campaigns_list: Megaphone,
  campaign_create: Megaphone, products: Package, rfm: Users,
  compare: BarChart3, stores: RefreshCw, sync: RefreshCw, help: Sparkles,
};

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [conversationId, setConversationId] = useState(`conv_${Date.now()}`);
  const [copied, setCopied] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.assistantSuggestions().then((data: any) => {
      if (data.suggestions) setSuggestions(data.suggestions);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: `u_${Date.now()}`, role: "user", content: text.trim(), timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const data = await api.assistantChat(text.trim(), conversationId);
      const assistantMsg: Message = {
        id: `a_${Date.now()}`, role: "assistant",
        content: data.message || "Não consegui processar. Tente novamente.",
        intent: data.intent, timestamp: new Date(), actions: data.actions,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (data.suggestions?.length) {
        setSuggestions(data.suggestions.map((s: string) => ({
          icon: "💡", text: s, action: s, prompt: s,
        })));
      }
    } catch (err: any) {
      setMessages((prev) => [...prev, {
        id: `e_${Date.now()}`, role: "assistant",
        content: "⚠️ Erro de conexão com a API. Verifique se o servidor está rodando.",
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading, conversationId]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(input); };

  const copyMessage = (content: string, id: string) => {
    navigator.clipboard.writeText(content.replace(/\*\*/g, "").replace(/\n/g, "\n"));
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const quickActions = [
    { icon: "📊", label: "Visão geral", prompt: "como estão as vendas?" },
    { icon: "🛒", label: "Carrinhos", prompt: "carrinhos abandonados" },
    { icon: "👥", label: "VIPs", prompt: "meus melhores clientes" },
    { icon: "📦", label: "Pendentes", prompt: "pedidos pendentes" },
    { icon: "🏆", label: "Top produtos", prompt: "top produtos do mês" },
    { icon: "⚠️", label: "Em risco", prompt: "clientes em risco" },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)]">
      <PageHeader title="Assistente IA" description="Gerencie seu e-commerce por conversa natural"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full flex items-center gap-1">
              <Zap className="w-3 h-3 text-red-500" /> GPT-4o Mini
            </span>
          </div>
        }
      />

      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-6">
                <Bot className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Assistente Sellzin</h3>
              <p className="text-sm text-gray-500 max-w-md mb-8">
                Pergunte sobre vendas, clientes, pedidos, carrinhos abandonados, ou peça para executar ações no seu CRM.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg w-full">
                {quickActions.map((qa) => (
                  <button key={qa.label} onClick={() => sendMessage(qa.prompt)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 hover:border-red-300 hover:bg-red-50/50 transition text-left group">
                    <span className="text-lg">{qa.icon}</span>
                    <span className="text-xs text-gray-500 group-hover:text-gray-700">{qa.label}</span>
                  </button>
                ))}
              </div>

              {suggestions.length > 0 && (
                <div className="mt-6 w-full max-w-lg">
                  <p className="text-xs text-gray-400 mb-2">Sugestões baseadas nos seus dados:</p>
                  <div className="space-y-1.5">
                    {suggestions.map((s, i) => (
                      <button key={i} onClick={() => sendMessage(s.prompt)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 hover:border-red-300 transition text-left">
                        <span>{s.icon}</span>
                        <span className="text-xs text-gray-500 flex-1">{s.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0 mt-0.5">
                      {msg.intent && intentIcons[msg.intent]
                        ? (() => { const Icon = intentIcons[msg.intent!]; return <Icon className="w-3.5 h-3.5 text-red-600" />; })()
                        : <Bot className="w-3.5 h-3.5 text-red-600" />}
                    </div>
                  )}

                  <div className={`max-w-[80%] ${msg.role === "user" ? "order-1" : ""}`}>
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-gray-900 text-white"
                        : "bg-gray-50 border border-gray-200 text-gray-700"
                    }`}>
                      {msg.role === "assistant" ? (
                        <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                      ) : (
                        msg.content
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 px-1">
                      <span className="text-[10px] text-gray-400">
                        {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {msg.role === "assistant" && msg.intent && msg.intent !== "unknown" && (
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          {msg.intent}
                        </span>
                      )}
                      {msg.role === "assistant" && (
                        <button onClick={() => copyMessage(msg.content, msg.id)}
                          className="text-gray-300 hover:text-gray-500 transition">
                          {copied === msg.id
                            ? <Check className="w-3 h-3 text-emerald-500" />
                            : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>

                    {msg.actions && msg.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.actions.map((a: any, i: number) => (
                          <button key={i} onClick={() => sendMessage(a.prompt)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition">
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-red-600" />
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {messages.length > 0 && !loading && (
          <div className="flex gap-1.5 px-4 py-2 border-t border-gray-100 overflow-x-auto no-scrollbar">
            {quickActions.slice(0, 4).map((qa) => (
              <button key={qa.label} onClick={() => sendMessage(qa.prompt)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 border border-gray-200 text-[11px] text-gray-500 hover:text-gray-700 hover:border-gray-300 transition whitespace-nowrap shrink-0">
                <span>{qa.icon}</span> {qa.label}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-gray-200 p-3">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input ref={inputRef} type="text" value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre vendas, clientes, pedidos..."
              disabled={loading}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 disabled:opacity-50 transition"
            />
            <button type="submit" disabled={loading || !input.trim()}
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium transition flex items-center gap-2">
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="flex items-center justify-between mt-2 px-1">
            <p className="text-[10px] text-gray-400">
              Powered by GPT-4o Mini • Dados em tempo real do seu CRM
            </p>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-gray-400">Online</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
