import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant } = await params
    const isAccount = tenant === "account"

    // 1. Fetch Pricing Content Type
    const pricingContentType = await db.contentType.findFirst({
      where: { slug: isAccount ? "sacms-account-pricing" : "sacms-workspace-pricing" }
    })
    console.log("Pricing Content Type:", pricingContentType?.id);

    // 2. Fetch SaCMS Addons
    const addonContentType = await db.contentType.findFirst({
      where: { slug: "sacms-addons" }
    })
    console.log("Addon Content Type:", addonContentType?.id);

    let plans: any[] = []

    // 0. Add Free Plan (Base)
    plans.push({
      id: "free",
      name: "Free Forever",
      type: "workspace",
      price: 0,
      yearlyPrice: 0,
      features: ["3 Content Schemas", "100 Content Entries", "3 Team Members", "10.000 API Calls"],
      popular: false,
      buttonText: "Current Plan",
      maxContentTypes: 3,
      maxContentEntries: 100,
      maxTeamMembers: 3,
      maxApiCalls: 10000,
      maxStorage: 100,
      maxLocales: 1,
      auditLogRetention: 0,
      supportLevel: "Community"
    })

    if (pricingContentType) {
      const pricingEntries = await db.contentEntry.findMany({
        where: {
          contentTypeId: pricingContentType.id,
          status: "PUBLISHED"
        },
        orderBy: { createdAt: "asc" }
      })
      console.log(`Found ${pricingEntries.length} pricing entries`);

      const pricingPlans = pricingEntries.map(entry => {
        const d = (typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data) as any
        
        // Clean price string like "499.000" into a number
        let rawPrice = d.price || "0"
        let numericPrice = 0
        if (typeof rawPrice === 'string') {
          numericPrice = parseInt(rawPrice.replace(/[^\d]/g, ''), 10) || 0
        } else {
          numericPrice = Number(rawPrice) || 0
        }

        const parseFeatures = (val: any) => {
          if (Array.isArray(val)) return val
          if (typeof val === 'string' && val.trim().length > 0) {
            if (val.startsWith('[') && val.endsWith(']')) {
              try {
                const parsed = JSON.parse(val)
                if (Array.isArray(parsed)) return parsed
              } catch (e) {}
            }
            return val.split(',').map(s => s.trim())
          }
          return []
        }

        let yearlyPrice = 0
        if (d.yearly_price !== undefined) {
          if (typeof d.yearly_price === 'string') {
            yearlyPrice = parseInt(d.yearly_price.replace(/[^\d]/g, ''), 10) || 0
          } else {
            yearlyPrice = Number(d.yearly_price) || 0
          }
        } else {
          yearlyPrice = numericPrice * 10
        }

        return {
          id: d.plan_slug || entry.id,
          name: d.name || "Unnamed Plan",
          type: "workspace",
          price: numericPrice,
          yearlyPrice: yearlyPrice,
          features: parseFeatures(d.features),
          popular: false,
          buttonText: "Get Started",
          maxContentTypes: parseInt(d.max_content_types, 10) || 0,
          maxContentEntries: parseInt(d.max_content_entries, 10) || 0,
          maxTeamMembers: parseInt(d.max_team_members, 10) || 0,
          maxApiCalls: parseInt(d.max_api_calls, 10) || 0,
          maxStorage: parseInt(d.max_storage, 10) || 0,
          maxLocales: parseInt(d.max_locales, 10) || 0,
          auditLogRetention: 0,
          supportLevel: "Email"
        }
      })
      const newPlanIds = new Set(pricingPlans.map(p => p.id))
      plans = [...plans.filter(p => !newPlanIds.has(p.id)), ...pricingPlans]
    }

    if (addonContentType) {
      const addonEntries = await db.contentEntry.findMany({
        where: {
          contentTypeId: addonContentType.id,
          status: "PUBLISHED"
        },
        orderBy: { createdAt: "asc" }
      })

      const addonPlans = addonEntries.map(entry => {
        const d = (typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data) as any
        
        let numericPrice = 0
        if (d.price_label) {
          const match = d.price_label.match(/(\d+)/)
          if (match) {
            numericPrice = parseInt(match[0], 10) * 1000
          }
        }

        return {
          id: d.addon_slug || entry.id,
          name: d.title || "Unnamed Addon",
          type: "addons",
          price: numericPrice,
          features: [d.description || "Feature upgrade"],
          popular: false,
          buttonText: "Activate"
        }
      })
      const newAddonIds = new Set(addonPlans.map(p => p.id))
      plans = [...plans.filter(p => !newAddonIds.has(p.id)), ...addonPlans]
    }

    return NextResponse.json({ plans })
  } catch (error) {
    console.error("Error fetching pricing plans:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
