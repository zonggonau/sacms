import { headers } from "next/headers"

import { db } from "@/lib/database"
import { DEFAULT_LANDING_PAGE_DATA } from "@/lib/default-landing-page"

export async function getLandingData() {
  try {
    const globalTenant = await db.tenant.findUnique({ where: { slug: "sacms-global" } })
    const globalEntries = globalTenant ? await db.contentEntry.findMany({
      where: { tenantId: globalTenant.id, status: "PUBLISHED" },
      include: { contentType: true }
    }) : []

    const globalSingleTypes = globalTenant ? await db.tenantSingleTypeAssignment.findMany({
      where: { tenantId: globalTenant.id, enabled: true, publishedAt: { not: null } },
      include: { singleType: true }
    }) : []

    const data: Record<string, any> = {}
    
    // Group entries by their schema slug
    globalEntries.forEach(entry => {
      const slug = entry.contentType.slug
      const parsedData = typeof entry.data === 'string' ? JSON.parse(entry.data) : entry.data
      
      // Some schemas are lists (features, workflow), others are singletons (hero, about)
      if (["sacms-features", "sacms-workflow", "sacms-faq", "sacms-owners", "sacms-blogs", "sacms-testimonials", "sacms-sectors", "sacms-workspace-pricing", "sacms-account-pricing", "sacms-addons"].includes(slug)) {
        if (!data[slug]) data[slug] = []
        data[slug].push(parsedData)
      } else {
        data[slug] = parsedData
      }
    })

    // Group single types
    globalSingleTypes.forEach(assignment => {
      const slug = assignment.singleType.slug
      const parsedData = typeof assignment.data === 'string' ? JSON.parse(assignment.data) : (assignment.data || {})
      data[slug] = parsedData
    })

    return {
      hero: data["sacms-hero"] || null,
      features: data["sacms-features"] || [],
      pricingAccounts: data["sacms-account-pricing"] || [],
      pricingWorkspaces: data["sacms-workspace-pricing"] || [],
      addons: data["sacms-addons"] || [],
      workflow: data["sacms-workflow"] || [],
      faq: data["sacms-faq"] || [],
      whatsapp: data["sacms-whatsapp"] || null,
      about: data["sacms-about"] || null,
      owners: data["sacms-owners"] || [],
      blogs: data["sacms-blogs"] || [],
      testimonials: data["sacms-testimonials"] || [],
      sectors: data["sacms-sectors"] || [],
      localPride: data["sacms-local-pride"] || null,
      cta: data["sacms-cta"] || null,
      footer: data["sacms-footer"] || null,
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
