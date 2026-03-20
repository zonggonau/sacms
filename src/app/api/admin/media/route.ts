import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

// GET /api/admin/media - Get media stats across all tenants
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [totalFiles, totalSize, totalFolders, recentMedia] = await Promise.all([
      db.media.count(),
      db.media.aggregate({ _sum: { size: true } }),
      db.mediaFolder.count(),
      db.media.findMany({
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ])

    // Group by tenant
    const byTenant = await db.media.groupBy({
      by: ["tenantId"],
      _count: { id: true },
      _sum: { size: true },
    })

    // Get tenant names for each group
    const tenantIds = byTenant.map((b) => b.tenantId)
    const tenants = await db.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true, slug: true },
    })

    const tenantMap = new Map(tenants.map((t) => [t.id, t]))

    const tenantStats = byTenant.map((b) => ({
      tenant: tenantMap.get(b.tenantId) || { id: b.tenantId, name: "Unknown", slug: "" },
      fileCount: b._count.id,
      totalSize: b._sum.size || 0,
    }))

    return NextResponse.json({
      stats: {
        totalFiles,
        totalSize: totalSize._sum.size || 0,
        totalFolders,
      },
      tenantStats,
      recentMedia,
    })
  } catch (error) {
    console.error("Error fetching media stats:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
