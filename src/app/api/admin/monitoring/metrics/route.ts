import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

// GET /api/admin/monitoring/metrics - Get system metrics
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    // Get latest metrics from DB
    const latestMetrics = await db.systemMetric.findMany({
      where: { timestamp: { gte: oneHourAgo } },
      orderBy: { timestamp: "desc" },
    })

    // Aggregate by type (get latest of each type)
    const seenTypes = new Set<string>()
    const metrics = latestMetrics.filter((m) => {
      if (seenTypes.has(m.type)) return false
      seenTypes.add(m.type)
      return true
    })

    // If no metrics exist, return runtime estimates
    if (metrics.length === 0) {
      const memUsage = process.memoryUsage()
      const memPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)

      // Count recent API requests for request rate
      const recentRequests = await db.apiRequest.count({
        where: { createdAt: { gte: oneHourAgo } },
      })

      const errorRequests = await db.apiRequest.count({
        where: {
          createdAt: { gte: oneHourAgo },
          statusCode: { gte: 500 },
        },
      })

      return NextResponse.json({
        metrics: [
          { type: "cpu", value: 0, metadata: null, timestamp: new Date().toISOString() },
          { type: "memory", value: memPercent, metadata: JSON.stringify({ heapUsed: memUsage.heapUsed, heapTotal: memUsage.heapTotal }), timestamp: new Date().toISOString() },
          { type: "requests", value: recentRequests, metadata: null, timestamp: new Date().toISOString() },
          { type: "errors", value: errorRequests, metadata: null, timestamp: new Date().toISOString() },
        ],
      })
    }

    return NextResponse.json({ metrics })
  } catch (error) {
    console.error("Error fetching metrics:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
