import { getSingleTypesAction } from "@/actions/single-types"
import { SingleTypesClient } from "./single-types-client"
import { Database } from "lucide-react"

export default async function SingleTypesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params
  
  const singleTypesData = await getSingleTypesAction(tenant)
  
  if (singleTypesData.error) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Database className="h-12 w-12 mx-auto mb-4 opacity-20 text-destructive" />
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-muted-foreground">{singleTypesData.error}</p>
        </div>
      </div>
    )
  }

  const initialSingleTypes = (singleTypesData.singleTypes || []).map(c => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    publishedAt: c.publishedAt ? c.publishedAt.toISOString() : null,
  }))

  return <SingleTypesClient initialSingleTypes={initialSingleTypes as any} tenantSlug={tenant} />
}
