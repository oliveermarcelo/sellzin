// @ts-nocheck
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num || 0);
}

export function formatNumber(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR").format(num || 0);
}

export function formatDate(date: string | Date | null, includeTime = false): string {
  if (!date) return "—";
  const d = new Date(date);
  if (includeTime) {
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("pt-BR");
}

export function formatRelativeTime(date: string | Date | null): string {
  if (!date) return "—";
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  if (days < 7) return `${days}d atrás`;
  return formatDate(date);
}

export function getInitials(firstName?: string | null, lastName?: string | null): string {
  const f = firstName?.charAt(0) || "";
  const l = lastName?.charAt(0) || "";
  return (f + l).toUpperCase() || "?";
}

export function getSegmentLabel(segment: string): string {
  const labels: Record<string, string> = {
    champions: "Champions",
    loyal: "Leais",
    potential: "Potenciais",
    new_customers: "Novos",
    at_risk: "Em Risco",
    cant_lose: "Não Perder",
    hibernating: "Hibernando",
    lost: "Perdidos",
  };
  return labels[segment] || segment;
}

export function getSegmentColor(segment: string): string {
  const colors: Record<string, string> = {
    champions: "#10b981",
    loyal: "#6366f1",
    potential: "#38bdf8",
    new_customers: "#a78bfa",
    at_risk: "#fbbf24",
    cant_lose: "#f97316",
    hibernating: "#6b7280",
    lost: "#ef4444",
  };
  return colors[segment] || "#6b7280";
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pendente",
    processing: "Processando",
    shipped: "Enviado",
    delivered: "Entregue",
    cancelled: "Cancelado",
    refunded: "Reembolsado",
    draft: "Rascunho",
    scheduled: "Agendada",
    running: "Em execução",
    paused: "Pausada",
    completed: "Concluída",
  };
  return labels[status] || status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: "#fbbf24",
    processing: "#38bdf8",
    shipped: "#818cf8",
    delivered: "#10b981",
    cancelled: "#ef4444",
    refunded: "#f97316",
    draft: "#6b7280",
    scheduled: "#38bdf8",
    running: "#10b981",
    paused: "#fbbf24",
    completed: "#6b7280",
  };
  return colors[status] || "#6b7280";
}
