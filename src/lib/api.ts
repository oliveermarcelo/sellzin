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
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    };

    if (body !== undefined) config.body = JSON.stringify(body);

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
  syncStore(id: string) { return this.request(`/stores/${id}/sync`, { method: "POST", body: {} }); }
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
  getOrderStats(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => !!v))).toString() : "";
    return this.request(`/orders/stats${qs}`);
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
  getOverview(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => !!v))).toString() : "";
    return this.request(`/analytics/overview${qs}`);
  }
  getRfm() { return this.request("/analytics/rfm"); }
  getTopProducts(limit = 10, params?: Record<string, string>) {
    const extra = params ? "&" + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => !!v))).toString() : "";
    return this.request(`/analytics/products/top?limit=${limit}${extra}`);
  }
  getRevenue(group = "day", params?: Record<string, string>) {
    const extra = params ? "&" + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => !!v))).toString() : "";
    return this.request(`/analytics/revenue?group=${group}${extra}`);
  }
  getComparison() { return this.request("/analytics/compare"); }

  // Products
  getProducts() { return this.request("/products"); }
  syncProducts(storeId: string) { return this.request(`/products/sync/${storeId}`, { method: "POST", body: {} }); }

  // Tracking
  getLiveVisitors() { return this.request("/track/live"); }
  getTrackingEvents(event?: string) { return this.request(`/track/events${event ? "?event=" + event : ""}`); }
  getTrackingStats() { return this.request("/track/stats"); }

  getOrdersByStatus(params?: Record<string, string>) { return this.request("/analytics/orders-by-status" + (params ? "?" + new URLSearchParams(params) : "")); }
  getWeekdayActivity(params?: Record<string, string>) { return this.request("/analytics/weekday" + (params ? "?" + new URLSearchParams(params) : "")); }
  getCustomers(group?: string, params?: Record<string, string>) {
    const p = new URLSearchParams({ ...(group ? { group } : {}), ...(params || {}) });
    return this.request("/analytics/customers?" + p);
  }

  // Automations
  getAutomations() { return this.request("/automations"); }
  createAutomation(data: any) { return this.request("/automations", { method: "POST", body: data }); }
  updateAutomation(id: string, data: any) { return this.request(`/automations/${id}`, { method: "PUT", body: data }); }
  deleteAutomation(id: string) { return this.request(`/automations/${id}`, { method: "DELETE" }); }
  toggleAutomation(id: string) { return this.request(`/automations/${id}/toggle`, { method: "PATCH" }); }

  // WhatsApp
  getWhatsappChannels() { return this.request("/whatsapp/channels"); }
  createWhatsappChannel(data: any) { return this.request("/whatsapp/channels", { method: "POST", body: data }); }
  getWhatsappChannel(id: string) { return this.request(`/whatsapp/channels/${id}`); }
  deleteWhatsappChannel(id: string) { return this.request(`/whatsapp/channels/${id}`, { method: "DELETE" }); }
  getWhatsappQR(id: string) { return this.request(`/whatsapp/channels/${id}/qr`); }
  reconnectWhatsapp(id: string) { return this.request(`/whatsapp/channels/${id}/reconnect`, { method: "POST" }); }
  sendWhatsapp(data: { channelId?: string; phone: string; message: string; contactId?: string }) {
    return this.request("/whatsapp/send", { method: "POST", body: data });
  }

  // Assistant
  assistantChat(message: string, conversationId?: string) {
    return this.request("/assistant/chat", { method: "POST", body: { message, conversationId } });
  }
  assistantSuggestions() { return this.request("/assistant/suggestions"); }
  assistantHistory() { return this.request("/assistant/history"); }
}

export const api = new ApiClient();
