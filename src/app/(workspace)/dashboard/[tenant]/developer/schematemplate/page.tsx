import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { SchemaTemplateClient } from "./schema-template-client"

// Schema Template authoring is restricted to the SaCMS Global workspace —
// gated purely via access.isGlobal (getTenantAccess() -> getGlobalWorkspaceId(),
// the admin-configurable `globalTenantId` platform setting). No hardcoded
// workspace id anywhere, so this keeps working if the Global workspace is
// ever recreated or the setting repointed.
export default async function SchemaTemplatePage({ params }: { params: Promise<{ tenant: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant: tenantSlug } = await params
  const access = await getTenantAccess(session, tenantSlug)
  if (!access) redirect("/dashboard")

  if (!access.isGlobal) {
    redirect(`/dashboard/${tenantSlug}/developer/aischema`)
  }

  return <SchemaTemplateClient tenantSlug={tenantSlug} />
}
