import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { getGlobalWorkspaceId } from "@/lib/settings"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant } = await context.params
    const isAccount = tenant === "account"

    // 1. Fetch Pricing Content Type
    const pricingContentType = await db.contentType.findFirst({
      where: { 
        slug: isAccount ? "sacms-account-pricing" : "sacms-workspace-pricing",
        tenantId: null 
      }
    })

    // 2. Fetch SaCMS Addons
    const addonContentType = await db.contentType.findFirst({
      where: { slug: "sacms-addons", tenantId: null }
    })

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

    const cleanPrice = (val: any) => {
      if (typeof val === 'number') return val
      if (typeof val === 'string') return parseInt(val.replace(/[^\d]/g, ''), 10) || 0
      return 0
    }

    if (pricingContentType) {
      const globalTenantId = await getGlobalWorkspaceId();
      const pricingEntries = await db.contentEntry.findMany({
        where: {
          contentTypeId: pricingContentType.id,
          status: "PUBLISHED",
          tenantId: globalTenantId
        },
        orderBy: { createdAt: "asc" }
      })

      const pricingPlans = pricingEntries.map(entry => {
        const d = (typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data) as any
        
        const numericPrice = cleanPrice(d.price)

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
          description: d.description || "",
          type: "workspace",
          price: numericPrice,
          yearlyPrice: yearlyPrice,
          features: parseFeatures(d.features),
          popular: d.is_popular === true || d.popular === true || d.plan_slug === "pro",
          buttonText: d.cta_text || "Pilih Paket",
          maxContentTypes: parseInt(d.max_content_types, 10) || 0,
          maxContentEntries: parseInt(d.max_content_entries, 10) || 0,
          maxTeamMembers: parseInt(d.max_team_members, 10) || 0,
          maxApiCalls: parseInt(d.max_api_calls, 10) || 0,
          maxStorage: parseInt(d.max_storage, 10) || 0,
          maxLocales: parseInt(d.max_locales, 10) || 0,
          auditLogRetention: 0,
          supportLevel: d.plan_slug === "enterprise" ? "Prioritas & SLA" : d.plan_slug === "pro" ? "Prioritas" : "Email"
        }
      })

      const PLAN_ORDER: Record<string, number> = { free: 1, starter: 2, pro: 3, enterprise: 4 }
      pricingPlans.sort((a, b) => (PLAN_ORDER[a.id] || 99) - (PLAN_ORDER[b.id] || 99) || a.price - b.price)

      const newPlanIds = new Set(pricingPlans.map(p => p.id))
      plans = [...plans.filter(p => !newPlanIds.has(p.id)), ...pricingPlans]
      plans.sort((a, b) => (PLAN_ORDER[a.id] || 99) - (PLAN_ORDER[b.id] || 99) || a.price - b.price)
    }

    // Default Built-in One-Time Top-up Packs
    const defaultTopups = [
      {
        id: "topup_ai_500k",
        name: "AI Booster (500K Tokens)",
        type: "addons",
        price: 25000,
        features: ["+500.000 Extra AI Tokens", "No expiration date", "Works with all AI Writers & Generators"],
        popular: true,
        buttonText: "Top Up Now",
        icon: "Bot",
        isTopup: true,
        quotaType: "ai_tokens",
        amountUnits: 500000
      },
      {
        id: "topup_ai_2m",
        name: "AI Power Pack (2M Tokens)",
        type: "addons",
        price: 75000,
        features: ["+2.000.000 Extra AI Tokens", "Best value for content teams", "Priority generation speed"],
        popular: false,
        buttonText: "Top Up Now",
        icon: "Zap",
        isTopup: true,
        quotaType: "ai_tokens",
        amountUnits: 2000000
      },
      {
        id: "topup_storage_10gb",
        name: "Extra Storage (10 GB)",
        type: "addons",
        price: 35000,
        features: ["+10 GB Cloudflare R2 Storage", "Permanent storage boost", "Instant activation"],
        popular: false,
        buttonText: "Top Up Now",
        icon: "HardDrive",
        isTopup: true,
        quotaType: "storage",
        amountUnits: 10 * 1024 * 1024 * 1024
      },
      {
        id: "topup_api_500k",
        name: "Extra API Quota (500K Calls)",
        type: "addons",
        price: 30000,
        features: ["+500.000 API Requests", "Burst traffic support", "No throttle guarantee"],
        popular: false,
        buttonText: "Top Up Now",
        icon: "Database",
        isTopup: true,
        quotaType: "api_calls",
        amountUnits: 500000
      }
    ]

    let addonPlans: any[] = [...defaultTopups]

    if (addonContentType) {
      const globalTenantId = await getGlobalWorkspaceId();
      const addonEntries = await db.contentEntry.findMany({
        where: {
          contentTypeId: addonContentType.id,
          status: "PUBLISHED",
          tenantId: globalTenantId
        },
        orderBy: { createdAt: "asc" }
      })

      const customAddons = addonEntries.map(entry => {
        const d = (typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data) as any
        const numericPrice = cleanPrice(d.price)
        const isTopup = d.is_topup === true || d.is_topup === "true" || d.unit === "once"

        return {
          id: d.addon_slug || entry.id,
          name: d.name || "Unnamed Addon",
          type: "addons",
          price: numericPrice,
          priceLabel: d.price_label || "",
          features: d.description ? [d.description] : (Array.isArray(d.features) ? d.features : ["Feature upgrade"]),
          popular: false,
          buttonText: d.price_label ? (numericPrice === 0 ? "Included" : "Activate") : (isTopup ? "Top Up Now" : "Activate"),
          icon: d.icon || "Package",
          isTopup: isTopup
        }
      })
      if (customAddons.length > 0) {
        addonPlans = [...customAddons, ...defaultTopups]
      }
    }

    const newAddonIds = new Set(addonPlans.map(p => p.id))
    plans = [...plans.filter(p => !newAddonIds.has(p.id)), ...addonPlans]

    return NextResponse.json({ plans })
  } catch (error) {
    console.error("Error fetching pricing plans:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
