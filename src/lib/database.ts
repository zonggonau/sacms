import path from 'path'
import fs from 'fs'
import { TenantDatabaseUnavailableError } from './tenant-database-error'

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

import { PrismaClient, Prisma } from '../../prisma/generated-client'

// Re-export the client + model types so nothing outside this module needs the
// generated-client path directly (see architecture review, finding 6).
export { PrismaClient, Prisma }
export type {
  Tenant,
  TenantMember,
  Member,
  MemberRole,
  MemberRolePermission,
  ContentType,
  ContentEntry,
  ContentVersion,
  SchemaField,
  SingleType,
  Component,
  Media,
  ContentStatus,
} from '../../prisma/generated-client'

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
      !(globalThis as any).__prisma_reset_v12 ||
      !(globalForPrisma.prisma as any).site ||
      !(globalForPrisma.prisma as any).siteFile ||
      !(globalForPrisma.prisma as any).permission ||
      !(globalForPrisma.prisma as any).rolePermission
    ) {
      console.log('[Prisma] Forcing client refresh for query engine recovery...')
      globalForPrisma.prisma = undefined
      if (globalForPrisma.tenantClients) {
        globalForPrisma.tenantClients.clear()
      }
      ;(globalThis as any).__prisma_reset_v12 = true
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

/**
 * Cool down a failed dedicated connection without routing its requests to
 * another database. Workspaces sharing the same configured connection share
 * its cooldown.
 */
const unavailableConnections = new Map<string, number>()
const DATABASE_RETRY_MS = 30_000

function isConnectionError(error: any): boolean {
  if (!error) return false
  const msg = String(error.message || '')
  const name = String(error.name || '')
  const code = String(error.code || error.errorCode || '')
  return (
    name === 'PrismaClientInitializationError' ||
    code === 'P1001' || // Can't reach database server
    code === 'P1002' || // The database server timed out
    code === 'P1003' || // Database does not exist
    code === 'P1017' || // Connection closed by the server
    code === 'P2024' || // Connection pool exhausted
    msg.includes("Can't reach database server") ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND')
  )
}

/** Add/override `connection_limit` and `connect_timeout` on a Postgres URL without clobbering other params. */
function withConnectionLimit(dbUrl: string, limit: number): string {
  try {
    const u = new URL(dbUrl)
    if (!u.searchParams.has('connection_limit')) {
      u.searchParams.set('connection_limit', String(limit))
    }
    if (!u.searchParams.has('connect_timeout')) {
      u.searchParams.set('connect_timeout', '3')
    }
    return u.toString()
  } catch {
    // Not a parseable URL (shouldn't happen) — fall back to naive append.
    let res = dbUrl.includes('connection_limit')
      ? dbUrl
      : `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}connection_limit=${limit}`
    if (!res.includes('connect_timeout')) {
      res = `${res}${res.includes('?') ? '&' : '?'}connect_timeout=3`
    }
    return res
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
  const unavailableUntil = unavailableConnections.get(dbUrl)
  if (!forceFresh && unavailableUntil && unavailableUntil > Date.now()) {
    throw new TenantDatabaseUnavailableError()
  }
  unavailableConnections.delete(dbUrl)

  if (!forceFresh) {
    const existing = tenantClients.get(dbUrl)
    if (existing) {
      existing.lastAccess = Date.now()
      return existing.client
    }
  }

  evictLruTenantClients()

  console.log(`[Database] Initializing dedicated DB client for tenant: ${slug}`)
  const handleConnectionError = (error: unknown): never => {
    if (!isConnectionError(error)) throw error
    unavailableConnections.set(dbUrl, Date.now() + DATABASE_RETRY_MS)
    console.warn(`[Database] Dedicated database connection unavailable (workspace ${slug}).`)
    throw new TenantDatabaseUnavailableError()
  }
  const rawClient = new PrismaClient({
    datasources: { db: { url: dbUrl } },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
  const scopedClient = rawClient.$extends({
    query: {
      async $allOperations({ args, query }) {
        try {
          return await query(args)
        } catch (error) {
          return handleConnectionError(error)
        }
      },
    },
  })
  // A database failure can also occur while opening the transaction, before
  // the query extension runs. Preserve PrismaPromise inputs for batch transactions.
  const client = new Proxy(scopedClient, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver)
      if (property !== '$transaction' || typeof value !== 'function') return value
      return async (...args: unknown[]) => {
        try {
          return await Reflect.apply(value, target, args)
        } catch (error) {
          return handleConnectionError(error)
        }
      }
    },
  }) as unknown as PrismaClient
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
    for (const [dbUrl, expiry] of unavailableConnections) {
      if (expiry <= now) unavailableConnections.delete(dbUrl)
    }
  }, 5 * 60 * 1000) // Check every 5 minutes
  globalForPrisma.cleanupInterval.unref()
}

interface OwnerMasterInfra {
  databaseUrl: string | null
  storageConfig: Record<string, string> | null
}

interface OwnerMasterInfraCacheEntry extends OwnerMasterInfra {
  expiresAt: number
}

/**
 * Account-level DB/storage override, auto-provisioned once for an
 * Enterprise License holder on activation (see
 * src/app/api/user/license/activate/route.ts) — the fallback used by every
 * workspace that owner owns which has no override of its own
 * (`tenant.databaseUrl`/`storageConfig` null). Priority is always: tenant's
 * own override > owner's master override > SaCMS shared default.
 *
 * Re-validates the license live (not just at write time) so a
 * revoked/expired license stops being honored here too, even though the
 * raw values remain stored on the User row. Cached briefly per tenant since
 * this is consulted on the hot request path below for every tenant without
 * its own dedicated DB — i.e. almost every tenant on the platform.
 */
const MASTER_INFRA_CACHE_MS = 60_000
const ownerMasterInfraCache = new Map<string, OwnerMasterInfraCacheEntry>()

/**
 * BYODB/BYOS (the owner's own Postgres/MinIO, set via the
 * /api/user/infrastructure settings modal) is restricted to Enterprise and
 * Agency plan owners — re-checked live, same reasoning as the license
 * re-validation above, so a downgrade stops being honored immediately
 * rather than only at the next save.
 */
export async function isOwnerEligibleForByoInfra(ownerId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: ownerId }, select: { plan: true } })
  if (user?.plan === 'enterprise' || user?.plan === 'agency') return true
  const { INSTANCE_LICENSE_ID, isEnterpriseTenant } = await import('./license')
  return isEnterpriseTenant(INSTANCE_LICENSE_ID, ownerId)
}

const WORKSPACE_BYO_PLANS = new Set(["business", "bisnis", "enterprise"])

/**
 * A second, independent BYODB/BYOS gate — this one driven by the WORKSPACE's
 * own plan (Tenant.plan), not its owner's account plan, since one account
 * can own workspaces on different plans. Deliberately narrower than
 * isOwnerEligibleForByoInfra's license fallback: it requires an actual
 * valid Enterprise License (isEnterpriseTenant), not just
 * User.plan === 'enterprise'/'agency' on its own — confirmed with the user.
 * Live DB check, no caching (same reasoning as isOwnerEligibleForByoInfra —
 * this is only called on the infrequent settings-page GET/PUT path).
 */
export async function isWorkspaceEligibleForByoInfra(tenantId: string): Promise<boolean> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { plan: true, ownerId: true } })
  if (!tenant) return false
  if (WORKSPACE_BYO_PLANS.has((tenant.plan || "").trim().toLowerCase())) return true
  if (!tenant.ownerId) return false
  const { INSTANCE_LICENSE_ID, isEnterpriseTenant } = await import('./license')
  return isEnterpriseTenant(INSTANCE_LICENSE_ID, tenant.ownerId)
}

export async function getOwnerMasterInfra(tenantId: string): Promise<OwnerMasterInfra> {
  const cached = ownerMasterInfraCache.get(tenantId)
  if (cached && cached.expiresAt > Date.now()) {
    return { databaseUrl: cached.databaseUrl, storageConfig: cached.storageConfig }
  }

  let result: OwnerMasterInfra = { databaseUrl: null, storageConfig: null }
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { useOwnerInfra: true } })
  // Check the stored opt-out before resolving the owner's database or storage.
  // A failed metadata lookup must not be cached as an opt-out.
  if (tenant && tenant.useOwnerInfra !== false) {
    const owner = await db.tenantMember.findFirst({ where: { tenantId, role: 'owner' }, select: { userId: true } })
    if (owner) {
      const allowed = await isOwnerEligibleForByoInfra(owner.userId)
      if (allowed) {
        const user = await db.user.findUnique({
          where: { id: owner.userId },
          select: { masterDatabaseUrl: true, masterStorageConfig: true },
        })
        if (user) {
          const sc = user.masterStorageConfig as any
          const hasStorage = sc && sc.endpoint && sc.accessKey && sc.secretKey && sc.bucket
          result = {
            databaseUrl: user.masterDatabaseUrl || null,
            storageConfig: hasStorage ? sc : null,
          }
        }
      }
    }
  }

  ownerMasterInfraCache.set(tenantId, { ...result, expiresAt: Date.now() + MASTER_INFRA_CACHE_MS })
  return result
}

/** Called after an Enterprise License activation provisions/saves the
 *  account's dedicated database — so every workspace this owner owns
 *  reflects the change immediately instead of up to 60s later. */
export async function invalidateOwnerMasterInfraCache(ownerId: string): Promise<void> {
  const owned = await db.tenantMember.findMany({ where: { userId: ownerId, role: 'owner' }, select: { tenantId: true } })
  for (const { tenantId } of owned) {
    ownerMasterInfraCache.delete(tenantId)
  }
}

/** The same data-store selection used by request and release tooling. */
export async function getTenantDatabaseUrl(tenant: { id: string; databaseUrl: string | null }): Promise<string | null> {
  return tenant.databaseUrl || (await getOwnerMasterInfra(tenant.id)).databaseUrl
}

async function resolveTenantClient(
  tenant: { id: string; slug: string; databaseUrl: string | null } | null,
  forceFresh: boolean,
): Promise<PrismaClient> {
  if (!tenant) return db
  try {
    const dedicatedUrl = await getTenantDatabaseUrl(tenant)
    return dedicatedUrl ? acquireTenantClient(dedicatedUrl, tenant.slug, forceFresh) : db
  } catch (error) {
    if (error instanceof TenantDatabaseUnavailableError) throw error
    console.error(`[Database] Could not resolve data database (workspace ${tenant.slug}).`)
    throw new TenantDatabaseUnavailableError()
  }
}

export async function getTenantDb(tenantIdOrSlug: string, forceFresh = false): Promise<PrismaClient> {
  const tenant = await db.tenant.findFirst({
    where: { OR: [{ id: tenantIdOrSlug }, { slug: tenantIdOrSlug }] },
    select: { id: true, databaseUrl: true, slug: true },
  })
  return resolveTenantClient(tenant, forceFresh)
}

export async function getTenantDbById(tenantId: string | null | undefined, forceFresh = false): Promise<PrismaClient> {
  if (!tenantId) return db
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, databaseUrl: true, slug: true },
  })
  return resolveTenantClient(tenant, forceFresh)
}
