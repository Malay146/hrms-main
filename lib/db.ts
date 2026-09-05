import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaGeneration?: string;
};

const PRISMA_GENERATION = "scale-5k-jobs-metrics-v1";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 5_000,
    // Scale-to-5k: allow concurrent RSC + actions; override via PG_POOL_MAX.
    max: Number(process.env.PG_POOL_MAX || (process.env.NODE_ENV === "production" ? 20 : 10)),
  });

  return new PrismaClient({ adapter });
}

if (globalForPrisma.prismaGeneration !== PRISMA_GENERATION) {
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaGeneration = PRISMA_GENERATION;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
