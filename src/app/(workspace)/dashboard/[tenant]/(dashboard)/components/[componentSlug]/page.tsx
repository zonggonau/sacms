import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import EditComponentClient from "./edit/edit-component-client"
import { getComponentBySlugAction } from "@/actions/components"

export default async function ComponentDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; componentSlug: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect("/login")
  }

  const resolvedParams = await params
  const tenantSlug = resolvedParams.tenant
  const componentSlug = resolvedParams.componentSlug

  let initialComponent: any = null
  let initialFields: any[] = []

  try {
    const response = await getComponentBySlugAction(tenantSlug, componentSlug)
    if (response.component) {
      initialComponent = response.component
      
      initialFields = (response.component.fields || []).map((f: any) => {
        let extra: any = {
          relationType: "",
          targetModel: "",
          targetSlug: "",
          componentSlug: "",
          repeatable: false,
          autoGenerate: false,
          sourceField: "",
        }
        if (f.options) {
          try {
            const opts = typeof f.options === "string" ? JSON.parse(f.options) : f.options
            if (f.type === "relation") {
              extra.relationType = opts.relationType || ""
              extra.targetModel = opts.targetModel || ""
              extra.targetSlug = opts.targetSlug || f.relationSlug || ""
            } else if (f.type === "component") {
              extra.componentSlug = opts.componentSlug || ""
              extra.repeatable = opts.repeatable || false
            } else if (f.type === "slug") {
              extra.autoGenerate = opts.autoGenerate || false
              extra.sourceField = opts.sourceField || ""
            }
          } catch {}
        }
        return { ...f, ...extra }
      })
    }
  } catch (error) {
    console.error("Failed to fetch component for detail page:", error)
  }

  return (
    <EditComponentClient
      tenantSlug={tenantSlug}
      componentSlug={componentSlug}
      initialComponent={initialComponent}
      initialFields={initialFields}
    />
  )
}
