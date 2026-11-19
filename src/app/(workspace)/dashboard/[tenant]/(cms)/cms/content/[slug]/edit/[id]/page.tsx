import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { redirect, notFound } from "next/navigation"
import { parseSchemaFieldOptions } from "@/actions/content-pipeline"
import { getStudioLocales } from "@/lib/content/studio-locales"
import CMSEditEntryClient from "./edit-entry-client"

export default async function CMSEditEntryPage({
  params,
}: {
  params: Promise<{ tenant: string; slug: string; id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant: tenantSlug, slug: contentTypeSlug, id: entryId } = await params
  const access = await getTenantAccess(session, tenantSlug)
  if (!access) redirect("/dashboard")

  const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
  if (!rbac.allowed) redirect(`/dashboard/${tenantSlug}/cms`)

  const tenantDb = await getTenantDb(tenantSlug)

  const contentType = await tenantDb.contentType.findFirst({
    where: {
      slug: contentTypeSlug,
      draftTemplateId: null,
      OR: [
        { tenantId: access.tenantId },
        { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } },
        ...(access.isGlobal ? [{ tenantId: null }] : [])
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

  const [entry, availableLocales, previewSetting] = await Promise.all([
    tenantDb.contentEntry.findFirst({
      where: {
        id: entryId,
        contentTypeId: contentType.id,
        tenantId: access.tenantId,
        deletedAt: null,
      },
    }),
    getStudioLocales(access.tenantId),
    db.setting.findUnique({
      where: { key: `${access.tenantId}_previewUrl` },
      select: { value: true },
    }),
  ])

  if (!entry) notFound()

  return (
    <CMSEditEntryClient 
      key={entry.id}
      tenantSlug={tenantSlug} 
      contentTypeSlug={contentTypeSlug} 
      entryId={entryId}
      initialEntry={entry}
      initialContentType={mappedContentType as any}
      initialAvailableLocales={availableLocales}
      previewUrl={previewSetting?.value}
      userRole={access.role}
      customPermissions={(access as any).customPermissions}
    />
  )
}
