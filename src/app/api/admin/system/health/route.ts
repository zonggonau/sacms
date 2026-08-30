import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getRedis } from "@/lib/redis"
import { isContaboConfigured } from "@/lib/infrastructure/contabo"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const healthChecks: Record<string, { status: "healthy" | "degraded" | "down", latencyMs: number, message?: string }> = {}

    // 1. PostgreSQL 17 Master DB
    const dbStart = Date.now()
    try {
      await db.$queryRaw`SELECT 1`
      healthChecks.database = {
        status: "healthy",
        latencyMs: Date.now() - dbStart,
        message: "PostgreSQL 17 connection pool active"
      }
    } catch (err: any) {
      healthChecks.database = {
        status: "down",
        latencyMs: Date.now() - dbStart,
        message: err?.message || "Database connection error"
      }
    }

    // 2. Upstash Redis / Memory Fallback
    const redisStart = Date.now()
    const redis = getRedis()
    if (redis) {
      try {
        await redis.ping()
        healthChecks.redis = {
          status: "healthy",
          latencyMs: Date.now() - redisStart,
          message: "Upstash Redis edge cluster active"
        }
      } catch (err: any) {
        healthChecks.redis = {
          status: "degraded",
          latencyMs: Date.now() - redisStart,
          message: "Redis unreachable, in-memory fallback active"
        }
      }
    } else {
      healthChecks.redis = {
        status: "degraded",
        latencyMs: 0,
        message: "Redis unconfigured, running in-memory rate limiter"
      }
    }

    // 3. Cloudflare R2 / S3 Object Storage
    const hasR2 = !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY)
    healthChecks.storage = {
      status: hasR2 ? "healthy" : "degraded",
      latencyMs: 0,
      message: hasR2 ? "Cloudflare R2 storage configured" : "Local/Mock storage mode"
    }

    // 4. Contabo Appliance API
    const contaboConfigured = isContaboConfigured()
    healthChecks.infrastructure = {
      status: contaboConfigured ? "healthy" : "degraded",
      latencyMs: 0,
      message: contaboConfigured ? "Contabo API active" : "Simulation mode (mock credentials)"
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      health: healthChecks
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 })
  }
}
