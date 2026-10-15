import { PrismaClient } from '@prisma/client';

// Validate environment on first construction of the DB client — the earliest
// point a missing DATABASE_URL would otherwise surface as an opaque error.
import '@/lib/env';

/**
 * A single PrismaClient instance, reused across hot reloads in development and
 * across invocations in a serverless runtime. Creating a new client per request
 * would exhaust Neon's connection pool.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
