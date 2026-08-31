import { DEFAULT_LANDING_PAGE_DATA } from "@/lib/default-landing-page"
import { getGlobalWorkspaceId } from "@/lib/settings"
import { db } from "@/lib/database"

export async function getLandingData() {
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

    // Pricing dan addons masih berbentuk collections
    const pricingAccounts = collectionsData?.["sacms-account-pricing"] || [];
    const PLAN_ORDER: Record<string, number> = { 
      free: 1, 
      starter: 2, 
      pro: 3, 
      business: 4,
      enterprise: 4, 
      // Cloud VPS Standard (SSD)
      "vps-4": 10,
      "vps-6": 11,
      "vps-8": 12,
      "vps-12": 13,
      "vps-16": 14,
      "vps-18": 15,
      // Cloud VPS Plus (NVMe)
      "vps-plus-4": 20, 
      "vps-s": 20, 
      "vps-plus-6": 21, 
      "enterprise-vps": 21, 
      "vps-m": 21, 
      "vps-plus-8": 22, 
      "vps-l": 22, 
      "vps-plus-12": 23,
      "vps-xl": 23,
      "vps-plus-16": 24,
      "vps-plus-18": 25,
      "vps-xxl": 25,
      // VPS Storage
      "vps-storage-10": 30,
      "vps-storage-20": 31,
      "vps-storage-30": 32,
      "vps-storage-40": 33,
      "vps-storage-50": 34,
      // Cloud VDS Dedicated CPU
      "vds-s": 40, 
      "vds-m": 41, 
      "enterprise-vds": 41, 
      "vds-l": 42, 
      "vds-xl": 43,
      "vds-xxl": 44,
    }
    const rawPricingWorkspaces = collectionsData?.["sacms-workspace-pricing"] || []
    const pricingWorkspacesList = rawPricingWorkspaces.length > 0 
      ? rawPricingWorkspaces 
      : (DEFAULT_LANDING_PAGE_DATA["sacms-workspace-pricing"] || [])

    const pricingWorkspaces = pricingWorkspacesList.sort((a: any, b: any) => {
      const slugA = (a.plan_slug || a.id || "").toLowerCase()
      const slugB = (b.plan_slug || b.id || "").toLowerCase()
      return (PLAN_ORDER[slugA] || 99) - (PLAN_ORDER[slugB] || 99) || (Number(a.price) || 0) - (Number(b.price) || 0)
    });
    const addons = collectionsData?.["sacms-addons"] || [];

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
  } catch (err) {
    console.error("Error in getLandingData:", err);
    return getDefaultData();
  }
}

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
