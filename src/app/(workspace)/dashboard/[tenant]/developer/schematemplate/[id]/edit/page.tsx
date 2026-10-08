import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { db, getTenantDb } from "@/lib/database"
import { SchemaTemplateEditClient } from "./schema-template-edit-client"

export default async function SchemaTemplateEditPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant: tenantSlug, id } = await params
  const access = await getTenantAccess(session, tenantSlug)
  if (!access) redirect("/dashboard")
  if (!access.isGlobal) redirect(`/dashboard/${tenantSlug}/developer/aischema`)

  const template = await db.schemaTemplate.findUnique({ where: { id } })
  if (!template) notFound()

  const tenantDb = await getTenantDb(access.tenant.slug)
  const where = { tenantId: access.tenant.id, draftTemplateId: id }
  const [contentTypes, singleTypes, components] = await Promise.all([
    tenantDb.contentType.findMany({ where, select: { slug: true, name: true } }),
    tenantDb.singleType.findMany({ where, select: { slug: true, name: true } }),
    tenantDb.component.findMany({ where, select: { slug: true, name: true } }),
  ])

  return (
    <SchemaTemplateEditClient
      tenantSlug={tenantSlug}
      template={{
        id: template.id,
        name: template.name,
        category: template.category,
        icon: template.icon,
        description: template.description,
        published: template.published,
      }}
      isMaterialized={contentTypes.length > 0 || singleTypes.length > 0 || components.length > 0}
      draftContentTypes={contentTypes}
      draftSingleTypes={singleTypes}
      draftComponents={components}
    />
  )
}
