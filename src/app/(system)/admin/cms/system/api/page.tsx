import { db } from "@/lib/database"
import { ApiPageClient } from "./api-page-client"
import { headers } from "next/headers"

export default async function AdminCmsApiPage() {
  const headersList = await headers()
  const host = headersList.get("host") || "localhost:3000"
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https"
  const apiUrl = `${protocol}://${host}/api/public/global/content`

  // Ambil Single Types global
  const singleTypes = await db.singleType.findMany({
    where: { tenantId: null },
    include: {
      tenants: {
        where: { tenantId: null }
      }
    }
  })

  const singleTypesData = singleTypes.reduce((acc, st) => {
    const data = st.tenants[0]?.data || {}
    acc[st.slug] = data
    return acc
  }, {} as Record<string, any>)

  // Ambil Collections global
  const contentTypes = await db.contentType.findMany({
    where: { tenantId: null }
  })

  const contentEntries = await db.contentEntry.findMany({
    where: { tenantId: null }
  })

  const collectionsData = contentTypes.reduce((acc, ct) => {
    const entries = contentEntries.filter(e => e.contentTypeId === ct.id).map(e => e.data)
    acc[ct.slug] = entries
    return acc
  }, {} as Record<string, any>)

  const fullData = {
    singleTypes: singleTypesData,
    collections: collectionsData
  }

  return (
    <div className="p-8">
      <ApiPageClient initialData={fullData} apiUrl={apiUrl} />
    </div>
  )
}
