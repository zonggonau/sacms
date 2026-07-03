import { headers } from "next/headers"

export async function getLandingData() {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3000";
    const proto = headersList.get("x-forwarded-proto") || "http";
    const baseUrl = `${proto}://${host}`;

    console.log(`[Public API] Fetching live data from API endpoint...`);
    
    // Fetch data from the public API endpoint using WORKSPACE_ID
    const workspaceId = process.env.WORKSPACE_ID || "sacms-global";
    const apiKey = process.env.FRONTEND_API_KEY || "";
    
    const fetchApi = async (path: string, defaultValue: any) => {
      try {
        const res = await fetch(`${baseUrl}/api/public/${workspaceId}${path}`, {
          cache: "no-store",
          headers: {
            "Authorization": `Bearer ${apiKey}`
          }
        });
        if (!res.ok) {
          console.warn(`Failed to fetch ${path}: ${res.statusText}`);
          return defaultValue;
        }
        const json = await res.json();
        return json.data || defaultValue;
      } catch (e) {
        console.error(`Error fetching ${path}:`, e);
        return defaultValue;
      }
    };

    const [
      landingData,
      aboutData,
      whatsappData,
      rawAddons,
      pricingAccounts,
      pricingWorkspaces
    ] = await Promise.all([
      fetchApi("/single/sacms-landing-page", {}),
      fetchApi("/single/sacms-about", null),
      fetchApi("/single/sacms-whatsapp", null),
      fetchApi("/content/sacms-addons", []),
      fetchApi("/content/sacms-account-pricing", []),
      fetchApi("/content/sacms-workspace-pricing", [])
    ]);

    const landing = landingData || {}
    const whatsapp = whatsappData || null

    const hero = landing.hero_title ? {
      headline: landing.hero_title,
      subheadline: landing.hero_subtitle,
      badge_text: landing.hero_badge,
      cta_primary: landing.hero_cta_primary,
      cta_secondary: landing.hero_cta_secondary
    } : null

    // Collections from landing page single type
    const features = landing.features || []
    const workflow = landing.workflows || []
    const faq = landing.faqs || []
    const testimonials = landing.testimonials || []
    
    const owners = []
    const sectors = []
    const localPride = null
    const cta = null
    const footer = null
    
    const about = aboutData ? {
      title: aboutData.title,
      description: aboutData.content || aboutData.description,
      image: aboutData.image,
      mission: aboutData.mission,
      founded: aboutData.founded,
    } : null

    const addons = (Array.isArray(rawAddons) ? rawAddons : []).map((a: any) => ({
      ...a,
      name: a.title || a.name || "",
      price_label: a.price_label || null,
      price: a.price || 0,
    }))
    
    // Papua-specific
    const papuaHomepage = {}
    const papuaConnectedSites = []
    const papuaInitiatives = []

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
