import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

// GET /api/admin/support - Get all tickets across all tenants with filter & search
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const category = searchParams.get("category")
    const search = searchParams.get("search")

    const where: any = {}
    if (status && status !== "all") where.status = status
    if (category && category !== "all") where.category = category
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { tenant: { name: { contains: search, mode: "insensitive" } } },
        { tenant: { slug: { contains: search, mode: "insensitive" } } },
      ]
    }

    const tickets = await db.supportTicket.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, image: true, role: true } },
        tenant: { select: { id: true, name: true, slug: true, plan: true, logo: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { updatedAt: "desc" }
    })

    const summary = {
      total: tickets.length,
      open: tickets.filter(t => t.status === "open").length,
      inProgress: tickets.filter(t => t.status === "in_progress").length,
      resolved: tickets.filter(t => t.status === "resolved" || t.status === "closed").length,
      urgent: tickets.filter(t => t.priority === "urgent" || t.priority === "high").length,
    }

    return NextResponse.json({ tickets, summary })
  } catch (error: any) {
    console.error("[Admin Support GET Error]:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
