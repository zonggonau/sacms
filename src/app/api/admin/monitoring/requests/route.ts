import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

// GET /api/admin/monitoring/requests - Get recent API request logs
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const requests = await db.apiRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    return NextResponse.json({ requests })
  } catch (error) {
    console.error("Error fetching API requests:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
