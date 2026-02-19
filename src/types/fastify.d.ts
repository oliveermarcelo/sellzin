import "@fastify/jwt";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { tenantId: string; email: string };
    user: { tenantId: string; email: string };
  }
}
