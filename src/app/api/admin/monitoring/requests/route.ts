import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

// GET /api/admin/monitoring/requests - Get recent API request logs
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const statusFilter = searchParams.get("status") || "all"
    const methodFilter = searchParams.get("method") || "all"

    const where: any = {}

    // Search Filter
    if (search) {
      where.OR = [
        { endpoint: { contains: search, mode: "insensitive" } },
        { tenantId: { contains: search, mode: "insensitive" } }
      ]
    }

    // Method Filter
    if (methodFilter !== "all") {
      where.method = methodFilter
    }

    // Status Filter
    if (statusFilter === "success") {
      where.statusCode = { lt: 400 }
    } else if (statusFilter === "client_error") {
      where.statusCode = { gte: 400, lt: 500 }
    } else if (statusFilter === "server_error") {
      where.statusCode = { gte: 500 }
    }

    const skip = (page - 1) * limit

    const [requests, total] = await Promise.all([
      db.apiRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.apiRequest.count({ where })
    ])

    return NextResponse.json({ 
      requests,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    console.error("Error fetching API requests:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
