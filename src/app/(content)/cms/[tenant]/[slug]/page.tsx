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
        { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } }
      ]
    },
    include: { fields: true },
  })

  if (!contentType) notFound()

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

  return (
    <ContentEntriesManager 
      contentType={contentType}
      initialEntries={parsedEntries}
      tenantSlug={tenantSlug}
      contentTypeSlug={contentTypeSlug}
    />
  )
}
