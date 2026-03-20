import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    // We want the GLOBAL pricing plans from the Super Admin
    // In this system, Super Admin plans are ContentEntries with contentType "platform-pricing"
    // and tenantId null (or a specific system tenant ID)
    
    const pricingContentType = await db.contentType.findUnique({
      where: { slug: "platform-pricing" }
    })

    if (!pricingContentType) {
      return NextResponse.json({ plans: [] })
    }

    const entries = await db.contentEntry.findMany({
      where: {
        contentTypeId: pricingContentType.id,
        status: "PUBLISHED",
        // Typically system content has tenantId null or is assigned to a specific admin tenant
      },
      orderBy: { createdAt: "asc" }
    })

    const plans = entries.map(entry => {
      let data = entry.data
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data)
        } catch (e) {
          data = {}
        }
      }
      
      const d = data as any
      return {
        id: d.id || entry.id,
        name: d.name || "Unnamed Plan",
        type: d.type || "plan",
        price: Number(d.price) || 0,
        features: typeof d.features === 'string' 
          ? d.features.split(',').map((f: string) => f.trim())
          : (Array.isArray(d.features) ? d.features : []),
        popular: !!d.is_popular,
        buttonText: d.buttonText || "Get Started"
      }
    })

    return NextResponse.json({ plans })
  } catch (error) {
    console.error("Error fetching pricing plans:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
