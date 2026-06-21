import { LandingHeader } from "@/components/landing/header"
import { ModernLanding } from "@/components/landing/modern-landing"
import { WhatsAppButton } from "@/components/landing/whatsapp-button"
import { db } from "@/lib/database"

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

    console.log(`[Landing] Fetching data from database...`);
    
  // Fetch data directly from database (server-side, bypasses public API auth)
  const [
    heroST,
    features,
    addons,
    workflow,
    faq,
    whatsappST,
    aboutST,
    owners,
    testimonials,
    workspacePlans,
    accountPlans,
    sectors,
    localPrideST,
    ctaST,
    footerST
  ] = await Promise.all([
    db.tenantSingleTypeAssignment.findFirst({ where: { tenantId: null, singleType: { slug: "sacms-hero" } }, include: { singleType: true } }),
    db.contentEntry.findMany({ where: { tenantId: null, contentType: { slug: "sacms-features" }, status: "PUBLISHED" }, orderBy: { createdAt: "asc" } }),
    db.contentEntry.findMany({ where: { tenantId: null, contentType: { slug: "sacms-addons" }, status: "PUBLISHED" }, orderBy: { createdAt: "asc" } }),
    db.contentEntry.findMany({ where: { tenantId: null, contentType: { slug: "sacms-workflow" }, status: "PUBLISHED" }, orderBy: { createdAt: "asc" } }),
    db.contentEntry.findMany({ where: { tenantId: null, contentType: { slug: "sacms-faq" }, status: "PUBLISHED" }, orderBy: { createdAt: "asc" } }),
    db.tenantSingleTypeAssignment.findFirst({ where: { tenantId: null, singleType: { slug: "sacms-whatsapp" } } }),
    db.tenantSingleTypeAssignment.findFirst({ where: { tenantId: null, singleType: { slug: "sacms-about" } } }),
    db.contentEntry.findMany({ where: { tenantId: null, contentType: { slug: "sacms-owners" }, status: "PUBLISHED" }, orderBy: { createdAt: "asc" } }),
    db.contentEntry.findMany({ where: { tenantId: null, contentType: { slug: "sacms-testimonials" }, status: "PUBLISHED" }, orderBy: { createdAt: "asc" } }),
    fetchGlobalPlans("workspace"),
    fetchGlobalPlans("account"),
    db.contentEntry.findMany({ where: { tenantId: null, contentType: { slug: "sacms-sectors" }, status: "PUBLISHED" }, orderBy: { createdAt: "asc" } }),
    db.tenantSingleTypeAssignment.findFirst({ where: { tenantId: null, singleType: { slug: "sacms-local-pride" } } }),
    db.tenantSingleTypeAssignment.findFirst({ where: { tenantId: null, singleType: { slug: "sacms-cta" } } }),
    db.tenantSingleTypeAssignment.findFirst({ where: { tenantId: null, singleType: { slug: "sacms-footer" } } }),
  ]);

    const hero = heroST?.data as any || null;
    const whatsapp = whatsappST?.data as any || null;
    const about = aboutST?.data as any || null;
    const localPride = localPrideST?.data as any || null;
    const cta = ctaST?.data as any || null;
    const footer = footerST?.data as any || null;

    console.log(`[Landing] Hero: ${hero ? 'OK' : 'Empty'}`);
    console.log(`[Landing] Features: ${features?.length || 0}`);
    console.log(`[Landing] Pricing: ${workspacePlans?.length || 0} workspaces, ${accountPlans?.length || 0} accounts`);

    return {
      hero,
      features: (features || []).map(f => f.data as any),
      pricingAccounts: accountPlans,
      pricingWorkspaces: workspacePlans,
      addons: (addons || []).map(f => f.data as any),
      workflow: (workflow || []).map(f => f.data as any),
      faq: (faq || []).map(f => f.data as any),
      whatsapp,
      about,
      owners: (owners || []).map(f => f.data as any),
      testimonials: (testimonials || []).map(f => f.data as any),
      sectors: (sectors || []).map(f => f.data as any),
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
