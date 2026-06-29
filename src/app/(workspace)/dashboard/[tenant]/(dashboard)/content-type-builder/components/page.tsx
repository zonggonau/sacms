import { getComponentsAction } from "@/actions/components"
import { ComponentsClient } from "./components-client"
import { redirect } from "next/navigation"
import { enforcePlanLimit } from "@/lib/plan-enforcement"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"

export default async function ComponentsPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params

  const session = await getServerSession(authOptions)
  const access = session ? await getTenantAccess(session, tenant) : null

  const response = await getComponentsAction(tenant)

  if (response.error) {
    if (response.error === "Unauthorized") redirect("/login")
    return (
      <div className="flex-1 min-h-screen flex items-center justify-center flex-col w-full">
        <p className="text-destructive font-bold">{response.error}</p>
      </div>
    )
  }

  // Get plan limit for content types
  let maxLimit = 3
  let currentUsageCount = 0
  if (access) {
    const enforcement = await enforcePlanLimit(access.tenantId, "content_types")
    maxLimit = enforcement.max
    currentUsageCount = enforcement.current
  }

  return (
    <ComponentsClient 
      initialComponents={response.components || []} 
      tenantSlug={tenant} 
      limit={maxLimit}
      current={currentUsageCount}
    />
  )
}
