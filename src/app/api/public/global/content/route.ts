import { NextResponse } from "next/server"
import { db } from "@/lib/database"

export async function GET() {
  try {
    // Platform-level content lives entirely at tenantId: null — see
    // getLandingData() in src/lib/public-api.ts, which reads the same place.
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

    // Ambil Content Types / Collections global (tanpa tenant)
    const contentTypes = await db.contentType.findMany({
      where: { tenantId: null }
    })

    const contentEntries = await db.contentEntry.findMany({
      where: { tenantId: null, status: "PUBLISHED", deletedAt: null }
    })

    const collectionsData = contentTypes.reduce((acc, ct) => {
      const entries = contentEntries.filter(e => e.contentTypeId === ct.id).map(e => e.data)
      acc[ct.slug] = entries
      return acc
    }, {} as Record<string, any>)

    return NextResponse.json({
      success: true,
      data: {
        singleTypes: singleTypesData,
        collections: collectionsData
      }
    })
  } catch (error) {
    console.error("Failed to fetch global content", error)
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 })
  }
}
