import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { authorizeCronRequest } from "@/lib/cron-auth"
import { checkServerHealth } from "@/lib/infrastructure/provisioner"

export async function GET(request: NextRequest) {
  try {
    const unauthorized = authorizeCronRequest(request)
    if (unauthorized) return unauthorized

    const activeServers = await db.infrastructureServer.findMany({
      where: { status: "active" },
      select: { id: true, name: true, hostname: true, tenantId: true }
    })

    const results: any[] = []
    for (const server of activeServers) {
      try {
        const health = await checkServerHealth(server.id)
        results.push({
          serverId: server.id,
          name: server.name,
          ...health,
        })
      } catch (err: any) {
        results.push({
          serverId: server.id,
          name: server.name,
          healthy: false,
          error: err?.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      checkedCount: activeServers.length,
      results,
    })
  } catch (error) {
    console.error("[Cron Infrastructure Health Error]:", error)
    return NextResponse.json({ error: "Internal Cron Error" }, { status: 500 })
  }
}
