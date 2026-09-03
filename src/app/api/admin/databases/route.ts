import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { getRedis } from "@/lib/redis"
import { withAdminAuth } from "@/lib/api/route-helpers"

export const GET = withAdminAuth(
  async () => {
    const startTime = Date.now()
    
    // Check Primary PostgreSQL
    let pgStatus = "healthy"
    let pgLatency = 0
    let pgError: string | null = null

    try {
      await db.$queryRaw`SELECT 1`
      pgLatency = Date.now() - startTime
    } catch (err: any) {
      pgStatus = "unhealthy"
      pgError = err.message || "Database connection error"
    }

    // Check Redis Status
    let redisStatus = "not_configured"
    let redisLatency = 0
    let redisError: string | null = null

    const redis = getRedis()
    if (redis) {
      const rStartTime = Date.now()
      try {
        await redis.ping()
        redisStatus = "connected"
        redisLatency = Date.now() - rStartTime
      } catch (err: any) {
        redisStatus = "error"
        redisError = err.message || "Redis ping failed"
      }
    }

    // Fetch counts and Enterprise DB routing
    const [
      tenantCount,
      userCount,
      contentCount,
      mediaCount,
      auditLogCount,
      enterpriseTenants
    ] = await Promise.all([
      db.tenant.count(),
      db.user.count(),
      db.contentEntry.count(),
      db.media.count(),
      db.auditLog.count(),
      db.tenant.findMany({
        where: {
          OR: [
            { databaseUrl: { not: null } },
            { plan: "enterprise" }
          ]
        },
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          databaseUrl: true,
          status: true,
          createdAt: true
        }
      })
    ])

    return NextResponse.json({
      primaryDb: {
        engine: "PostgreSQL",
        pool: "Prisma Client (Shared Multi-tenant Pool)",
        status: pgStatus,
        latencyMs: pgLatency,
        error: pgError,
      },
      cache: {
        engine: "Upstash Redis",
        status: redisStatus,
        latencyMs: redisLatency,
        error: redisError,
      },
      metrics: {
        totalTenants: tenantCount,
        totalUsers: userCount,
        totalContentEntries: contentCount,
        totalMediaFiles: mediaCount,
        totalAuditLogs: auditLogCount,
      },
      enterpriseRouting: {
        totalEnterpriseTenants: enterpriseTenants.length,
        dedicatedInstances: enterpriseTenants.filter(t => !!t.databaseUrl).length,
        tenants: enterpriseTenants.map(t => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          plan: t.plan,
          hasDedicatedDb: !!t.databaseUrl,
          dbMode: t.databaseUrl ? "Dedicated Instance" : "Shared High-Performance Pool",
          status: t.status,
          createdAt: t.createdAt.toISOString()
        }))
      }
    })
  },
  { allowRoles: ["admin"] },
)
