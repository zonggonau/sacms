import { getContentTypesAction } from "@/actions/content-types"
import { ContentTypesClient } from "./content-types-client"
import { Database } from "lucide-react"
import { enforcePlanLimit } from "@/lib/plan-enforcement"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"

export default async function ContentTypesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params
  
  const session = await getServerSession(authOptions)
  const access = session ? await getTenantAccess(session, tenant) : null
  
  const contentTypesData = await getContentTypesAction(tenant)
  
  if (contentTypesData.error) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Database className="h-12 w-12 mx-auto mb-4 opacity-20 text-destructive" />
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-muted-foreground">{contentTypesData.error}</p>
        </div>
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

  const initialContentTypes = (contentTypesData.contentTypes || []).map(c => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }))

  return (
    <ContentTypesClient 
      initialContentTypes={initialContentTypes as any} 
      tenantSlug={tenant} 
      limit={maxLimit}
      current={currentUsageCount}
    />
  )
}
