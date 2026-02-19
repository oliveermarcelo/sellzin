// @ts-nocheck
import { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db } from "../../lib/db";
import { tenants } from "../../lib/db/schema";
import { eq } from "drizzle-orm";

const registerSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  // ── Register ──
  app.post("/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);

    // Check existing
    const existing = await db.query.tenants.findFirst({
      where: eq(tenants.email, body.email),
    });
    if (existing) {
      return reply.code(409).send({ error: "Email já cadastrado" });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const apiKey = `sk_${nanoid(48)}`;
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 dias

    const [tenant] = await db
      .insert(tenants)
      .values({
        name: body.name,
        email: body.email,
        passwordHash,
        apiKey,
        plan: "starter",
        trialEndsAt,
      })
      .returning({
        id: tenants.id,
        name: tenants.name,
        email: tenants.email,
        plan: tenants.plan,
        apiKey: tenants.apiKey,
      });

    const token = app.jwt.sign(
      { tenantId: tenant.id, email: tenant.email },
      { expiresIn: "7d" }
    );

    return reply.code(201).send({ tenant, token });
  });

  // ── Login ──
  app.post("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.email, body.email),
    });

    if (!tenant || !(await bcrypt.compare(body.password, tenant.passwordHash))) {
      return reply.code(401).send({ error: "Credenciais inválidas" });
    }

    if (!tenant.isActive) {
      return reply.code(403).send({ error: "Conta desativada" });
    }

    const token = app.jwt.sign(
      { tenantId: tenant.id, email: tenant.email },
      { expiresIn: "7d" }
    );

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
        plan: tenant.plan,
      },
      token,
    };
  });

  // ── Me ──
  app.get("/me", { preHandler: [app.authenticate] }, async (request) => {
    const { tenantId } = request.user as any;
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: {
        id: true,
        name: true,
        email: true,
        plan: true,
        apiKey: true,
        trialEndsAt: true,
        createdAt: true,
      },
    });
    return { tenant };
  });
}
