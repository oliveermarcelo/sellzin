"use client";
// @ts-nocheck
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Button, Input } from "@/components/ui";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
            S
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Entrar no Sellzin</h1>
          <p className="text-sm text-gray-500 mt-2">Gerencie seus clientes e vendas</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          {error && (
            <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
              {error}
            </div>
          )}
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com" required />
          <Input label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" required />
          <Button type="submit" loading={loading} className="w-full">Entrar</Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Não tem conta?{" "}
          <Link href="/register" className="text-red-600 hover:text-red-500 font-medium transition">
            Criar conta grátis
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <AuthProvider><LoginForm /></AuthProvider>;
}
