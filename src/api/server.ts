// @ts-nocheck
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { authRoutes } from "./routes/auth";
import { storeRoutes } from "./routes/stores";
import { contactRoutes } from "./routes/contacts";
import { orderRoutes } from "./routes/orders";
import { cartRoutes } from "./routes/carts";
import { campaignRoutes } from "./routes/campaigns";
import { analyticsRoutes } from "./routes/analytics";
import { webhookRoutes } from "./routes/webhooks";
import assistantRoutes from "./routes/assistant";

const PORT = parseInt(process.env.API_PORT || "3001");

async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      transport:
        process.env.NODE_ENV !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // ── Plugins ──
  await app.register(cors, {
    origin: process.env.APP_URL || "http://localhost:3000",
    credentials: true,
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || "dev-secret-change-me",
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // ── Auth decorator ──
  app.decorate("authenticate", async (request: any, reply: any) => {
    try {
      // Check API key first
      const apiKey = request.headers["x-api-key"];
      if (apiKey) {
        // TODO: lookup tenant by API key
        return;
      }
      // Then JWT
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: "Unauthorized" });
    }
  });

  // ── Health check ──
  app.get("/health", async () => ({
    status: "ok",
    service: "sellzin-api",
    timestamp: new Date().toISOString(),
  }));

  // ── Routes ──
  await app.register(authRoutes, { prefix: "/v1/auth" });
  await app.register(storeRoutes, { prefix: "/v1/stores" });
  await app.register(contactRoutes, { prefix: "/v1/contacts" });
  await app.register(orderRoutes, { prefix: "/v1/orders" });
  await app.register(cartRoutes, { prefix: "/v1/carts" });
  await app.register(campaignRoutes, { prefix: "/v1/campaigns" });
  await app.register(analyticsRoutes, { prefix: "/v1/analytics" });
  await app.register(webhookRoutes, { prefix: "/v1/webhooks" });
  await app.register(assistantRoutes, { prefix: "/v1" });

  return app;
}

// ── Start ──
buildServer()
  .then((app) => {
    app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
      if (err) {
        app.log.error(err);
        process.exit(1);
      }
      console.log(`🔌 Sellzin API rodando em ${address}`);
    });
  })
  .catch(console.error);
