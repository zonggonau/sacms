import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import ContentTypeEntriesClient from "./content-type-entries-client"
import { getContentTypeBySlugAction } from "@/actions/content-types"
import { getEntriesAction } from "@/actions/content"

export default async function ContentTypeEntriesPage({ 
  params 
}: { 
  params: { tenant: string, slug: string } 
}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect("/login")
  }

  const tenantSlug = params.tenant
  const contentTypeSlug = params.slug

  let initialContentType = null
  let initialEntries = []

  try {
    const ctRes = await getContentTypeBySlugAction(tenantSlug, contentTypeSlug)
    if (ctRes.contentType) {
      initialContentType = ctRes.contentType
    }

    const entriesRes = await getEntriesAction(tenantSlug, contentTypeSlug, { 
      page: 1, 
      pageSize: 50, 
      search: "" 
    })
    
    if (entriesRes.entries) {
      initialEntries = entriesRes.entries.map((e: any) => ({
        ...e,
        data: typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      }))
    }
  } catch (error) {
    console.error("Error fetching content type entries:", error)
  }

  return (
    <ContentTypeEntriesClient
      tenantSlug={tenantSlug}
      contentTypeSlug={contentTypeSlug}
      initialContentType={initialContentType}
      initialEntries={initialEntries}
    />
  )
}
