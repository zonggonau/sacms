import path from 'path'
import fs from 'fs'

// Explicitly resolve Prisma Query Engine library path on Windows to avoid runtime lookup errors
if (process.platform === 'win32' && !process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  const possiblePaths = [
    path.resolve(process.cwd(), 'prisma/generated-client/query_engine-windows.dll.node'),
    path.resolve(process.cwd(), 'prisma/generated-client-new/query_engine-windows.dll.node'),
    path.resolve(process.cwd(), 'prisma/query_engine-windows.dll.node'),
  ]
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = p
      break
    }
  }
}

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
    if (
      !(globalThis as any).__prisma_reset_v11 ||
      !(globalForPrisma.prisma as any).site ||
      !(globalForPrisma.prisma as any).siteFile ||
      !(globalForPrisma.prisma as any).permission ||
      !(globalForPrisma.prisma as any).rolePermission
    ) {
      console.log('[Prisma] Forcing client refresh for query engine recovery & RBAC...')
      globalForPrisma.prisma = undefined
      if (globalForPrisma.tenantClients) {
        globalForPrisma.tenantClients.clear()
      }
      ;(globalThis as any).__prisma_reset_v11 = true
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

  try {
    console.log(`[Database] Initializing dedicated DB client for tenant: ${tenant.slug}`)
    const client = new PrismaClient({
      datasources: { db: { url: dbUrl } },
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })

    tenantClients.set(dbUrl, { client, lastAccess: Date.now() })
    return client
  } catch (error) {
    console.error(`[Database] Failed to initialize dedicated DB for tenant ${tenant.slug}:`, error)
    return db
  }
}

export async function getTenantDbById(tenantId: string | null | undefined, forceFresh = false): Promise<PrismaClient> {
  if (!tenantId) {
    return db
  }

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { databaseUrl: true, slug: true }
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

  try {
    const client = new PrismaClient({
      datasources: { db: { url: dbUrl } },
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })

    tenantClients.set(dbUrl, { client, lastAccess: Date.now() })
    return client
  } catch (error) {
    console.error(`[Database] Failed to initialize dedicated DB by ID ${tenantId}:`, error)
    return db
  }
}
