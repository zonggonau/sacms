import { NextResponse } from "next/server"
import { db } from "@/lib/database"

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
    checks.database = { status: "error", detail: (e as Error).message }
  }

  // 3. Memory usage
  const mem = process.memoryUsage()
  checks.memory = {
    status: "ok",
    detail: `${Math.round(mem.heapUsed / 1024 / 1024)}MB / ${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
  }

  // 4. Uptime
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
