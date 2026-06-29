import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getTenantAccess } from "@/lib/tenant-access"
import NewComponentClient from "./new-component-client"

export default async function NewComponentPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect("/login")
  }

  const resolvedParams = await params
  const tenantSlug = resolvedParams.tenant

  const access = await getTenantAccess(session, tenantSlug)
  if (!access) {
    redirect("/dashboard")
  }

  const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
  const enforcement = await enforcePlanLimit(access.tenantId, "content_types", session.user.id)
  if (!enforcement.allowed) {
    redirect(`/dashboard/${tenantSlug}/components`)
  }

  return (
    <NewComponentClient tenantSlug={tenantSlug} />
  )
}
