import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const search = searchParams.get("search")

    const where: any = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { hostname: { contains: search, mode: "insensitive" } },
        { ipv4: { contains: search, mode: "insensitive" } },
        { tenant: { name: { contains: search, mode: "insensitive" } } },
        { tenant: { slug: { contains: search, mode: "insensitive" } } },
      ]
    }

    const servers = await db.infrastructureServer.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            logo: true,
            status: true,
          }
        },
      },
      orderBy: { createdAt: "desc" }
    })

    const summary = {
      total: servers.length,
      active: servers.filter(s => s.status === 'active').length,
      provisioning: servers.filter(s => s.status === 'provisioning' || s.status === 'configuring').length,
      error: servers.filter(s => s.status === 'error').length,
      suspended: servers.filter(s => s.status === 'suspended').length,
    }

    return NextResponse.json({ servers, summary })
  } catch (error: any) {
    console.error("[API Admin Infrastructure GET Error]:", error)
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
  }
}
