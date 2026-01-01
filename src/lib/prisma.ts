import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['warn', 'error'],
  ...(process.env.DATABASE_URL ? {
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  } : {}),
})

// Cache the Prisma client in both development AND production
// This prevents connection pool exhaustion in serverless environments
globalForPrisma.prisma = prisma
