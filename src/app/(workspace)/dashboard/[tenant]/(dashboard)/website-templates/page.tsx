import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { serializeTenantSchema } from "@/lib/schema-template-sync"
import { SITE_SETTINGS_SLUG } from "@/lib/content/site-settings-slug"
import { WebsiteTemplatesClient } from "./website-templates-client"

export default async function WebsiteTemplatesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant: tenantSlug } = await params
  const access = await getTenantAccess(session, tenantSlug)
  if (!access) redirect("/dashboard")

  // Same "empty" rule the apply route enforces: nothing but the site-settings single type.
  const schema = await serializeTenantSchema(await getTenantDb(tenantSlug), { tenantId: access.tenant.id }).catch(() => null)
  const isWorkspaceEmpty = !!schema && schema.contentTypes.length === 0 && schema.components.length === 0 &&
    schema.singleTypes.every(({ slug }) => slug === SITE_SETTINGS_SLUG)

  // Every plan buys templates one at a time, so the gallery always shows the purchase flow.
  const planAccess = "purchase" as const

  return (
    <WebsiteTemplatesClient
      tenantSlug={tenantSlug}
      currentRole={access.role}
      planAccess={planAccess}
      isWorkspaceEmpty={isWorkspaceEmpty}
    />
  )
}
