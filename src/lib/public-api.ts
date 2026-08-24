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
      enterprise: 4, 
      "vps-s": 5, 
      "vps-m": 6, 
      "vps-l": 7, 
      "vds-s": 8, 
      "vds-m": 9, 
      "vds-l": 10
    }
    const pricingWorkspaces = (collectionsData?.["sacms-workspace-pricing"] || []).sort((a: any, b: any) => {
      const slugA = (a.plan_slug || a.id || "").toLowerCase()
      const slugB = (b.plan_slug || b.id || "").toLowerCase()
      return (PLAN_ORDER[slugA] || 99) - (PLAN_ORDER[slugB] || 99) || (Number(a.price) || 0) - (Number(b.price) || 0)
    });
    const addons = collectionsData?.["sacms-addons"] || [];

    return {
      hero: {
        headline: lp.hero_title || "",
        subheadline: lp.hero_subtitle || "",
        badge_text: lp.hero_badge || "",
        image_url: lp.hero_image || "",
        cta_primary: lp.hero_cta_primary || "",
        cta_secondary: lp.hero_cta_secondary || "",
      },
      features: lp.features || [],
      pricingAccounts: pricingAccounts,
      pricingWorkspaces: pricingWorkspaces,
      addons: addons,
      workflow: lp.workflows || [],
      faq: lp.faqs || [],
      whatsapp: lp.whatsapp || null,
      about: lp.about || null,
      owners: lp.owners || [],
      blogs: collectionsData?.["posts"] || [],
      testimonials: lp.testimonials || [],
      sectors: lp.sectors || [],
      localPride: lp.local_pride || null,
      cta: {
        title: lp.cta_banner?.title || "",
        description: lp.cta_banner?.description || "",
        button_primary_text: lp.cta_banner?.button_primary_text || "",
        button_secondary_text: lp.cta_banner?.button_secondary_text || "",
      },
      footer: lp.footer || null,
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
    pricingWorkspaces: [],
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
