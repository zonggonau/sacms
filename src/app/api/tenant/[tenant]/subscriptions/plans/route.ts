import { NextRequest, NextResponse } from "next/server"
import { getAccountPlans, getWorkspacePlans, getAddons, getAiCreditPacks } from "@/lib/pricing"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant } = await context.params
    const isAccount = tenant === "account"

    let workspacePlans: any[] = []

    // ─── LOAD WORKSPACE / ACCOUNT PLANS FROM THE DEDICATED PRICING TABLES ───
    if (isAccount) {
      const accountPlans = await getAccountPlans()
      workspacePlans = accountPlans.map(p => ({
        id: p.slug,
        name: p.name,
        description: p.description || "",
        type: "account",
        price: p.price,
        yearlyPrice: p.yearlyPrice ?? p.price * 10,
        features: Array.isArray(p.features) ? p.features : [],
        popular: p.isPopular,
        buttonText: p.ctaText || "Pilih Paket",
        maxWorkspaces: p.maxWorkspaces,
      }))
    } else {
      const plans = await getWorkspacePlans()
      workspacePlans = plans.map(p => ({
        id: p.slug,
        name: p.name,
        description: p.description || "",
        type: "workspace",
        price: p.price,
        yearlyPrice: p.yearlyPrice ?? p.price * 10,
        features: Array.isArray(p.features) ? p.features : [],
        popular: p.slug === "pro",
        buttonText: "Pilih Paket",
        maxContentTypes: p.maxContentTypes,
        maxContentEntries: p.maxContentEntries,
        maxTeamMembers: p.maxTeamMembers,
        maxApiCalls: p.maxApiCalls,
        maxStorage: p.maxStorageMb,
        maxLocales: p.maxLocales,
        auditLogRetention: 0,
        supportLevel: p.slug === "enterprise" ? "Prioritas & SLA" : p.slug === "pro" ? "Prioritas" : "Email",
        order: p.order,
      }))
    }

    if (workspacePlans.length > 0) {
      // Sort by the admin-editable `order` column (same field /admin/pricing
      // itself uses) instead of a hardcoded slug map — a hardcoded list
      // silently pushes any new tier (e.g. "starter", added between Free
      // and Pro) to the very end instead of its intended position, with no
      // error to notice. Confirmed live: exactly this happened for the new
      // Starter plan.
      workspacePlans.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.price - b.price)
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

    // ─── LOAD ADDONS: system topups + Addon-table overlay ───
    // These hardcoded ids are wired into real billing logic server-side
    // (checkout's BUILTIN_TOPUPS map, fulfillment, usage enforcement
    // upsell links like "Beli Storage Tambahan") — they must always be
    // resolvable here, same as checkout itself always recognizes them
    // regardless of what's defined in the Addon table. Replacing this whole
    // list with table rows whenever ANY existed used to make every
    // hardcoded topup vanish — including ones an admin never touched —
    // the moment a single custom addon went live, breaking any page still
    // linking to them by id (404/"plan not found" at checkout). Addon rows
    // now only add to or override this list by slug, never replace it wholesale.
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
      // here — they're fully admin-driven (Addon table rows with
      // quotaType: "storage", editable from /admin/pricing)
      // so sizes and prices can change without a deploy. If every such
      // entry is ever deleted, storage tiers simply disappear from the
      // catalogue — same behavior as emptying any other pricing content type.
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

    const addons = await getAddons()
    for (const addon of addons) {
      const numericPrice = addon.price ?? 0

      addonMap.set(addon.slug, {
        id: addon.slug,
        name: addon.name || "Unnamed Addon",
        type: "addons",
        price: numericPrice,
        priceLabel: addon.priceLabel || "",
        features: addon.description ? [addon.description] : (Array.isArray(addon.features) ? addon.features : ["Feature upgrade"]),
        popular: false,
        buttonText: addon.priceLabel ? (numericPrice === 0 ? "Included" : "Activate") : (addon.isTopup ? "Top Up Now" : "Activate"),
        icon: addon.icon || "Package",
        isTopup: addon.isTopup,
        // Carried through so quota-specific tabs/fulfillment (e.g. the
        // Storage tab, checkout's addon fulfillment) can recognize an
        // admin-defined addon the same way they recognize a hardcoded one —
        // without this, a table-only entry (like the seeded storage tiers)
        // would silently fall outside any quota-aware behavior.
        ...(addon.quotaType ? { quotaType: addon.quotaType } : {}),
        ...(addon.amountUnits !== null && addon.amountUnits !== undefined ? { amountUnits: Number(addon.amountUnits) } : {}),
        ...(addon.billingPeriod ? { billingPeriod: addon.billingPeriod } : {}),
      })
    }

    const addonPlans = Array.from(addonMap.values())

    const { AI_CREDIT_PACKS } = await import("@/lib/constants/tenant-limits")
    let aiCreditPacks: any[] = AI_CREDIT_PACKS
    const aiPacks = await getAiCreditPacks()
    if (aiPacks.length > 0) {
      aiCreditPacks = aiPacks.map(p => ({
        id: p.slug,
        name: p.name || "AI Credits",
        credits: p.credits,
        price_usd: p.priceUsd,
        price_idr: p.price,
        badge: p.badge || undefined,
        description: p.description || "",
        features: Array.isArray(p.features) ? p.features : []
      })).sort((a, b) => a.price_idr - b.price_idr)
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
