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
    const globalTenantId = await getGlobalWorkspaceId()

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

    const cleanPrice = (val: any) => {
      if (typeof val === 'number') return val
      if (typeof val === 'string') return parseInt(val.replace(/[^\d]/g, ''), 10) || 0
      return 0
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

    let workspacePlans: any[] = []

    // ─── LOAD WORKSPACE / ACCOUNT PLANS DYNAMICALLY FROM GLOBAL CMS ───
    if (pricingContentType) {
      const pricingEntries = await db.contentEntry.findMany({
        where: {
          contentTypeId: pricingContentType.id,
          status: "PUBLISHED",
          tenantId: globalTenantId
        },
        orderBy: { createdAt: "asc" }
      })

      if (pricingEntries.length > 0) {
        workspacePlans = pricingEntries.map(entry => {
          const d = (typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data) as any
          const numericPrice = cleanPrice(d.price)

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
            type: isAccount ? "account" : "workspace",
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
            auditLogRetention: parseInt(d.audit_log_retention, 10) || 0,
            supportLevel: d.support_level || (d.plan_slug === "enterprise" ? "Prioritas & SLA" : d.plan_slug === "pro" ? "Prioritas" : "Email")
          }
        })

        const PLAN_ORDER: Record<string, number> = {
          free: 1,
          pro: 2,
          business: 3,
          enterprise: 3,
        }
        workspacePlans.sort((a, b) => (PLAN_ORDER[a.id] || 99) - (PLAN_ORDER[b.id] || 99) || a.price - b.price)
      }
    }

    // Fallback ONLY when database has 0 published entries
    if (workspacePlans.length === 0) {
      if (isAccount) {
        workspacePlans = [
          {
            id: "account_free",
            name: "Free Account",
            type: "account",
            price: 0,
            yearlyPrice: 0,
            features: ["1 Workspace Included", "Full CMS Studio Access", "Community Support"],
            popular: false,
            buttonText: "Paket Dasar",
            maxWorkspaces: 1
          },
          {
            id: "account_starter",
            name: "Starter Account",
            type: "account",
            price: 199000,
            yearlyPrice: 1990000,
            features: ["Hingga 3 Workspace", "Akses API & Webhook", "Dukungan Email"],
            popular: false,
            buttonText: "Pilih Starter",
            maxWorkspaces: 3
          },
          {
            id: "account_pro",
            name: "Pro Account",
            type: "account",
            price: 499000,
            yearlyPrice: 4990000,
            features: ["Hingga 10 Workspace", "Dukungan Prioritas", "Akses Fitur Pro"],
            popular: true,
            buttonText: "Pilih Pro",
            maxWorkspaces: 10
          },
          {
            id: "account_enterprise",
            name: "Enterprise Account",
            type: "account",
            price: 1499000,
            yearlyPrice: 14990000,
            features: ["Hingga 20 Workspace", "Dedicated Account Manager", "SLA 99.9%"],
            popular: false,
            buttonText: "Pilih Enterprise",
            maxWorkspaces: 20
          }
        ]
      } else {
        workspacePlans = [
          {
            id: "free",
            name: "SaCMS Free Forever",
            description: "Akses lengkap studio CMS untuk eksplorasi dan pengembangan sandbox",
            type: "workspace",
            price: 0,
            yearlyPrice: 0,
            features: [
              "Unlimited Content Schemas & Tipe Data",
              "500 Entri Konten Dinamis",
              "1 Anggota Tim",
              "100 MB Object Storage",
              "1.000 API Calls / bulan",
              "50 AI Generation Credits",
              "Community Support"
            ],
            popular: false,
            buttonText: "Paket Saat Ini",
            maxContentTypes: 999999,
            maxContentEntries: 500,
            maxTeamMembers: 1,
            maxApiCalls: 1000,
            maxStorage: 100,
            maxLocales: 1,
            auditLogRetention: 0,
            supportLevel: "Community"
          },
          {
            id: "pro",
            name: "SaCMS Pro All-In-One",
            description: "Paket lengkap all-inclusive untuk bisnis, media, dan startup modern (Tanpa Biaya Tersembunyi)",
            type: "workspace",
            price: 249000,
            yearlyPrice: 1490000,
            features: [
              "10.000 Entri Konten & Unlimited Schemas",
              "10 Anggota Tim & Kolaborasi Multi-Role",
              "5 GB Cloud Storage Media Assets",
              "100.000 API Requests / bulan",
              "500 AI Credits Awal (Top-Up untuk build lanjutan)",
              "🌐 Cloud Edge Global Hosting SUDAH TERMASUK (Rp 0 Tambahan)",
              "🏷️ GRATIS 1 Domain Kustom (.com / .id) Selama 1 Tahun",
              "Sertifikat SSL HTTPS Otomatis & Global Anycast CDN",
              "Prioritas Support & 99.9% SLA"
            ],
            popular: true,
            buttonText: "Pilih Cloud Pro",
            maxContentTypes: 999999,
            maxContentEntries: 10000,
            maxTeamMembers: 10,
            maxApiCalls: 100000,
            maxStorage: 5120,
            maxLocales: 5,
            auditLogRetention: 30,
            supportLevel: "Prioritas & SLA 99.9%"
          },
        ]
      }
    }

    // ─── LOAD ADDONS: system topups + CMS overlay ───
    // These hardcoded ids are wired into real billing logic server-side
    // (checkout's BUILTIN_TOPUPS map, fulfillment, usage enforcement
    // upsell links like "Beli Storage Tambahan") — they must always be
    // resolvable here, same as checkout itself always recognizes them
    // regardless of what's published in the CMS. Replacing this whole
    // list with CMS entries whenever ANY were published used to make
    // every hardcoded topup vanish — including ones an admin never
    // touched in the CMS — the moment a single custom CMS addon went
    // live, breaking any page still linking to them by id (404/"plan not
    // found" at checkout). CMS entries now only add to or override this
    // list by addon_slug, never replace it wholesale.
    const SYSTEM_ADDONS: any[] = [
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
      // Storage tiers (5/10/20/50/100GB, 1TB) are deliberately NOT hardcoded
      // here — they're fully CMS-driven (sacms-addons entries with
      // quota_type: "storage", seeded by scripts/seed/seed-storage-addons.ts)
      // so sizes and prices can change without a deploy. If every such
      // entry is ever deleted, storage tiers simply disappear from the
      // catalogue — same behavior as emptying any other pricing content type.
      {
        id: "managed_byodb_setup",
        name: "Database & Storage Sendiri",
        type: "addons",
        price: 3500000,
        billingPeriod: "month",
        features: [
          "Setup Rp2.500.000 sekali + Rp1.000.000/bulan (bulan pertama termasuk)",
          "Server PostgreSQL & storage disiapkan tim IT SaCMS",
          "Disambungkan ke workspace ini, tanpa kuota storage SaCMS",
        ],
        popular: false,
        priceLabel: "Rp2.500.000 setup + Rp1.000.000/bulan",
        buttonText: "Pesan Layanan",
        icon: "Database",
        isTopup: true,
        quotaType: "managed_infra",
        amountUnits: 1
      },
      {
        // Bought from the workspace's service list ("Perpanjang"), not from the catalogue.
        id: "managed_byodb_monthly",
        name: "Database & Storage Sendiri — Perpanjangan 1 Bulan",
        type: "addons",
        price: 1000000,
        billingPeriod: "month",
        listed: false,
        features: ["Layanan database & storage sendiri diperpanjang 1 bulan"],
        popular: false,
        buttonText: "Perpanjang",
        icon: "Database",
        isTopup: true,
        quotaType: "managed_infra",
        amountUnits: 1
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

    const addonMap = new Map<string, any>(SYSTEM_ADDONS.map(a => [a.id, a]))

    if (addonContentType) {
      const addonEntries = await db.contentEntry.findMany({
        where: {
          contentTypeId: addonContentType.id,
          status: "PUBLISHED",
          tenantId: globalTenantId
        },
        orderBy: { createdAt: "asc" }
      })

      for (const entry of addonEntries) {
        const d = (typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data) as any
        const numericPrice = cleanPrice(d.price)
        const isTopup = d.is_topup === true || d.is_topup === "true" || d.unit === "once"
        const id = d.addon_slug || entry.id

        addonMap.set(id, {
          id,
          name: d.name || "Unnamed Addon",
          type: "addons",
          price: numericPrice,
          priceLabel: d.price_label || "",
          features: d.description ? [d.description] : (Array.isArray(d.features) ? d.features : ["Feature upgrade"]),
          popular: false,
          buttonText: d.price_label ? (numericPrice === 0 ? "Included" : "Activate") : (isTopup ? "Top Up Now" : "Activate"),
          icon: d.icon || "Package",
          isTopup: isTopup,
          // Carried through so quota-specific tabs/fulfillment (e.g. the
          // Storage tab, checkout's addon fulfillment) can recognize a
          // CMS-defined addon the same way they recognize a hardcoded one —
          // without this, a CMS-only entry (like the seeded storage tiers)
          // would silently fall outside any quota-aware behavior.
          ...(d.quota_type ? { quotaType: d.quota_type } : {}),
          ...(d.amount_units !== undefined ? { amountUnits: Number(d.amount_units) || 0 } : {}),
          ...(d.billing_period ? { billingPeriod: d.billing_period } : {}),
        })
      }
    }

    const addonPlans = Array.from(addonMap.values())

    const { AI_CREDIT_PACKS } = await import("@/lib/constants/tenant-limits")
    let aiCreditPacks = AI_CREDIT_PACKS
    try {
      const aiPricingContentType = await db.contentType.findFirst({
        where: { slug: "sacms-ai-pricing", tenantId: null }
      })
      if (aiPricingContentType) {
        const aiEntries = await db.contentEntry.findMany({
          where: { contentTypeId: aiPricingContentType.id, status: "PUBLISHED" },
          orderBy: { createdAt: "asc" }
        })
        if (aiEntries.length > 0) {
          aiCreditPacks = aiEntries.map(t => {
            const d = (typeof t.data === 'string' ? JSON.parse(t.data) : t.data) as any
            return {
              id: d.pack_slug || t.id,
              name: d.name || "AI Credits",
              credits: Number(d.credits) || 0,
              price_usd: Number(d.price_usd) || 0,
              price_idr: Number(d.price) || 0,
              badge: d.badge || undefined,
              description: d.description || "",
              features: Array.isArray(d.features) ? d.features : []
            }
          }).sort((a, b) => a.price_idr - b.price_idr)
        }
      }
    } catch (e) {
      console.warn("Failed to fetch custom AI pricing from db, using defaults:", e)
    }

    const aiCreditPlans = aiCreditPacks.map(pack => ({
      id: pack.id,
      name: pack.name,
      type: "ai_plan",
      price: pack.price_idr,
      yearlyPrice: pack.price_idr,
      price_usd: pack.price_usd,
      credits: pack.credits,
      badge: pack.badge,
      description: pack.description,
      features: pack.features,
      popular: pack.id === "ai_pack_pro",
      buttonText: `Top Up ${pack.name.split(" ")[0]}`,
      isTopup: true,
      quotaType: "ai_credits",
      amountUnits: pack.credits
    }))

    const plans = [...workspacePlans, ...addonPlans, ...aiCreditPlans]

    return NextResponse.json({ plans, aiCreditPacks: aiCreditPlans })
  } catch (error) {
    console.error("Error fetching pricing plans:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
