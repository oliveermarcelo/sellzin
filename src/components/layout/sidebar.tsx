"use client";
// @ts-nocheck
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard, Users, ShoppingCart, Package, BarChart3,
  Megaphone, Zap, Settings, LogOut, Store, ChevronLeft, Menu, MessageSquare
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/contacts", label: "Contatos", icon: Users },
  { href: "/dashboard/orders", label: "Pedidos", icon: Package },
  { href: "/dashboard/carts", label: "Carrinhos", icon: ShoppingCart },
  { href: "/dashboard/campaigns", label: "Campanhas", icon: Megaphone },
  { href: "/dashboard/automations", label: "Automações", icon: Zap },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/assistant", label: "Assistente IA", icon: MessageSquare },
];

const bottomItems = [
  { href: "/dashboard/settings", label: "Configurações", icon: Settings },
  { href: "/dashboard/settings/stores", label: "Lojas", icon: Store },
];

export function Sidebar() {
  const pathname = usePathname();
  const { tenant, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const nav = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-800">
        <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          S
        </div>
        {!collapsed && (
          <span className="text-base font-bold tracking-tight text-white">Sellzin</span>
        )}
        <button onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-gray-500 hover:text-gray-300 transition hidden lg:block">
          <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-red-600/15 text-red-400"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60"
              }`}>
              <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? "text-red-400" : ""}`} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-gray-800 py-3 px-2 space-y-0.5">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                active
                  ? "bg-gray-800 text-gray-200"
                  : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
              }`}>
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {/* User */}
        <div className="flex items-center gap-3 px-3 py-2 mt-2">
          <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 shrink-0">
            {tenant?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-300 truncate">{tenant?.name}</p>
              <p className="text-[10px] text-gray-500 truncate">{tenant?.plan}</p>
            </div>
          )}
          <button onClick={logout} className="text-gray-500 hover:text-red-400 transition" title="Sair">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-300">
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-[#111111] border-r border-gray-800 transform transition-transform ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        {nav}
      </aside>

      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col shrink-0 bg-[#111111] border-r border-gray-800 transition-all ${
        collapsed ? "w-16" : "w-60"
      }`}>
        {nav}
      </aside>
    </>
  );
}
