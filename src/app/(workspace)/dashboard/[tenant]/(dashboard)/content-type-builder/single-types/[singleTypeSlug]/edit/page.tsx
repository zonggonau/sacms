import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import EditSingleTypeClient from "./edit-single-type-client"
import { getSingleTypeBySlugAction } from "@/actions/single-types"

export default async function EditSingleTypePage({
  params,
}: {
  params: Promise<{ tenant: string; singleTypeSlug: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect("/login")
  }

  const resolvedParams = await params
  const tenantSlug = resolvedParams.tenant
  const singleTypeSlug = resolvedParams.singleTypeSlug

  let initialSingleType: any = null
  let initialFields: any[] = []

  try {
    const response = await getSingleTypeBySlugAction(tenantSlug, singleTypeSlug)
    if (response.singleType) {
      initialSingleType = response.singleType
      
      initialFields = (response.singleType.fields || []).map((f: any) => {
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
    console.error("Failed to fetch single type for edit:", error)
  }

  return (
    <EditSingleTypeClient
      tenantSlug={tenantSlug}
      singleTypeSlug={singleTypeSlug}
      initialSingleType={initialSingleType}
      initialFields={initialFields}
    />
  )
}
