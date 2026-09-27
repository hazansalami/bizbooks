import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // On Supabase use the pooled "transaction" connection string (port 6543) here;
  // migrations use DIRECT_URL (see prisma.config.ts).
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function client() {
  // Reused across hot reloads in development and across requests in a warm serverless instance.
  globalForPrisma.prisma ??= createClient();
  return globalForPrisma.prisma;
}

/**
 * Created on first use rather than at import, so `next build` never needs a database connection
 * and a missing DATABASE_URL surfaces as a clear runtime error instead of a failed build.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_, prop) {
    const c = client();
    const value = Reflect.get(c, prop);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
