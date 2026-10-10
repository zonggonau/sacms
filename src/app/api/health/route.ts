import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { getRedis, isRedisAvailable } from "@/lib/redis"

export const dynamic = "force-dynamic"

export async function GET() {
  const checks: Record<string, string | { status: string; detail?: string }> = {}
  let allOk = true

  // 1. App info
  checks.app = "ok"
  checks.timestamp = new Date().toISOString()
  checks.node_env = process.env.NODE_ENV || "unknown"

  // 2. Database connectivity
  try {
    await db.$queryRaw`SELECT 1`
    checks.database = { status: "ok" }
  } catch (e) {
    allOk = false
    // This endpoint is intentionally public/unauthenticated (CI + Caddy poll
    // it with no credentials) — log the real error server-side only, never
    // in the response, so a DB outage doesn't hand an unauthenticated
    // caller internal connection details.
    console.error("[health] Database check failed:", e)
    checks.database = { status: "error", detail: "Database unreachable" }
  }

  // 3. Redis connectivity — informational only, not a deploy gate. Custom
  // domain routing (proxy.ts) and settings caching silently degrade without
  // Redis, but that shouldn't fail the healthcheck the CI deploy hook polls.
  if (!isRedisAvailable()) {
    checks.redis = { status: "unconfigured" }
  } else {
    try {
      await getRedis()?.ping()
      checks.redis = { status: "ok" }
    } catch (e) {
      console.error("[health] Redis check failed:", e)
      checks.redis = { status: "error", detail: "Redis unreachable" }
    }
  }

  // 4. Memory usage
  const mem = process.memoryUsage()
  checks.memory = {
    status: "ok",
    detail: `${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
  }

  // 5. Uptime
  checks.uptime = `${Math.floor(process.uptime())}s`

  const statusCode = allOk ? 200 : 503
  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      checks,
    },
    { status: statusCode }
  )
}
