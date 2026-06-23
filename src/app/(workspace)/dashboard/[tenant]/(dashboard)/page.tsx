import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { enforcePlanLimit } from "@/lib/plan-enforcement"
import { redirect } from "next/navigation"
import TenantDashboardClient from "./client-page"

export default async function TenantDashboardPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant: tenantSlug } = await params
  const access = await getTenantAccess(session, tenantSlug)
  
  if (!access) redirect("/dashboard")

  const tenantId = access.tenantId
  const tenantDb = await getTenantDb(tenantSlug)

  // 1. Fetch Content Types
  const availableContentTypes = await tenantDb.contentType.findMany({
    where: {
      OR: [
        { tenantId: tenantId },
        { tenants: { some: { tenantId: tenantId, enabled: true } } }
      ]
    },
    include: { schemaFields: { orderBy: { order: "asc" } } },
    orderBy: { updatedAt: "desc" },
  })

  const contentTypes = await Promise.all(
    availableContentTypes.map(async (contentType) => {
      const entryCount = await tenantDb.contentEntry.count({
        where: { contentTypeId: contentType.id, tenantId: tenantId },
      })

      const formattedFields = contentType.schemaFields.map(field => {
        let parsedOptions = field.options
        if (typeof field.options === 'string') {
          try { parsedOptions = JSON.parse(field.options) } catch (e) { parsedOptions = {} }
        }
        return { ...field, options: parsedOptions }
      })

      return {
        ...contentType,
        fields: formattedFields,
        entryCount,
        isGlobal: false,
      }
    })
  )

  // 2. Fetch Stats
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

  const stats = {
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
      updatedAt: e.updatedAt.toISOString(),
    })),
  }

  // 3. Fetch Usage
  const [entriesLimit, storageLimit, membersLimit] = await Promise.all([
    enforcePlanLimit(tenantId, "content_entries"),
    enforcePlanLimit(tenantId, "storage"),
    enforcePlanLimit(tenantId, "team_members")
  ])

  const mediaSizeSum = await tenantDb.media.aggregate({
    where: { tenantId },
    _sum: { size: true }
  })

  const usage = [
    {
      label: "Content Entries",
      current: entriesLimit.current,
      limit: entriesLimit.max,
      unit: "entries"
    },
    {
      label: "Media Storage",
      current: Number(mediaSizeSum._sum?.size || 0),
      limit: storageLimit.max * 1024 * 1024,
      unit: "bytes"
    },
    {
      label: "Team Members",
      current: membersLimit.current,
      limit: membersLimit.max,
      unit: "users"
    }
  ]

  // Fix updatedAt date types
  const serializedContentTypes = contentTypes.map(ct => ({
    ...ct,
    createdAt: ct.createdAt.toISOString(),
    updatedAt: ct.updatedAt.toISOString(),
  }))

  return (
    <TenantDashboardClient 
      tenantId={tenantId}
      contentTypes={serializedContentTypes as any}
      stats={stats}
      usage={usage}
    />
  )
}
