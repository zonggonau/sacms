import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { redirect, notFound } from "next/navigation"
import { ContentEntriesManager } from "@/components/cms/content-entries-manager"

export default async function CMSContentTypeEntriesPage({ 
  params 
}: { 
  params: Promise<{ tenant: string; slug: string }> 
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant: tenantSlug, slug: contentTypeSlug } = await params

  const access = await getTenantAccess(session, tenantSlug)
  if (!access) redirect("/dashboard")

  const tenantDb = await getTenantDb(tenantSlug)

  const contentType = await tenantDb.contentType.findFirst({
    where: { 
      slug: contentTypeSlug,
      OR: [
        { tenantId: access.tenantId },
        { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } },
        ...(access.isGlobal ? [{ tenantId: null }] : [])
      ]
    },
    include: { schemaFields: { orderBy: { order: 'asc' } } },
  })

  if (!contentType) notFound()
  
  const mappedContentType = {
    ...contentType,
    fields: contentType.schemaFields.map(f => {
      let parsedOptions = f.options
      if (typeof f.options === 'string') {
        try { parsedOptions = JSON.parse(f.options) } catch { parsedOptions = {} }
      }
      return { ...f, options: parsedOptions || {} }
    })
  }

  // Fetch entries (default to first 100 or so for simplicity, matching the old UI that filtered in memory)
  const entries = await tenantDb.contentEntry.findMany({
    where: {
      contentTypeId: contentType.id,
      tenantId: access.tenantId,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  // Parse JSON data robustly as done previously
  const parsedEntries = entries.map((e) => {
    let parsedData = e.data
    if (typeof e.data === 'string') {
      try { parsedData = JSON.parse(e.data) } catch (err) { parsedData = {} }
    }
    return {
      ...e,
      data: parsedData,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
      publishedAt: e.publishedAt ? e.publishedAt.toISOString() : null,
      scheduledAt: e.scheduledAt ? e.scheduledAt.toISOString() : null,
    }
  })

  // Batch fetch human-readable labels for relations
  const { batchFetchRelationLabels } = await import("@/lib/relation-labels")
  const relationLabels = await batchFetchRelationLabels(
    tenantDb,
    access.tenantId,
    parsedEntries,
    mappedContentType.fields
  )

  // Load schemas of all related content types for column configurator
  const relationSlugs = Array.from(
    new Set(
      mappedContentType.fields
        .filter((f) => f.type === "relation" || f.relationSlug)
        .map((f) => f.relationSlug || (f.options as any)?.targetSlug)
        .filter(Boolean)
    )
  ) as string[]

  let relatedSchemas: Record<string, { name: string; slug: string; fields: any[] }> = {}
  if (relationSlugs.length > 0) {
    const relatedTypes = await tenantDb.contentType.findMany({
      where: {
        slug: { in: relationSlugs },
        OR: [
          { tenantId: access.tenantId },
          { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } },
          ...(access.isGlobal ? [{ tenantId: null }] : [])
        ]
      },
      include: { schemaFields: { orderBy: { order: "asc" } } }
    })

    for (const rt of relatedTypes) {
      relatedSchemas[rt.slug] = {
        name: rt.name,
        slug: rt.slug,
        fields: rt.schemaFields.map((f) => ({
          id: f.id,
          name: f.name,
          slug: f.slug,
          type: f.type,
          required: f.required
        }))
      }
    }
  }

  // Enforce plan limits for content entries
  const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
  const enforcement = await enforcePlanLimit(access.tenantId, "content_entries", session.user.id)
  const isLimitReached = !enforcement.allowed
  const limit = enforcement.max
  const currentCount = enforcement.current

  return (
    <ContentEntriesManager 
      contentType={mappedContentType}
      initialEntries={parsedEntries}
      initialRelationLabels={relationLabels}
      relatedSchemas={relatedSchemas}
      tenantSlug={tenantSlug}
      contentTypeSlug={contentTypeSlug}
      isLimitReached={isLimitReached}
      limit={limit}
      currentCount={currentCount}
      userRole={access.role}
      customPermissions={null}
    />
  )
}

