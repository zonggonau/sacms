import { getContentTypesAction } from "@/actions/content-types"
import { ContentTypesClient } from "./content-types-client"
import { Database } from "lucide-react"

export default async function ContentTypesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params
  
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

  const initialContentTypes = (contentTypesData.contentTypes || []).map(c => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }))

  return <ContentTypesClient initialContentTypes={initialContentTypes as any} tenantSlug={tenant} />
}
