import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { collectSystemMetrics } from "@/lib/monitoring"

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

    // Trigger precise real-time hardware metric aggregation and DB logging
    const freshMetrics = await collectSystemMetrics()

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    // Get latest metrics from DB within the last hour
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

    // Fallback logic if database query returned nothing, using the fresh metrics collected
    if (metrics.length === 0 && freshMetrics) {
      return NextResponse.json({
        metrics: [
          { type: "cpu", value: freshMetrics.cpu, metadata: null, timestamp: freshMetrics.timestamp.toISOString() },
          { type: "memory", value: freshMetrics.memory, metadata: JSON.stringify(freshMetrics.memoryMetadata), timestamp: freshMetrics.timestamp.toISOString() },
          { type: "requests", value: freshMetrics.requests, metadata: null, timestamp: freshMetrics.timestamp.toISOString() },
          { type: "errors", value: freshMetrics.errors, metadata: null, timestamp: freshMetrics.timestamp.toISOString() },
        ],
      })
    }

    return NextResponse.json({ metrics })
  } catch (error) {
    console.error("Error fetching metrics:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
