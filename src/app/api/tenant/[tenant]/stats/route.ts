import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

type Context = { params: Promise<{ tenant: string }> }

export async function GET(_req: NextRequest, context: Context) {
  const { tenant: tenantSlug } = await context.params

  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenant = await db.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      status: true,
      _count: { select: { members: true, media: true } },
    },
  })

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
  }

  const isSuperAdmin = session.user.role === "super_admin"
  if (!isSuperAdmin) {
    const member = await db.tenantMember.findFirst({
      where: { tenantId: tenant.id, userId: session.user.id },
    })
    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const [
    contentTypeCount,
    singleTypeCount,
    entriesByStatus,
    apiTokenCount,
    webhookCount,
    recentEntries,
  ] = await Promise.all([
    db.tenantContentTypeAssignment.count({ where: { tenantId: tenant.id } }),
    db.tenantSingleTypeAssignment.count({ where: { tenantId: tenant.id } }),
    db.contentEntry.groupBy({
      by: ["status"],
      where: { tenantId: tenant.id },
      _count: { _all: true },
    }),
    db.apiToken.count({ where: { tenantId: tenant.id } }),
    db.webhook.count({ where: { tenantId: tenant.id } }),
    db.contentEntry.findMany({
      where: { 
        tenantId: tenant.id,
        // Optional: Filter out entries last updated by a super_admin if needed
        // but typically content entries are specific to tenant.
        // If the user means they see Super Admin's "system" edits, 
        // we should ensure we only show entries where updatedBy is NOT a super admin.
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        updatedBy: true,
        contentType: { select: { name: true, slug: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 15, // Take more to filter
    }),
  ])

  // Filter out entries updated by super admin
  // We need to fetch the users to check their roles, or just rely on IDs if we have a list of super admins
  const superAdmins = await db.user.findMany({
    where: { role: "super_admin" },
    select: { id: true }
  })
  const superAdminIds = new Set(superAdmins.map(u => u.id))

  const filteredRecentEntries = recentEntries
    .filter(e => !e.updatedBy || !superAdminIds.has(e.updatedBy))
    .slice(0, 8)

  const statusMap = Object.fromEntries(
    (entriesByStatus || []).map((g) => [g.status.toLowerCase(), g._count._all])
  )

  const totalEntries = entriesByStatus ? Object.values(statusMap).reduce((a, b) => (a as number) + (b as number), 0) : 0

  return NextResponse.json({
    contentTypeCount,
    singleTypeCount,
    totalEntries,
    mediaCount: tenant._count.media,
    memberCount: tenant._count.members,
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
}
