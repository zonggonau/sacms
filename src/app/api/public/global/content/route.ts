import { NextResponse } from "next/server"
import { db } from "@/lib/database"

export async function GET() {
  try {
    const workspaceId = process.env.WORKSPACE_ID || "sacms-global";

    // Ambil Single Types global (tanpa tenant)
    const singleTypes = await db.singleType.findMany({
      where: { tenantId: null },
      include: {
        tenants: {
          where: { tenantId: workspaceId }
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
      where: { tenantId: workspaceId }
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
