import { PrismaClient } from "@prisma/client";
import { withConnectionLimit } from "./dbUrl";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// PRISMA_LOG=query prints every SQL statement (to count what a page costs; never set it on the live site).
const logLevels: ("query" | "warn" | "error")[] =
  process.env.PRISMA_LOG === "query" ? ["query", "warn", "error"] : process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];

const databaseUrl = process.env.DATABASE_URL;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Without DATABASE_URL (a build, or a test) Prisma keeps reading the schema's own `env("DATABASE_URL")`.
    ...(databaseUrl ? { datasourceUrl: withConnectionLimit(databaseUrl) } : {}),
    log: logLevels,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
