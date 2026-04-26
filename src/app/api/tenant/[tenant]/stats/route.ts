import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"

type Context = { params: Promise<{ tenant: string }> }

export async function GET(request: NextRequest, context: Context) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug } = await context.params
    
    // Resolve access and tenant ID from Master DB
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden or Tenant not found" }, { status: 403 })

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    // Fetch stats from the correct database (Shared or Isolated)
    const [
      tenantData,
      contentTypeCount,
      singleTypeCount,
      entriesByStatus,
      apiTokenCount,
      webhookCount,
      recentEntries,
      superAdmins,
    ] = await Promise.all([
      tenantDb.tenant.findUnique({
        where: { id: tenantId },
        select: { _count: { select: { members: true, media: true } } }
      }),
      tenantDb.tenantContentTypeAssignment.count({ where: { tenantId } }),
      tenantDb.tenantSingleTypeAssignment.count({ where: { tenantId } }),
      tenantDb.contentEntry.groupBy({
        by: ["status"],
        where: { tenantId },
        _count: { _all: true },
      }),
      tenantDb.apiToken.count({ where: { tenantId } }),
      tenantDb.webhook.count({ where: { tenantId } }),
      tenantDb.contentEntry.findMany({
        where: { tenantId },
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          updatedBy: true,
          contentType: { select: { name: true, slug: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      db.user.findMany({ where: { role: "super_admin" }, select: { id: true } })
    ])

    const superAdminIds = new Set(superAdmins.map(u => u.id))
    const filteredRecentEntries = recentEntries
      .filter(e => !e.updatedBy || !superAdminIds.has(e.updatedBy))
      .slice(0, 8)

    const statusMap = Object.fromEntries(
      (entriesByStatus || []).map((g) => [g.status.toLowerCase(), g._count._all])
    )

    const totalEntries = entriesByStatus ? Object.values(statusMap).reduce((a, b) => (a as number) + (b as number), 0) : 0

    return NextResponse.json({
      tenant: access.tenant,
      contentTypeCount,
      singleTypeCount,
      totalEntries,
      mediaCount: tenantData?._count?.media || 0,
      memberCount: tenantData?._count?.members || 0,
      apiTokenCount,
      webhookCount,
      entries: {
        draft: statusMap["draft"] || 0,
        in_review: statusMap["in_review"] || 0,
        approved: statusMap["approved"] || 0,
        scheduled: statusMap["scheduled"] || 0,
        published: statusMap["published"] || 0,
        archived: statusMap["archived"] || 0,
      },
      recentEntries: filteredRecentEntries.map((e) => ({
        id: e.id,
        status: e.status,
        contentType: e.contentType.name,
        contentTypeSlug: e.contentType.slug,
        updatedAt: e.updatedAt,
      })),
    })
  } catch (error) {
    console.error("Error fetching stats:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
