import { LandingHeader } from "@/components/landing/header"
import { ModernLanding } from "@/components/landing/modern-landing"
import { WhatsAppButton } from "@/components/landing/whatsapp-button"
import { fetchCollection, fetchSingle } from "@/lib/sacms-client"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "SaCMS — Platform Digital Papua | Website Pemerintah, UMKM & Pariwisata",
  description: "Platform CMS modern untuk membangun website pemerintah, portal berita, katalog UMKM, dan pariwisata di Papua. Dibangun dengan teknologi enterprise-grade untuk mendukung transformasi digital di Tanah Papua.",
}

import { headers } from "next/headers"

async function fetchGlobalPlans(type: "workspace" | "account" = "workspace") {
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3001";
  const proto = headersList.get("x-forwarded-proto") || "http";
  const baseUrl = `${proto}://${host}`;
  
  try {
    const res = await fetch(`${baseUrl}/api/public/plans?type=${type}`, { cache: "no-store" })
    if (res.ok) {
      const data = await res.json()
      return data.plans || []
    }
  } catch (err) {
    console.error(`Error fetching global ${type} plans:`, err)
  }
  return []
}

async function getLandingData() {
  try {
    const headersList = await headers();
    const host = headersList.get("host") || "localhost:3001";
    const proto = headersList.get("x-forwarded-proto") || "http";
    const baseUrl = `${proto}://${host}`;

    console.log(`[Landing] Fetching data from ${baseUrl}...`);
    
    // Fetch all required data concurrently from the REST API
    const [
      heroRes,
      features,
      addons,
      workflow,
      faq,
      whatsappRes,
      aboutRes,
      owners,
      testimonials,
      workspacePlans,
      accountPlans,
      sectors,
      localPrideRes,
      ctaRes,
      footerRes
    ] = await Promise.all([
      fetchCollection("sacms-hero", "", baseUrl),
      fetchCollection("sacms-features", "sort=createdAt:asc", baseUrl),
      fetchCollection("sacms-addons", "sort=price:asc", baseUrl),
      fetchCollection("sacms-workflow", "sort=step:asc", baseUrl),
      fetchCollection("sacms-faq", "sort=order:asc", baseUrl),
      fetchCollection("sacms-whatsapp", "", baseUrl),
      fetchCollection("sacms-about", "", baseUrl),
      fetchCollection("sacms-owners", "", baseUrl),
      fetchCollection("sacms-testimonials", "", baseUrl),
      fetchGlobalPlans("workspace"),
      fetchGlobalPlans("account"),
      fetchCollection("sacms-sectors", "", baseUrl),
      fetchCollection("sacms-local-pride", "", baseUrl),
      fetchCollection("sacms-cta", "", baseUrl),
      fetchCollection("sacms-footer", "", baseUrl)
    ]);

    const hero = heroRes?.[0] || null;
    const whatsapp = whatsappRes?.[0] || null;
    const about = aboutRes?.[0] || null;
    const localPride = localPrideRes?.[0] || null;
    const cta = ctaRes?.[0] || null;
    const footer = footerRes?.[0] || null;

    console.log(`[Landing] Hero: ${hero ? 'OK' : 'Empty'}`);
    console.log(`[Landing] Features: ${features?.length || 0}`);
    console.log(`[Landing] Pricing: ${workspacePlans?.length || 0} workspaces, ${accountPlans?.length || 0} accounts`);

    return {
      hero,
      features,
      pricingAccounts: accountPlans,
      pricingWorkspaces: workspacePlans,
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
      footer
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
    footer: null
  }
}

export default async function HomePage() {
  const data = await getLandingData()
  const wa = data.whatsapp || {
    phone: "6281234567890",
    message: "Halo! Saya tertarik dengan SaCMS.",
    label: "Chat dengan Kami",
    is_active: true,
  }

  return (
    <div className="overflow-x-hidden">
      <LandingHeader />
      <main>
        <ModernLanding data={data} />
      </main>
      <WhatsAppButton
        phone={wa.phone}
        message={wa.message}
        label={wa.label}
        isActive={wa.is_active}
      />
    </div>
  )
}
