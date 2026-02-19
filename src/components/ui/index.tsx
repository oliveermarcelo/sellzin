"use client";
// @ts-nocheck
import { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, useState } from "react";
import { cn } from "@/lib/utils";
import { X, Search, ChevronDown, Loader2 } from "lucide-react";

// ── Stat Card ──
export function StatCard({ label, value, sub, icon, trend, color = "zinc" }: {
  label: string; value: string | number; sub?: string; icon?: ReactNode;
  trend?: { value: string; positive: boolean }; color?: string;
}) {
  return (
    <div className="bg-[#0f0f12] border border-zinc-800/60 rounded-xl p-5 hover:border-zinc-700/60 transition">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
        {icon && <span className="text-zinc-600">{icon}</span>}
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {trend && (
          <span className={`text-xs font-semibold ${trend.positive ? "text-emerald-400" : "text-red-400"}`}>
            {trend.positive ? "↑" : "↓"} {trend.value}
          </span>
        )}
        {sub && <span className="text-xs text-zinc-600">{sub}</span>}
      </div>
    </div>
  );
}

// ── Badge ──
export function Badge({ children, color = "#6b7280", size = "sm" }: {
  children: ReactNode; color?: string; size?: "xs" | "sm";
}) {
  return (
    <span className={cn(
      "inline-flex items-center font-semibold rounded-md",
      size === "xs" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"
    )} style={{
      backgroundColor: color + "18",
      color: color,
      border: `1px solid ${color}30`,
    }}>
      {children}
    </span>
  );
}

// ── Page Header ──
export function PageHeader({ title, description, actions }: {
  title: string; description?: string; actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
        {description && <p className="text-sm text-zinc-500 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

// ── Button ──
export function Button({ children, variant = "primary", size = "md", loading, className, ...props }: {
  children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg"; loading?: boolean; className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants = {
    primary: "bg-indigo-500 hover:bg-indigo-600 text-white border-indigo-500",
    secondary: "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700",
    ghost: "bg-transparent hover:bg-zinc-800/50 text-zinc-400 border-transparent",
    danger: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30",
  };
  const sizes = {
    sm: "text-xs px-3 py-1.5",
    md: "text-sm px-4 py-2",
    lg: "text-sm px-6 py-2.5",
  };
  return (
    <button className={cn(
      "inline-flex items-center justify-center gap-2 font-medium rounded-lg border transition-all disabled:opacity-50",
      variants[variant], sizes[size], className
    )} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

// ── Input ──
export function Input({ label, error, className, ...props }: {
  label?: string; error?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs font-medium text-zinc-400">{label}</label>}
      <input className={cn(
        "w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm text-white placeholder:text-zinc-600",
        "focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition",
        error && "border-red-500/50", className
      )} {...props} />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ── Select ──
export function Select({ label, options, className, ...props }: {
  label?: string; options: { value: string; label: string }[];
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs font-medium text-zinc-400">{label}</label>}
      <div className="relative">
        <select className={cn(
          "w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm text-white appearance-none",
          "focus:outline-none focus:border-indigo-500/50 transition", className
        )} {...props}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
      </div>
    </div>
  );
}

// ── SearchInput ──
export function SearchInput({ value, onChange, placeholder = "Buscar..." }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition" />
      {value && (
        <button onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Table ──
export function Table({ headers, children, empty }: {
  headers: string[]; children: ReactNode; empty?: boolean;
}) {
  return (
    <div className="bg-[#0f0f12] border border-zinc-800/60 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800/60">
              {headers.map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {empty ? (
              <tr>
                <td colSpan={headers.length} className="px-4 py-12 text-center text-zinc-600">
                  Nenhum registro encontrado
                </td>
              </tr>
            ) : children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Modal ──
export function Modal({ open, onClose, title, children, size = "md" }: {
  open: boolean; onClose: () => void; title: string;
  children: ReactNode; size?: "sm" | "md" | "lg";
}) {
  if (!open) return null;
  const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={cn("relative w-full bg-[#0f0f12] border border-zinc-800 rounded-2xl shadow-2xl", sizes[size])}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-400 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── Empty State ──
export function EmptyState({ icon, title, description, action }: {
  icon: ReactNode; title: string; description: string; action?: ReactNode;
}) {
  return (
    <div className="bg-[#0f0f12] border border-zinc-800/60 rounded-xl p-12 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-800/50 text-zinc-600 mb-4">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-zinc-300 mb-1">{title}</h3>
      <p className="text-sm text-zinc-600 mb-4 max-w-sm mx-auto">{description}</p>
      {action}
    </div>
  );
}

// ── Tabs ──
export function Tabs({ tabs, active, onChange }: {
  tabs: { id: string; label: string; count?: number }[];
  active: string; onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-zinc-900/50 rounded-lg border border-zinc-800/60 w-fit">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
            active === t.id
              ? "bg-zinc-800 text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-400"
          )}>
          {t.label}
          {t.count !== undefined && (
            <span className="ml-1.5 text-[10px] text-zinc-600">({t.count})</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Pagination ──
export function Pagination({ page, pages, onChange }: {
  page: number; pages: number; onChange: (p: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-1 py-3">
      <span className="text-xs text-zinc-600">Página {page} de {pages}</span>
      <div className="flex gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page <= 1}
          className="px-3 py-1 text-xs rounded-md bg-zinc-800/50 text-zinc-400 disabled:opacity-30 hover:bg-zinc-800 transition">
          Anterior
        </button>
        <button onClick={() => onChange(page + 1)} disabled={page >= pages}
          className="px-3 py-1 text-xs rounded-md bg-zinc-800/50 text-zinc-400 disabled:opacity-30 hover:bg-zinc-800 transition">
          Próxima
        </button>
      </div>
    </div>
  );
}

// ── Loading ──
export function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
    </div>
  );
}
