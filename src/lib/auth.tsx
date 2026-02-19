"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { api } from "@/lib/api";

interface Tenant {
  id: string;
  name: string;
  email: string;
  plan: string;
  apiKey?: string;
  trialEndsAt?: string;
}

interface AuthContextType {
  tenant: Tenant | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  tenant: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const token = api.getToken();
      if (!token) { setLoading(false); return; }
      const data = await api.me();
      setTenant(data.tenant);
    } catch {
      api.setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email: string, password: string) => {
    const data = await api.login(email, password);
    api.setToken(data.token);
    setTenant(data.tenant);
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await api.register(name, email, password);
    api.setToken(data.token);
    setTenant(data.tenant);
  };

  const logout = () => {
    api.setToken(null);
    setTenant(null);
  };

  return (
    <AuthContext.Provider value={{ tenant, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
