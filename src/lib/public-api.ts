import { headers } from "next/headers"

export async function getLandingData() {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const proto = headersList.get("x-forwarded-proto") || "http";
    const baseUrl = `${proto}://${host}`;

    console.log(`[Public API] Fetching live data from API endpoint...`);
    
    // Fetch data from the public API endpoint
    const res = await fetch(`${baseUrl}/api/public/global/content`, { 
      cache: "no-store",
    })
    
    if (!res.ok) {
      throw new Error(`Failed to fetch API: ${res.statusText}`)
    }
    
    const responseData = await res.json()
    const data = responseData.data || { singleTypes: {}, collections: {} }
    
    const { singleTypes, collections } = data

    // Parse specific single types (now stored as collections)
    const hero = collections["sacms-hero"]?.[0] || null
    const whatsapp = collections["sacms-whatsapp"]?.[0] || null
    const about = collections["sacms-about"]?.[0] || null
    const localPride = collections["sacms-local-pride"]?.[0] || null
    const cta = collections["sacms-cta"]?.[0] || null
    const footer = collections["sacms-footer"]?.[0] || null
    
    // Papua-specific single type
    const papuaHomepage = singleTypes["papua-homepage"] || {}

    // Parse collections
    const features = collections["sacms-features"] || []
    const addons = collections["sacms-addons"] || []
    const workflow = collections["sacms-workflow"] || []
    const faq = collections["sacms-faq"] || []
    const owners = collections["sacms-owners"] || []
    const testimonials = collections["sacms-testimonials"] || []
    const sectors = collections["sacms-sectors"] || []
    
    // Pricing accounts and workspaces
    const pricingAccounts = collections["sacms-account-pricing"] || []
    const pricingWorkspaces = collections["sacms-workspace-pricing"] || []
    
    // Papua-specific collections
    const papuaConnectedSites = collections["connected-sites"] || []
    const papuaInitiatives = collections["digital-initiatives"] || []

    return {
      hero,
      features,
      pricingAccounts,
      pricingWorkspaces,
      addons,
      workflow,
      faq,
      whatsapp,
      about,
      owners,
      testimonials,
      sectors,
      localPride,
      cta,
      footer,
      // Papua
      papuaHero: papuaHomepage.hero || null,
      papuaVisionMission: papuaHomepage.visionMission || null,
      papuaChallenges: papuaHomepage.challenges || [],
      papuaTechStack: papuaHomepage.techStack || [],
      papuaConnectedSites,
      papuaInitiatives,
    }
  } catch (err) {
    console.error("Error in getLandingData:", err);
    return getDefaultData();
  }
}

function getDefaultData() {
  return {
    hero: null,
    features: [],
    addons: [],
    pricingAccounts: [],
    pricingWorkspaces: [],
    workflow: [],
    faq: [],
    whatsapp: null,
    about: null,
    owners: [],
    testimonials: [],
    sectors: [],
    localPride: null,
    cta: null,
    footer: null,
    papuaHero: null,
    papuaVisionMission: null,
    papuaChallenges: [],
    papuaTechStack: [],
    papuaConnectedSites: [],
    papuaInitiatives: [],
  }
}
