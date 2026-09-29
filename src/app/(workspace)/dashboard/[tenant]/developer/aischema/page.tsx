import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { SchemaGeneratorClient } from "./schema-generator-client"

export default async function SchemaGeneratorPage({ params }: { params: Promise<{ tenant: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant: tenantSlug } = await params

  const access = await getTenantAccess(session, tenantSlug)
  if (!access) redirect("/dashboard")

  const tenant = access.tenant

  // Schema-gate: does the tenant already have a real (non-default) CMS
  // schema? Drives the small "sudah ada N struktur" banner in SchemaStep.
  let hasSchema = false
  let existingSchemaSummary: {
    contentTypes: Array<{ name: string; slug: string; fieldCount: number }>
    singleTypes: Array<{ name: string; slug: string; fieldCount: number }>
  } = { contentTypes: [], singleTypes: [] }
  try {
    const tenantDb = await getTenantDb(tenant.id)
    const [contentTypesRaw, singleTypesRaw] = await Promise.all([
      tenantDb.contentType.findMany({ where: { tenantId: tenant.id }, include: { schemaFields: true } }),
      tenantDb.singleType.findMany({ where: { tenantId: tenant.id }, include: { schemaFields: true } }),
    ])
    const isOnlyDefaultBoilerplate =
      contentTypesRaw.length > 0 &&
      singleTypesRaw.length === 0 &&
      contentTypesRaw.every((ct) => ct.slug === "services" || ct.slug === "articles")
    hasSchema = (contentTypesRaw.length > 0 || singleTypesRaw.length > 0) && !isOnlyDefaultBoilerplate
    existingSchemaSummary = {
      contentTypes: contentTypesRaw.map((ct) => ({ name: ct.name, slug: ct.slug, fieldCount: ct.schemaFields.length })),
      singleTypes: singleTypesRaw.map((st) => ({ name: st.name, slug: st.slug, fieldCount: st.schemaFields.length })),
    }
  } catch {
    // Non-critical — the client just starts from the empty-state prompt.
  }

  return (
    <div className="flex h-screen max-h-screen flex-col p-3 md:p-4 overflow-auto w-full max-w-full">
      <SchemaGeneratorClient
        tenantSlug={tenantSlug}
        hasSchema={hasSchema}
        existingSchemaSummary={existingSchemaSummary}
      />
    </div>
  )
}
