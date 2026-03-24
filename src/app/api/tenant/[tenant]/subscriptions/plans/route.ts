import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    // 1. Fetch Noken Pricing (Main Workspace Plans)
    const pricingContentType = await db.contentType.findUnique({
      where: { slug: "noken-pricing" }
    })

    // 2. Fetch Noken Addons
    const addonContentType = await db.contentType.findUnique({
      where: { slug: "noken-addons" }
    })

    let plans: any[] = []

    if (pricingContentType) {
      const pricingEntries = await db.contentEntry.findMany({
        where: {
          contentTypeId: pricingContentType.id,
          status: "PUBLISHED",
        },
        orderBy: { createdAt: "asc" }
      })

      const pricingPlans = pricingEntries.map(entry => {
        const d = (typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data) as any
        
        // Clean price string like "499.000" into a number
        let rawPrice = d.price || "0"
        let numericPrice = 0
        if (typeof rawPrice === 'string') {
          numericPrice = parseInt(rawPrice.replace(/\./g, ''), 10)
        } else {
          numericPrice = Number(rawPrice)
        }

        const parseFeatures = (val: any) => {
          if (Array.isArray(val)) return val
          if (typeof val === 'string' && val.trim().length > 0) {
            // Try parsing if it's a stringified JSON array
            if (val.startsWith('[') && val.endsWith(']')) {
              try {
                const parsed = JSON.parse(val)
                if (Array.isArray(parsed)) return parsed
              } catch (e) {}
            }
            // Fallback to comma separation
            return val.split(',').map(s => s.trim())
          }
          return []
        }

        return {
          id: d.plan_slug || entry.id,
          name: d.name || "Unnamed Plan",
          type: "workspace", // Required by frontend filter
          price: numericPrice,
          features: parseFeatures(d.features_list),
          popular: !!d.is_popular,
          buttonText: d.button_text || "Get Started",
          // Advanced limitation fields
          maxContentTypes: d.max_content_types,
          maxContentEntries: d.max_content_entries,
          maxTeamMembers: d.max_team_members,
          maxApiCalls: d.max_api_calls,
          maxStorage: d.max_storage,
          maxLocales: d.max_locales,
          auditLogRetention: d.audit_log_retention,
          supportLevel: d.support_level
        }
      })
      plans = [...plans, ...pricingPlans]
    }

    if (addonContentType) {
      const addonEntries = await db.contentEntry.findMany({
        where: {
          contentTypeId: addonContentType.id,
          status: "PUBLISHED",
        },
        orderBy: { createdAt: "asc" }
      })

      const addonPlans = addonEntries.map(entry => {
        const d = (typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data) as any
        
        // Parse price label like "Mulai 199rb/bln" or "99rb/bln"
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
          type: "addons", // Required by frontend filter
          price: numericPrice,
          // Addons don't have features_list in schema yet, so use description
          features: [d.description || "Feature upgrade"],
          popular: false,
          buttonText: "Activate"
        }
      })
      plans = [...plans, ...addonPlans]
    }

    return NextResponse.json({ plans })
  } catch (error) {
    console.error("Error fetching pricing plans:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
