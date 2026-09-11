import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function adapterFromUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not configured");
  const url = new URL(raw);
  return new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
    connectTimeout: 5000,
    acquireTimeout: 10000,
  });
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter: adapterFromUrl() });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
