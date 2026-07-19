/**
 * Prisma client singleton (spec §59).
 *
 * A single instance is reused across hot-reloads in development to avoid
 * exhausting database connections. This is the ONLY place a `PrismaClient` is
 * instantiated — repositories import `prisma` from here.
 */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export type { Prisma } from '@prisma/client';
