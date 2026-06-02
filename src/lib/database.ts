import { PrismaClient } from '../../prisma/generated-client'

interface TenantClientEntry {
  client: PrismaClient
  lastAccess: number
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  tenantClients: Map<string, TenantClientEntry> | undefined
  cleanupInterval: NodeJS.Timeout | undefined
}

// Reset logic to pick up schema changes in dev
if (globalForPrisma.prisma) {
  try {
    if (!(globalThis as any).__prisma_reset_v2) {
       console.log('[Prisma] Forcing client refresh for new schema fields...')
       globalForPrisma.prisma = undefined
       ;(globalThis as any).__prisma_reset_v2 = true
    }
  } catch (e) {
    globalForPrisma.prisma = undefined
  }
}

/**
 * Shared Database Client (Master DB)
 */
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * Cache for Enterprise/Dedicated Tenant DB Clients with TTL
 */
const tenantClients = globalForPrisma.tenantClients ?? new Map<string, TenantClientEntry>()
if (process.env.NODE_ENV !== 'production') globalForPrisma.tenantClients = tenantClients

const IDLE_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

// Periodic cleanup of idle connections
if (!globalForPrisma.cleanupInterval) {
  globalForPrisma.cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [dbUrl, entry] of tenantClients.entries()) {
      if (now - entry.lastAccess > IDLE_TIMEOUT_MS) {
        console.log(`[Database] Closing idle dedicated DB client.`)
        entry.client.$disconnect().catch(console.error)
        tenantClients.delete(dbUrl)
      }
    }
  }, 5 * 60 * 1000) // Check every 5 minutes
}

export async function getTenantDb(tenantIdOrSlug: string, forceFresh = false): Promise<PrismaClient> {
  const tenant = await db.tenant.findFirst({
    where: { 
      OR: [
        { id: tenantIdOrSlug },
        { slug: tenantIdOrSlug }
      ]
    },
    select: { id: true, databaseUrl: true, slug: true }
  })

  if (!tenant || !tenant.databaseUrl) {
    return db
  }

  const dbUrl = tenant.databaseUrl

  if (!forceFresh && tenantClients.has(dbUrl)) {
    const entry = tenantClients.get(dbUrl)!
    entry.lastAccess = Date.now()
    return entry.client
  }

  console.log(`[Database] Initializing dedicated DB client for tenant: ${tenant.slug}`)
  const client = new PrismaClient({
    datasources: { db: { url: dbUrl } },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

  tenantClients.set(dbUrl, { client, lastAccess: Date.now() })
  return client
}

export async function getTenantDbById(tenantId: string, forceFresh = false): Promise<PrismaClient> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { databaseUrl: true }
  })

  if (!tenant || !tenant.databaseUrl) {
    return db
  }

  const dbUrl = tenant.databaseUrl

  if (!forceFresh && tenantClients.has(dbUrl)) {
    const entry = tenantClients.get(dbUrl)!
    entry.lastAccess = Date.now()
    return entry.client
  }

  const client = new PrismaClient({
    datasources: { db: { url: dbUrl } }
  })

  tenantClients.set(dbUrl, { client, lastAccess: Date.now() })
  return client
}
