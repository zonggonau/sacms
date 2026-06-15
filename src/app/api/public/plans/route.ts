import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"

/**
 * Truly Global Plans API - /api/public/plans
 * Returns formatted pricing tiers for both Workspaces and Accounts.
 * No tenant context required.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "workspace" // workspace or account

    const slug = type === "account" ? "sacms-account-pricing" : "sacms-workspace-pricing"

    // 1. Fetch Truly Global Content Type
    const contentType = await db.contentType.findFirst({
      where: { slug, tenantId: null }
    })

    let plans: any[] = []

    // Add Free Plan for workspaces if requested
    if (type === "workspace") {
      plans.push({
        id: "free",
        name: "Free Forever",
        description: "Basic workspace for personal projects.",
        price: 0,
        interval: "tahun",
        features: ["3 Content Schemas", "500 Content Entries", "1 Team Member", "1.000 API Calls/mo"],
        isPopular: false,
        cta: "Get Started"
      })
    }

    if (contentType) {
      const entries = await db.contentEntry.findMany({
        where: {
          contentTypeId: contentType.id,
          tenantId: null,
          status: "PUBLISHED"
        },
        orderBy: { createdAt: "asc" }
      })

      const dynamicPlans = entries.map(entry => {
        const d = (typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data) as any
        
        // Clean price
        let price = 0
        if (typeof d.price === 'string') {
          price = parseInt(d.price.replace(/[^\d]/g, ''), 10) || 0
        } else {
          price = Number(d.price) || 0
        }

        const features = Array.isArray(d.features) 
          ? d.features 
          : (typeof d.features === 'string' ? d.features.split(',').map((s: string) => s.trim()) : [])

        return {
          id: d.plan_slug || entry.id,
          name: d.name || "Unnamed Plan",
          description: d.description || "",
          price: price,
          interval: d.period === "month" ? "bulan" : "tahun",
          features: features,
          isPopular: !!d.is_popular,
          cta: d.cta_text || "Get Started"
        }
      })

      // Merge and deduplicate (favoring database entries over static free plan if IDs match)
      const dynamicIds = new Set(dynamicPlans.map(p => p.id))
      plans = [...plans.filter(p => !dynamicIds.has(p.id)), ...dynamicPlans]
    }

    // Sort by price
    plans.sort((a, b) => a.price - b.price)

    return NextResponse.json({ plans })
  } catch (error) {
    console.error("Global Plans API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
