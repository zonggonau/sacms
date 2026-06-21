import { getAdminComponentsAction } from "@/actions/admin-components"
import { AdminComponentsClient } from "./admin-components-client"
import { Database } from "lucide-react"

export default async function AdminComponentsPage() {
  const componentsData = await getAdminComponentsAction()
  
  if (componentsData.error) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Database className="h-12 w-12 mx-auto mb-4 opacity-20 text-destructive" />
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-muted-foreground">{componentsData.error}</p>
        </div>
      </div>
    )
  }

  const initialComponents = (componentsData.components || []).map(c => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }))

  return (
    <AdminComponentsClient 
      initialComponents={initialComponents as any} 
    />
  )
}
