import { cache } from "react"
import { DEFAULT_LANDING_PAGE_DATA } from "@/lib/default-landing-page"
import { getGlobalWorkspaceId } from "@/lib/settings"
import { db } from "@/lib/database"

export const getLandingData = cache(async function getLandingData() {
  try {
    const globalWorkspaceId = await getGlobalWorkspaceId()
    
    // Direct database query instead of HTTP self-fetch to avoid Next.js dev server deadlock
    const singleTypes = await db.singleType.findMany({
      where: { tenantId: null },
      include: {
        tenants: {
          where: { tenantId: globalWorkspaceId }
        }
      }
    })

    const singleTypesData = singleTypes.reduce((acc, st) => {
      let data = st.tenants[0]?.data || {}
      if (typeof data === 'string') {
        try { data = JSON.parse(data) } catch (e) {}
      }
      acc[st.slug] = data
      return acc
    }, {} as Record<string, any>)

    const contentTypes = await db.contentType.findMany({
      where: { tenantId: null }
    })

    const contentEntries = await db.contentEntry.findMany({
      where: { tenantId: globalWorkspaceId }
    })

    const collectionsData = contentTypes.reduce((acc, ct) => {
      const entries = contentEntries.filter(e => e.contentTypeId === ct.id).map(e => {
        let data = e.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data) } catch (e) {}
        }
        return data;
      })
      acc[ct.slug] = entries
      return acc
    }, {} as Record<string, any>)

    // Mapping format baru: "sacms-landing-page" berisi object komplit
    const lp = singleTypesData?.["sacms-landing-page"] || {};

    // Pricing & addons now live in dedicated tables (src/lib/pricing.ts), not
    // CMS collections — mapped back into the same CMS-shaped field names
    // (plan_slug, max_workspaces, is_popular, ...) the landing-page
    // components already consume, so no downstream component changes.
    const { getAccountPlans, getWorkspacePlans, getAddons } = await import("@/lib/pricing")
    const [accountPlanRows, workspacePlanRows, addonRows] = await Promise.all([
      getAccountPlans(),
      getWorkspacePlans(),
      getAddons(),
    ])

    const pricingAccounts = accountPlanRows.map(p => ({
      name: p.name,
      plan_slug: p.slug,
      price: p.price,
      yearly_price: p.yearlyPrice,
      max_workspaces: p.maxWorkspaces,
      description: p.description || "",
      features: Array.isArray(p.features) ? p.features : [],
      is_popular: p.isPopular,
      cta_text: p.ctaText || "",
      cta_href: p.ctaHref || "",
    }));

    const PLAN_ORDER: Record<string, number> = {
      free: 1,
      starter: 2,
      pro: 3,
      business: 4,
      enterprise: 4,
    }
    const rawPricingWorkspaces = workspacePlanRows.map(p => ({
      name: p.name,
      plan_slug: p.slug,
      price: p.price,
      yearly_price: p.yearlyPrice,
      max_content_types: p.maxContentTypes,
      max_content_entries: p.maxContentEntries,
      max_team_members: p.maxTeamMembers,
      max_storage: p.maxStorageMb,
      max_locales: p.maxLocales,
      max_api_calls: p.maxApiCalls,
      fair_use_bandwidth_gb: p.fairUseBandwidthGb,
      description: p.description || "",
      features: Array.isArray(p.features) ? p.features : [],
    }))
    const pricingWorkspacesList = rawPricingWorkspaces.length > 0
      ? rawPricingWorkspaces
      : (DEFAULT_LANDING_PAGE_DATA["sacms-workspace-pricing"] || [])

    const pricingWorkspaces = pricingWorkspacesList.sort((a: any, b: any) => {
      const slugA = (a.plan_slug || a.id || "").toLowerCase()
      const slugB = (b.plan_slug || b.id || "").toLowerCase()
      return (PLAN_ORDER[slugA] || 99) - (PLAN_ORDER[slugB] || 99) || (Number(a.price) || 0) - (Number(b.price) || 0)
    });
    const addons = addonRows.map(a => ({
      icon: a.icon || "",
      name: a.name,
      addon_slug: a.slug,
      description: a.description || "",
      price: a.price,
      price_label: a.priceLabel || "",
      unit: a.unit || "",
      feature_key: a.featureKey || "",
      plan_slug: a.checkoutAlias || "",
      yearly_price: a.yearlyPrice,
      is_topup: a.isTopup,
      quota_type: a.quotaType || "",
      amount_units: a.amountUnits !== null && a.amountUnits !== undefined ? Number(a.amountUnits) : undefined,
      billing_period: a.billingPeriod || "",
      features: Array.isArray(a.features) ? a.features : [],
    }));

    const def = DEFAULT_LANDING_PAGE_DATA

    return {
      hero: {
        headline: lp.hero_title || def["sacms-hero"]?.headline || "",
        subheadline: lp.hero_subtitle || def["sacms-hero"]?.subheadline || "",
        badge_text: lp.hero_badge || def["sacms-hero"]?.badge_text || "",
        image_url: lp.hero_image || def["sacms-hero"]?.image_url || "",
        cta_primary: lp.hero_cta_primary || def["sacms-hero"]?.cta_primary || "",
        cta_secondary: lp.hero_cta_secondary || def["sacms-hero"]?.cta_secondary || "",
      },
      features: (lp.features && lp.features.length > 0) ? lp.features : (def["sacms-features"] || []),
      pricingAccounts: pricingAccounts.length > 0 ? pricingAccounts : (def["sacms-account-pricing"] || []),
      pricingWorkspaces: pricingWorkspaces,
      addons: addons.length > 0 ? addons : (def["sacms-addons"] || []),
      workflow: (lp.workflows && lp.workflows.length > 0) ? lp.workflows : (def["sacms-workflow"] || []),
      faq: (lp.faqs && lp.faqs.length > 0) ? lp.faqs : (def["sacms-faq"] || []),
      whatsapp: lp.whatsapp || def["sacms-whatsapp"] || null,
      about: lp.about || def["sacms-about"] || null,
      owners: (lp.owners && lp.owners.length > 0) ? lp.owners : (def["sacms-owners"] || []),
      blogs: (collectionsData?.["posts"] && collectionsData["posts"].length > 0) 
        ? collectionsData["posts"] 
        : (lp.blogs && lp.blogs.length > 0 ? lp.blogs : def["sacms-blogs"] || []),
      testimonials: (lp.testimonials && lp.testimonials.length > 0) ? lp.testimonials : (def["sacms-testimonials"] || []),
      sectors: (lp.sectors && lp.sectors.length > 0) ? lp.sectors : (def["sacms-sectors"] || []),
      localPride: lp.local_pride || def["sacms-local-pride"] || null,
      cta: {
        title: lp.cta_banner?.title || def["sacms-cta"]?.title || "",
        description: lp.cta_banner?.description || def["sacms-cta"]?.description || "",
        button_primary_text: lp.cta_banner?.button_primary_text || def["sacms-cta"]?.button_primary_text || "",
        button_secondary_text: lp.cta_banner?.button_secondary_text || def["sacms-cta"]?.button_secondary_text || "",
      },
      footer: lp.footer || def["sacms-footer"] || null,
      papuaHero: null,
      papuaVisionMission: null,
      papuaChallenges: [],
      papuaTechStack: [],
      papuaConnectedSites: [],
      papuaInitiatives: [],
    }
  } catch (err: any) {
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
      console.warn("[LandingData] Database query fallback:", err?.message || err)
    }
    return getDefaultData()
  }
})


function getDefaultData() {
  const landing = DEFAULT_LANDING_PAGE_DATA;
  return {
    hero: landing["sacms-hero"],
    features: landing["sacms-features"],
    addons: landing["sacms-addons"],
    pricingAccounts: [],
    pricingWorkspaces: landing["sacms-workspace-pricing"] || [],
    workflow: landing["sacms-workflow"],
    faq: landing["sacms-faq"],
    whatsapp: landing["sacms-whatsapp"],
    about: landing["sacms-about"],
    owners: landing["sacms-owners"],
    blogs: landing["sacms-blogs"] || [],
    testimonials: landing["sacms-testimonials"],
    sectors: landing["sacms-sectors"],
    localPride: landing["sacms-local-pride"],
    cta: landing["sacms-cta"],
    footer: landing["sacms-footer"],
    papuaHero: null,
    papuaVisionMission: null,
    papuaChallenges: [],
    papuaTechStack: [],
    papuaConnectedSites: [],
    papuaInitiatives: [],
  }
}
