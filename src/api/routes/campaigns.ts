// @ts-nocheck
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../lib/db";
import { campaigns } from "../../lib/db/schema";
import { eq, and, desc, count } from "drizzle-orm";

const createCampaignSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(["whatsapp", "email", "sms", "telegram"]).default("whatsapp"),
  segmentRules: z.record(z.any()).optional(),
  template: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
});

export async function campaignRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const { tenantId } = request.user as any;
    const query = request.query as any;

    const result = await db.query.campaigns.findMany({
      where: and(
        eq(campaigns.tenantId, tenantId),
        query.status ? eq(campaigns.status, query.status) : undefined
      ),
      orderBy: [desc(campaigns.createdAt)],
      limit: 50,
    });

    return { campaigns: result };
  });

  app.post("/", async (request, reply) => {
    const { tenantId } = request.user as any;
    const body = createCampaignSchema.parse(request.body);

    const [campaign] = await db
      .insert(campaigns)
      .values({ tenantId, ...body })
      .returning();

    return reply.code(201).send({ campaign });
  });

  app.get("/:id/stats", async (request, reply) => {
    const { tenantId } = request.user as any;
    const { id } = request.params as any;

    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)),
    });

    if (!campaign) return reply.code(404).send({ error: "Campanha não encontrada" });

    const deliveryRate = campaign.totalSent > 0
      ? ((campaign.totalDelivered / campaign.totalSent) * 100).toFixed(1)
      : "0";
    const readRate = campaign.totalDelivered > 0
      ? ((campaign.totalRead / campaign.totalDelivered) * 100).toFixed(1)
      : "0";
    const conversionRate = campaign.totalRecipients > 0
      ? ((campaign.totalConverted / campaign.totalRecipients) * 100).toFixed(1)
      : "0";

    return {
      campaign,
      rates: { deliveryRate, readRate, conversionRate },
    };
  });

  // ── Quick campaign (disparo rápido) ──
  app.post("/quick", async (request, reply) => {
    const { tenantId } = request.user as any;
    const { segmentRules, template, couponCode } = request.body as any;

    const [campaign] = await db
      .insert(campaigns)
      .values({
        tenantId,
        name: `Disparo rápido - ${new Date().toLocaleDateString("pt-BR")}`,
        channel: "whatsapp",
        status: "running",
        segmentRules: segmentRules || {},
        template: template || "",
        startedAt: new Date(),
      })
      .returning();

    // TODO: Queue messages based on segment
    return reply.code(201).send({ campaign, message: "Campanha iniciada" });
  });

  app.get("/latest/stats", async (request) => {
    const { tenantId } = request.user as any;

    const campaign = await db.query.campaigns.findFirst({
      where: and(eq(campaigns.tenantId, tenantId), eq(campaigns.status, "completed")),
      orderBy: [desc(campaigns.completedAt)],
    });

    if (!campaign) return { campaign: null };
    return { campaign };
  });
}
