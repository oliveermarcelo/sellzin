// @ts-nocheck
/**
 * Serviço unificado de WhatsApp
 * Suporta: Evolution API (instâncias) e WhatsApp Business API (Meta Oficial)
 */

// ── Evolution API ──

export class EvolutionService {
  private url: string;
  private key: string;

  constructor(url: string, key: string) {
    this.url = url.replace(/\/$/, "");
    this.key = key;
  }

  private headers() {
    return { "Content-Type": "application/json", apikey: this.key };
  }

  async createInstance(instanceName: string) {
    const res = await fetch(`${this.url}/instance/create`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });
    if (!res.ok) throw new Error(`Evolution createInstance error: ${res.status}`);
    return res.json();
  }

  async getQR(instanceName: string) {
    // Call connect ONCE — calling multiple times restarts the Baileys socket
    // The QR will arrive via QRCODE_UPDATED webhook; here we just check current state
    try {
      const res = await fetch(`${this.url}/instance/connect/${instanceName}`, {
        headers: this.headers(),
      });
      if (!res.ok) return { base64: null };
      const data = await res.json();
      console.log(`[evolution] connect response:`, JSON.stringify(data).slice(0, 300));
      const qrBase64 = data?.base64 || data?.qrcode?.base64 || data?.code || null;
      return { base64: qrBase64 };
    } catch (e: any) {
      console.warn(`[evolution] getQR error: ${e.message}`);
      return { base64: null };
    }
  }

  async getStatus(instanceName: string) {
    const res = await fetch(`${this.url}/instance/connectionState/${instanceName}`, {
      headers: this.headers(),
    });
    if (!res.ok) return { state: "error" };
    const data = await res.json();
    return data; // { instance: { state: "open" | "close" | "connecting" } }
  }

  async sendText(instanceName: string, phone: string, text: string) {
    const number = phone.replace(/\D/g, "");
    const res = await fetch(`${this.url}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ number, text }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Evolution sendText error: ${res.status} ${err}`);
    }
    return res.json();
  }

  async deleteInstance(instanceName: string) {
    const res = await fetch(`${this.url}/instance/delete/${instanceName}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Evolution deleteInstance error: ${res.status}`);
    return res.json();
  }

  async setWebhook(instanceName: string, webhookUrl: string) {
    const res = await fetch(`${this.url}/webhook/set/${instanceName}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: true,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Evolution setWebhook error: ${res.status} - ${body}`);
    }
    return res.json();
  }

  async triggerConnect(instanceName: string) {
    // Triggers WhatsApp socket initialization (QR will come via webhook or fetchInstances)
    try {
      const res = await fetch(`${this.url}/instance/connect/${instanceName}`, {
        headers: this.headers(),
      });
      const data = await res.json();
      console.log("[evolution] connect trigger:", JSON.stringify(data).slice(0, 200));
      return data;
    } catch (e: any) {
      console.warn("[evolution] connect trigger warning:", e.message);
      return null;
    }
  }

  async fetchInstanceQR(instanceName: string): Promise<string | null> {
    const res = await fetch(`${this.url}/instance/fetchInstances?instanceName=${instanceName}`, {
      headers: this.headers(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    console.log("[evolution] fetchInstances:", JSON.stringify(data).slice(0, 400));
    const inst = Array.isArray(data) ? data[0] : data;
    return inst?.qrcode?.base64 || inst?.Qrcode?.base64 || inst?.qr?.base64 || null;
  }

  mapStatus(state: string): string {
    const map: Record<string, string> = {
      open: "connected",
      close: "disconnected",
      connecting: "connecting",
    };
    return map[state] || "error";
  }
}

// ── WhatsApp Business API (Meta Oficial) ──

export class WhatsAppOfficialService {
  private phoneNumberId: string;
  private accessToken: string;
  private apiVersion = "v19.0";
  private baseUrl = "https://graph.facebook.com";

  constructor(phoneNumberId: string, accessToken: string) {
    this.phoneNumberId = phoneNumberId;
    this.accessToken = accessToken;
  }

  private headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.accessToken}`,
    };
  }

  async sendText(phone: string, text: string) {
    const number = phone.replace(/\D/g, "");
    const res = await fetch(
      `${this.baseUrl}/${this.apiVersion}/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: number,
          type: "text",
          text: { body: text },
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`WA Official sendText error: ${res.status} ${err}`);
    }
    return res.json();
  }

  async sendTemplate(
    phone: string,
    templateName: string,
    languageCode: string,
    components: any[] = []
  ) {
    const number = phone.replace(/\D/g, "");
    const res = await fetch(
      `${this.baseUrl}/${this.apiVersion}/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: number,
          type: "template",
          template: {
            name: templateName,
            language: { code: languageCode },
            components,
          },
        }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`WA Official sendTemplate error: ${res.status} ${err}`);
    }
    return res.json();
  }

  verifyWebhook(mode: string, token: string, challenge: string, verifyToken: string) {
    if (mode === "subscribe" && token === verifyToken) {
      return challenge;
    }
    throw new Error("Webhook verification failed");
  }

  parseIncomingMessage(body: any) {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;
    if (!messages?.length) return null;

    const msg = messages[0];
    return {
      messageId: msg.id,
      from: msg.from,
      type: msg.type,
      text: msg.text?.body || null,
      timestamp: new Date(parseInt(msg.timestamp) * 1000),
      contactName: value?.contacts?.[0]?.profile?.name || null,
    };
  }
}

// ── Factory ──

export function createWhatsAppService(channel: {
  provider: string;
  evolutionUrl?: string | null;
  evolutionKey?: string | null;
  instanceName?: string | null;
  phoneNumberId?: string | null;
  accessToken?: string | null;
}) {
  if (channel.provider === "evolution") {
    if (!channel.evolutionUrl || !channel.evolutionKey) {
      throw new Error("Evolution API URL e Key são obrigatórios");
    }
    return {
      type: "evolution" as const,
      service: new EvolutionService(channel.evolutionUrl, channel.evolutionKey),
      instanceName: channel.instanceName || "sellzin",
    };
  }

  if (channel.provider === "official") {
    if (!channel.phoneNumberId || !channel.accessToken) {
      throw new Error("Phone Number ID e Access Token são obrigatórios");
    }
    return {
      type: "official" as const,
      service: new WhatsAppOfficialService(channel.phoneNumberId, channel.accessToken),
    };
  }

  throw new Error(`Provider desconhecido: ${channel.provider}`);
}
