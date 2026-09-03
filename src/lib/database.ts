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

/**
 * Hard cap on concurrently-open dedicated tenant clients. Each client keeps its
 * own connection pool, so total DB connections ≈ MAX_TENANT_CLIENTS * pool size.
 * Override with MAX_TENANT_DB_CLIENTS.
 */
const MAX_TENANT_CLIENTS = (() => {
  const raw = Number(process.env.MAX_TENANT_DB_CLIENTS)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 25
})()

/**
 * Per-client pool size for dedicated tenant databases. Kept small because many
 * clients may be live at once. Override with TENANT_DB_CONNECTION_LIMIT.
 */
const TENANT_CONNECTION_LIMIT = (() => {
  const raw = Number(process.env.TENANT_DB_CONNECTION_LIMIT)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 3
})()

/** Add/override `connection_limit` on a Postgres URL without clobbering other params. */
function withConnectionLimit(dbUrl: string, limit: number): string {
  try {
    const u = new URL(dbUrl)
    if (!u.searchParams.has('connection_limit')) {
      u.searchParams.set('connection_limit', String(limit))
    }
    return u.toString()
  } catch {
    // Not a parseable URL (shouldn't happen) — fall back to naive append.
    return dbUrl.includes('connection_limit')
      ? dbUrl
      : `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}connection_limit=${limit}`
  }
}

/** Evict the least-recently-used clients until we're back under the cap. */
function evictLruTenantClients(): void {
  if (tenantClients.size < MAX_TENANT_CLIENTS) return
  const sorted = [...tenantClients.entries()].sort((a, b) => a[1].lastAccess - b[1].lastAccess)
  while (tenantClients.size >= MAX_TENANT_CLIENTS && sorted.length > 0) {
    const [url, entry] = sorted.shift()!
    console.log('[Database] Evicting least-recently-used dedicated DB client (cap reached).')
    entry.client.$disconnect().catch(() => {})
    tenantClients.delete(url)
  }
}

/**
 * Get (or create) the pooled Prisma client for a dedicated tenant database URL.
 * Enforces the LRU cap and injects a small connection_limit.
 */
function acquireTenantClient(rawDbUrl: string, slug: string, forceFresh: boolean): PrismaClient {
  const dbUrl = withConnectionLimit(rawDbUrl, TENANT_CONNECTION_LIMIT)

  if (!forceFresh) {
    const existing = tenantClients.get(dbUrl)
    if (existing) {
      existing.lastAccess = Date.now()
      return existing.client
    }
  }

  evictLruTenantClients()

  console.log(`[Database] Initializing dedicated DB client for tenant: ${slug}`)
  const client = new PrismaClient({
    datasources: { db: { url: dbUrl } },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
  tenantClients.set(dbUrl, { client, lastAccess: Date.now() })
  return client
}

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

  try {
    return acquireTenantClient(tenant.databaseUrl, tenant.slug, forceFresh)
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

  try {
    return acquireTenantClient(tenant.databaseUrl, tenant.slug, forceFresh)
  } catch (error) {
    console.error(`[Database] Failed to initialize dedicated DB by ID ${tenantId}:`, error)
    return db
  }
}
