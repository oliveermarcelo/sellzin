// @ts-nocheck
function getApiBase(): string {
  if (typeof window !== "undefined") {
    // Browser: use same hostname, port 3001
    return `${window.location.protocol}//${window.location.hostname}:3001/v1`;
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";
}

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      if (typeof window !== "undefined") localStorage.setItem("sellzin_token", token);
    } else {
      if (typeof window !== "undefined") localStorage.removeItem("sellzin_token");
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("sellzin_token");
    }
    return this.token;
  }

  async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, headers = {} } = options;
    const token = this.getToken();

    const config: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    };

    if (body) config.body = JSON.stringify(body);

    const res = await fetch(`${getApiBase()}${endpoint}`, config);

    if (res.status === 401) {
      this.setToken(null);
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new Error("Unauthorized");
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro na requisição");
    return data;
  }

  // Auth
  login(email: string, password: string) {
    return this.request("/auth/login", { method: "POST", body: { email, password } });
  }
  register(name: string, email: string, password: string) {
    return this.request("/auth/register", { method: "POST", body: { name, email, password } });
  }
  me() {
    return this.request("/auth/me");
  }

  // Stores
  getStores() { return this.request("/stores"); }
  createStore(data: any) { return this.request("/stores", { method: "POST", body: data }); }
  syncStore(id: string) { return this.request(`/stores/${id}/sync`, { method: "POST" }); }
  deleteStore(id: string) { return this.request(`/stores/${id}`, { method: "DELETE" }); }

  // Contacts
  getContacts(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request(`/contacts${qs}`);
  }
  getContact(id: string) { return this.request(`/contacts/${id}`); }
  searchContacts(q: string) { return this.request(`/contacts/search?q=${encodeURIComponent(q)}`); }
  getContactStats() { return this.request("/contacts/stats"); }
  getContactSegments() { return this.request("/contacts/segments"); }
  bulkTag(contactIds: string[], tag: string, action: "add" | "remove") {
    return this.request("/contacts/bulk-tag", { method: "POST", body: { contactIds, tag, action } });
  }

  // Orders
  getOrders(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request(`/orders${qs}`);
  }
  getOrder(id: string) { return this.request(`/orders/${id}`); }
  getOrderStats(period?: string) {
    return this.request(`/orders/stats${period ? `?period=${period}` : ""}`);
  }

  // Carts
  getAbandonedCarts(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request(`/carts/abandoned${qs}`);
  }
  getCartStats() { return this.request("/carts/abandoned/stats"); }
  getCartConversion() { return this.request("/carts/abandoned/conversion"); }
  recoverCarts(data?: any) {
    return this.request("/carts/abandoned/recover", { method: "POST", body: data || {} });
  }

  // Campaigns
  getCampaigns(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request(`/campaigns${qs}`);
  }
  createCampaign(data: any) { return this.request("/campaigns", { method: "POST", body: data }); }
  getCampaignStats(id: string) { return this.request(`/campaigns/${id}/stats`); }
  quickCampaign(data: any) { return this.request("/campaigns/quick", { method: "POST", body: data }); }
  getLatestCampaign() { return this.request("/campaigns/latest/stats"); }

  // Analytics
  getOverview() { return this.request("/analytics/overview"); }
  getRfm() { return this.request("/analytics/rfm"); }
  getTopProducts(limit = 10) { return this.request(`/analytics/products/top?limit=${limit}`); }
  getRevenue(group = "day") { return this.request(`/analytics/revenue?group=${group}`); }
  getComparison() { return this.request("/analytics/compare"); }

  // Assistant
  assistantChat(message: string, conversationId?: string) {
    return this.request("/assistant/chat", { method: "POST", body: { message, conversationId } });
  }
  assistantSuggestions() { return this.request("/assistant/suggestions"); }
  assistantHistory() { return this.request("/assistant/history"); }
}

export const api = new ApiClient();
