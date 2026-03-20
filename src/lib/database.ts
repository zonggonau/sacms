import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Reset the instance once to ensure we pick up the new schema fields
if (globalForPrisma.prisma && !('role' in globalForPrisma.prisma)) {
  console.log('Detected old Prisma instance, resetting cache...')
  globalForPrisma.prisma = undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db