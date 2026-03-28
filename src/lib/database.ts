import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  tenantClients: Map<string, PrismaClient> | undefined
}

// Reset logic to pick up schema changes in dev
if (globalForPrisma.prisma) {
  try {
    // Try to access the new field to see if the client is up to date
    // We use a dummy query that won't execute but triggers validation if we were to run it
    // or just check the internal dmmf if available. 
    // Actually, the simplest way is to check if we've already done this reset in this process.
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
 * Used for:
 * 1. Managing tenants, users, and global settings.
 * 2. Shared/Small tenants data.
 */
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

/**
 * Cache for Enterprise/Dedicated Tenant DB Clients
 */
const tenantClients = globalForPrisma.tenantClients ?? new Map<string, PrismaClient>()
if (process.env.NODE_ENV !== 'production') globalForPrisma.tenantClients = tenantClients

/**
 * Resolves the correct database client for a specific tenant.
 * Supports Hybrid Multi-tenancy:
 * - If tenant has a custom databaseUrl, returns a dedicated Prisma client.
 * - Otherwise, returns the shared (master) database client.
 */
export async function getTenantDb(tenantSlug: string): Promise<PrismaClient> {
  // 1. Check if it's the master tenant or shared
  const tenant = await db.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, databaseUrl: true }
  })

  // 2. Fallback to Shared DB if no custom URL or tenant not found
  if (!tenant || !tenant.databaseUrl) {
    return db
  }

  const dbUrl = tenant.databaseUrl

  // 3. Return cached client if exists
  if (tenantClients.has(dbUrl)) {
    return tenantClients.get(dbUrl)!
  }

  // 4. Create and cache new dedicated client for Enterprise/Gov
  console.log(`[Database] Initializing dedicated DB client for tenant: ${tenantSlug}`)
  const client = new PrismaClient({
    datasources: {
      db: { url: dbUrl }
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

  tenantClients.set(dbUrl, client)
  return client
}

/**
 * Utility for background tasks or cases where tenant ID is known but slug is not.
 */
export async function getTenantDbById(tenantId: string): Promise<PrismaClient> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { databaseUrl: true }
  })

  if (!tenant || !tenant.databaseUrl) {
    return db
  }

  if (tenantClients.has(tenant.databaseUrl)) {
    return tenantClients.get(tenant.databaseUrl)!
  }

  const client = new PrismaClient({
    datasources: { db: { url: tenant.databaseUrl } }
  })

  tenantClients.set(tenant.databaseUrl, client)
  return client
}
