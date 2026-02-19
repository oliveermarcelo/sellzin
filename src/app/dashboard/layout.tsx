"use client";
// @ts-nocheck
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Loading } from "@/components/ui";

function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { tenant, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !tenant) router.push("/login");
  }, [loading, tenant, router]);

  if (loading) return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <Loading />
    </div>
  );

  if (!tenant) return null;

  return (
    <div className="flex min-h-screen bg-[#09090b]">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardGuard>{children}</DashboardGuard>
    </AuthProvider>
  );
}
