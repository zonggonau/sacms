import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import EditContentTypeClient from "./edit-content-type-client"
import { getAdminContentTypeBySlugAction } from "@/actions/admin-content-types"

export default async function EditContentTypePage({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect("/login")
  }

  const resolvedParams = await params
  const tenantSlug = resolvedParams.tenant
  const contentTypeSlug = resolvedParams.slug

  let initialContentType = null
  let initialFields = []

  try {
    const response = await getAdminContentTypeBySlugAction(contentTypeSlug)
    if (response.contentType) {
      initialContentType = response.contentType
      
      initialFields = (response.contentType.fields || []).map((f: any) => {
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
    console.error("Failed to fetch content type for edit:", error)
  }

  return (
    <EditContentTypeClient
      tenantSlug={tenantSlug}
      contentTypeSlug={contentTypeSlug}
      initialContentType={initialContentType}
      initialFields={initialFields}
    />
  )
}
