// @ts-nocheck
import { FastifyInstance } from "fastify";
import { db } from "../../lib/db";
import { whatsappChannels, interactions, contacts } from "../../lib/db/schema";
import { eq, and } from "drizzle-orm";
import { EvolutionService, WhatsAppOfficialService, createWhatsAppService } from "../services/whatsapp";
import { nanoid } from "nanoid";

export async function whatsappRoutes(app: FastifyInstance) {

  // ── List channels ──
  app.get("/channels", { preHandler: [app.authenticate] }, async (req, reply) => {
    const tenantId = req.user.tenantId;
    const channels = await db.query.whatsappChannels.findMany({
      where: eq(whatsappChannels.tenantId, tenantId),
      columns: {
        id: true, name: true, provider: true, status: true,
        phoneNumber: true, instanceName: true, isActive: true,
        connectedAt: true, createdAt: true,
      },
    });
    return { channels };
  });

  // ── Create channel ──
  app.post("/channels", { preHandler: [app.authenticate] }, async (req, reply) => {
    const tenantId = req.user.tenantId;
    const body = req.body as any;

    const { name, provider, instanceName, evolutionUrl, evolutionKey, phoneNumberId, accessToken, verifyToken, businessAccountId } = body;
    if (!name || !provider) return reply.code(400).send({ error: "name e provider são obrigatórios" });

    // Generate instance name once (used for both Evolution API and DB)
    const finalInstanceName = instanceName?.trim() || (provider === "evolution" ? `t-${tenantId.slice(0, 8)}-${nanoid(6)}` : null);

    let initialStatus = "disconnected";
    let qrFromCreate: string | null = null;

    if (provider === "evolution" && evolutionUrl && evolutionKey && finalInstanceName) {
      const svc = new EvolutionService(evolutionUrl, evolutionKey);

      // Step 1: create instance (ignore if already exists)
      try {
        const created = await svc.createInstance(finalInstanceName);
        console.log("[whatsapp] createInstance response:", JSON.stringify(created).slice(0, 300));
        // Some versions return QR in createInstance response
        qrFromCreate = created?.qrcode?.base64 || created?.hash?.qrcode?.base64 || null;
      } catch (e: any) {
        console.warn("[whatsapp] createInstance warning:", e.message);
      }

      // Step 2: always try getQR (most reliable way)
      if (!qrFromCreate) {
        try {
          const qrResp = await svc.getQR(finalInstanceName);
          console.log("[whatsapp] getQR response:", JSON.stringify(qrResp).slice(0, 300));
          qrFromCreate = qrResp?.base64 || qrResp?.qrcode?.base64 || qrResp?.code || null;
        } catch (e: any) {
          console.warn("[whatsapp] getQR warning:", e.message);
        }
      }

      if (qrFromCreate) initialStatus = "connecting";

      // Step 3: configure webhook
      try {
        const apiUrl = process.env.API_URL || "http://localhost:3001";
        await svc.setWebhook(finalInstanceName, `${apiUrl}/v1/whatsapp/webhook/evolution/${finalInstanceName}`);
      } catch (e: any) {
        console.warn("[whatsapp] setWebhook warning:", e.message);
      }
    }

    const [channel] = await db.insert(whatsappChannels).values({
      tenantId,
      name,
      provider,
      instanceName: finalInstanceName,
      evolutionUrl: evolutionUrl || null,
      evolutionKey: evolutionKey || null,
      phoneNumberId: phoneNumberId || null,
      accessToken: accessToken || null,
      verifyToken: verifyToken || nanoid(32),
      businessAccountId: businessAccountId || null,
      status: initialStatus,
      qrCode: qrFromCreate,
    }).returning();

    return { channel, qr: qrFromCreate };
  });

  // ── Get channel ──
  app.get("/channels/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params as any;

    const channel = await db.query.whatsappChannels.findFirst({
      where: and(eq(whatsappChannels.id, id), eq(whatsappChannels.tenantId, tenantId)),
    });
    if (!channel) return reply.code(404).send({ error: "Canal não encontrado" });

    // Refresh status for Evolution
    if (channel.provider === "evolution" && channel.evolutionUrl && channel.evolutionKey) {
      try {
        const svc = new EvolutionService(channel.evolutionUrl, channel.evolutionKey);
        const state = await svc.getStatus(channel.instanceName!);
        const status = svc.mapStatus(state?.instance?.state || "close");
        if (status !== channel.status) {
          await db.update(whatsappChannels)
            .set({ status, updatedAt: new Date(), ...(status === "connected" ? { connectedAt: new Date() } : {}) })
            .where(eq(whatsappChannels.id, id));
          channel.status = status;
        }
      } catch (e) { /* ignore */ }
    }

    // Hide sensitive fields
    const { accessToken, evolutionKey, ...safe } = channel;
    return { channel: safe };
  });

  // ── Get QR code (Evolution only) ──
  app.get("/channels/:id/qr", { preHandler: [app.authenticate] }, async (req, reply) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params as any;

    const channel = await db.query.whatsappChannels.findFirst({
      where: and(eq(whatsappChannels.id, id), eq(whatsappChannels.tenantId, tenantId)),
    });
    if (!channel) return reply.code(404).send({ error: "Canal não encontrado" });
    if (channel.provider !== "evolution") return reply.code(400).send({ error: "QR code disponível apenas para Evolution API" });
    if (!channel.evolutionUrl || !channel.evolutionKey) return reply.code(400).send({ error: "Evolution API não configurada" });

    const svc = new EvolutionService(channel.evolutionUrl, channel.evolutionKey);

    // If we have a saved QR and instance is still connecting, return it
    if (channel.qrCode && channel.status === "connecting") {
      return { qr: { base64: channel.qrCode } };
    }

    const qr = await svc.getQR(channel.instanceName!);
    const qrBase64 = qr?.base64 || qr?.qrcode?.base64 || null;

    await db.update(whatsappChannels)
      .set({ qrCode: qrBase64, status: "connecting", updatedAt: new Date() })
      .where(eq(whatsappChannels.id, id));

    return { qr: { base64: qrBase64, ...qr } };
  });

  // ── Reconnect ──
  app.post("/channels/:id/reconnect", { preHandler: [app.authenticate] }, async (req, reply) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params as any;

    const channel = await db.query.whatsappChannels.findFirst({
      where: and(eq(whatsappChannels.id, id), eq(whatsappChannels.tenantId, tenantId)),
    });
    if (!channel) return reply.code(404).send({ error: "Canal não encontrado" });

    if (channel.provider === "evolution" && channel.evolutionUrl && channel.evolutionKey) {
      const svc = new EvolutionService(channel.evolutionUrl, channel.evolutionKey);
      let qrBase64: string | null = null;

      try {
        // Try recreating (if deleted) — returns QR if qrcode: true
        const created = await svc.createInstance(channel.instanceName!);
        qrBase64 = created?.qrcode?.base64 || created?.hash?.qrcode?.base64 || null;
      } catch (e) { /* may already exist — proceed to getQR */ }

      if (!qrBase64) {
        // Instance already exists, just fetch QR
        try {
          const qr = await svc.getQR(channel.instanceName!);
          qrBase64 = qr?.base64 || qr?.qrcode?.base64 || null;
        } catch (e: any) {
          console.warn("[whatsapp] getQR warning:", e.message);
        }
      }

      await db.update(whatsappChannels)
        .set({ status: "connecting", qrCode: qrBase64, updatedAt: new Date() })
        .where(eq(whatsappChannels.id, id));
      return { status: "connecting", qr: { base64: qrBase64 } };
    }

    return { status: "ok" };
  });

  // ── Delete channel ──
  app.delete("/channels/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params as any;

    const channel = await db.query.whatsappChannels.findFirst({
      where: and(eq(whatsappChannels.id, id), eq(whatsappChannels.tenantId, tenantId)),
    });
    if (!channel) return reply.code(404).send({ error: "Canal não encontrado" });

    // Delete Evolution instance
    if (channel.provider === "evolution" && channel.evolutionUrl && channel.evolutionKey) {
      try {
        const svc = new EvolutionService(channel.evolutionUrl, channel.evolutionKey);
        await svc.deleteInstance(channel.instanceName!);
      } catch (e) { /* ignore */ }
    }

    await db.delete(whatsappChannels).where(eq(whatsappChannels.id, id));
    return { deleted: true };
  });

  // ── Send message ──
  app.post("/send", { preHandler: [app.authenticate] }, async (req, reply) => {
    const tenantId = req.user.tenantId;
    const { channelId, phone, message, contactId } = req.body as any;

    if (!phone || !message) return reply.code(400).send({ error: "phone e message são obrigatórios" });

    // Get channel (provided or first active)
    const channel = channelId
      ? await db.query.whatsappChannels.findFirst({
          where: and(eq(whatsappChannels.id, channelId), eq(whatsappChannels.tenantId, tenantId)),
        })
      : await db.query.whatsappChannels.findFirst({
          where: and(eq(whatsappChannels.tenantId, tenantId), eq(whatsappChannels.isActive, true)),
        });

    if (!channel) return reply.code(400).send({ error: "Nenhum canal WhatsApp ativo configurado" });

    let result: any;
    if (channel.provider === "evolution") {
      const svc = new EvolutionService(channel.evolutionUrl!, channel.evolutionKey!);
      result = await svc.sendText(channel.instanceName!, phone, message);
    } else {
      const svc = new WhatsAppOfficialService(channel.phoneNumberId!, channel.accessToken!);
      result = await svc.sendText(phone, message);
    }

    // Log interaction
    if (contactId) {
      await db.insert(interactions).values({
        tenantId, contactId, channel: "whatsapp",
        type: "message_sent", content: message,
        metadata: { provider: channel.provider, channelId: channel.id, result },
      });
    }

    return { sent: true, result };
  });

  // ── Debug: test Evolution connection ──
  app.get("/debug/evolution", { preHandler: [app.authenticate] }, async (req, reply) => {
    const tenantId = req.user.tenantId;
    const { evolutionUrl, evolutionKey, instanceName } = req.query as any;

    const url = evolutionUrl || process.env.EVOLUTION_API_URL || "http://evolution:8080";
    const key = evolutionKey || process.env.EVOLUTION_API_KEY || "sellzin-evolution-key";

    try {
      // Test connectivity
      const healthRes = await fetch(`${url}/`, { headers: { apikey: key } });
      const healthText = await healthRes.text();

      let qrData = null;
      if (instanceName) {
        try {
          const qrRes = await fetch(`${url}/instance/connect/${instanceName}`, { headers: { apikey: key } });
          qrData = await qrRes.json();
        } catch (e: any) { qrData = { error: e.message }; }
      }

      // List instances
      let instances = null;
      try {
        const listRes = await fetch(`${url}/instance/fetchInstances`, { headers: { apikey: key } });
        instances = await listRes.json();
      } catch (e: any) { instances = { error: (e as any).message }; }

      return { status: healthRes.status, health: healthText.slice(0, 200), instances, qrData };
    } catch (e: any) {
      return reply.code(500).send({ error: e.message });
    }
  });

  // ── Evolution Webhook (public) ──
  app.post("/webhook/evolution/:instanceName", async (req, reply) => {
    const { instanceName } = req.params as any;
    const body = req.body as any;
    const event = body?.event;

    // Find channel by instanceName
    const channel = await db.query.whatsappChannels.findFirst({
      where: eq(whatsappChannels.instanceName, instanceName),
    });

    if (!channel) return reply.code(200).send({ ok: true }); // Silently ignore

    if (event === "CONNECTION_UPDATE") {
      const state = body?.data?.state;
      if (state) {
        const svc = new EvolutionService(channel.evolutionUrl!, channel.evolutionKey!);
        const status = svc.mapStatus(state);
        await db.update(whatsappChannels)
          .set({ status, updatedAt: new Date(), ...(status === "connected" ? { connectedAt: new Date() } : {}) })
          .where(eq(whatsappChannels.id, channel.id));
      }
    }

    if (event === "QRCODE_UPDATED") {
      const qrCode = body?.data?.qrcode?.base64;
      if (qrCode) {
        await db.update(whatsappChannels)
          .set({ qrCode, status: "connecting", updatedAt: new Date() })
          .where(eq(whatsappChannels.id, channel.id));
      }
    }

    if (event === "MESSAGES_UPSERT") {
      const messages = body?.data?.messages || [];
      for (const msg of messages) {
        if (msg.key?.fromMe) continue; // Skip outgoing
        const phone = msg.key?.remoteJid?.replace("@s.whatsapp.net", "");
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
        if (!phone || !text) continue;

        // Find contact by phone
        const contact = await db.query.contacts.findFirst({
          where: and(
            eq(contacts.tenantId, channel.tenantId),
            eq(contacts.phone, phone)
          ),
        });

        if (contact) {
          await db.insert(interactions).values({
            tenantId: channel.tenantId,
            contactId: contact.id,
            channel: "whatsapp",
            type: "message_received",
            content: text,
            metadata: { provider: "evolution", instanceName, messageId: msg.key?.id },
          });
        }
      }
    }

    return reply.code(200).send({ ok: true });
  });

  // ── WhatsApp Official Webhook Verify (GET) ──
  app.get("/webhook/official", async (req, reply) => {
    const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query as any;

    // Find channel by verifyToken
    const channel = await db.query.whatsappChannels.findFirst({
      where: eq(whatsappChannels.verifyToken, token),
    });

    if (channel && mode === "subscribe") {
      return reply.code(200).send(challenge);
    }
    return reply.code(403).send("Forbidden");
  });

  // ── WhatsApp Official Webhook Events (POST) ──
  app.post("/webhook/official", async (req, reply) => {
    const body = req.body as any;
    if (body?.object !== "whatsapp_business_account") return reply.code(200).send({ ok: true });

    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // Find channel by phoneNumberId
    const phoneNumberId = value?.metadata?.phone_number_id;
    if (!phoneNumberId) return reply.code(200).send({ ok: true });

    const channel = await db.query.whatsappChannels.findFirst({
      where: eq(whatsappChannels.phoneNumberId, phoneNumberId),
    });
    if (!channel) return reply.code(200).send({ ok: true });

    const messages = value?.messages || [];
    for (const msg of messages) {
      const phone = msg.from;
      const text = msg.text?.body;
      if (!phone || !text) continue;

      const contact = await db.query.contacts.findFirst({
        where: and(
          eq(contacts.tenantId, channel.tenantId),
          eq(contacts.phone, phone)
        ),
      });

      if (contact) {
        await db.insert(interactions).values({
          tenantId: channel.tenantId,
          contactId: contact.id,
          channel: "whatsapp",
          type: "message_received",
          content: text,
          metadata: { provider: "official", phoneNumberId, messageId: msg.id },
        });
      }
    }

    // Update status from statuses array
    const statuses = value?.statuses || [];
    for (const s of statuses) {
      if (s.status === "delivered" || s.status === "read") {
        // Update channel as connected
        await db.update(whatsappChannels)
          .set({ status: "connected", connectedAt: new Date(), updatedAt: new Date() })
          .where(eq(whatsappChannels.id, channel.id));
      }
    }

    return reply.code(200).send({ ok: true });
  });
}
