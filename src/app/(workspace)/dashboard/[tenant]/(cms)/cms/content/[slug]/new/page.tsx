import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { redirect, notFound } from "next/navigation"
import { parseSchemaFieldOptions } from "@/actions/content-pipeline"
import { getStudioLocales } from "@/lib/content/studio-locales"
import CMSCreateEntryClient from "./create-entry-client"

export default async function CMSCreateEntryPage({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant: tenantSlug, slug: contentTypeSlug } = await params
  const access = await getTenantAccess(session, tenantSlug)
  if (!access) redirect("/dashboard")

  const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_CREATE)
  if (!rbac.allowed) redirect(`/dashboard/${tenantSlug}/cms/content/${contentTypeSlug}`)

  const tenantDb = await getTenantDb(tenantSlug)

  const contentType = await tenantDb.contentType.findFirst({
    where: {
      slug: contentTypeSlug,
      draftTemplateId: null,
      OR: [
        { tenantId: access.tenantId },
        { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } },
      ]
    },
    include: { schemaFields: { orderBy: { order: 'asc' } } },
  })

  if (!contentType) notFound()

  const formattedFields = parseSchemaFieldOptions(contentType.schemaFields)
  const mappedContentType = {
    ...contentType,
    fields: formattedFields
  }

  const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
  const [availableLocales, enforcement] = await Promise.all([
    getStudioLocales(access.tenantId),
    enforcePlanLimit(access.tenantId, "content_entries", session.user.id),
  ])
  const isLimitReached = !enforcement.allowed
  const entriesLimit = enforcement.max

  return (
    <CMSCreateEntryClient 
      tenantSlug={tenantSlug} 
      contentTypeSlug={contentTypeSlug} 
      initialContentType={mappedContentType as any}
      initialAvailableLocales={availableLocales}
      initialIsLimitReached={isLimitReached}
      initialEntriesLimit={entriesLimit}
      userRole={access.role}
      customPermissions={(access as any).customPermissions}
    />
  )
}
