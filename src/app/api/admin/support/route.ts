import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth } from "@/lib/api/route-helpers"

// GET /api/admin/support - all tickets across all tenants
export const GET = withAdminAuth(async (request) => {
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
})
