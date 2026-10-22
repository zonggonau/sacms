import { NextRequest, NextResponse } from "next/server"
import { getAccountPlans, getWorkspacePlans } from "@/lib/pricing"

/**
 * Truly Global Plans API - /api/public/plans
 * Returns formatted pricing tiers for both Workspaces and Accounts.
 * No tenant context required.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "workspace" // workspace or account

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

    const tablePlans = type === "account" ? await getAccountPlans() : await getWorkspacePlans()
    const dynamicPlans = tablePlans.map(p => ({
      id: p.slug,
      name: p.name || "Unnamed Plan",
      description: p.description || "",
      price: p.price,
      interval: "bulan",
      features: Array.isArray(p.features) ? p.features : [],
      isPopular: "isPopular" in p ? !!p.isPopular : false,
      cta: "ctaText" in p ? (p.ctaText || "Get Started") : "Get Started"
    }))

    // Merge and deduplicate (favoring table entries over static free plan if IDs match)
    const dynamicIds = new Set(dynamicPlans.map(p => p.id))
    plans = [...plans.filter(p => !dynamicIds.has(p.id)), ...dynamicPlans]

    // Sort by price
    plans.sort((a, b) => a.price - b.price)

    return NextResponse.json({ plans })
  } catch (error) {
    console.error("Global Plans API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
