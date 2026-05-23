import { LandingHeader } from "@/components/landing/header"
import { ModernLanding } from "@/components/landing/modern-landing"
import { WhatsAppButton } from "@/components/landing/whatsapp-button"
import { fetchCollection, fetchSingle } from "@/lib/sacms-client"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "SaCMS - Premium Multi-Tenant Headless CMS",
  description: "A high-performance, enterprise-ready headless CMS designed for modern startups and digital ecosystems.",
}

async function fetchGlobalWorkspacePlans() {
  try {
    const res = await fetch("http://localhost:3001/api/tenant/sacms-global/subscriptions/plans", { cache: "no-store" })
    if (res.ok) {
      const data = await res.json()
      return (data.plans || [])
        .filter((p: any) => p.type === "workspace")
        .map((p: any) => ({
          name: p.name,
          description: `Includes ${p.maxContentTypes > 100 ? 'Unlimited' : p.maxContentTypes} schemas and ${p.maxContentEntries?.toLocaleString() || 'Basic'} entries`,
          price: p.price,
          interval: "month",
          features: p.features,
          isPopular: p.popular,
          cta: p.buttonText || "Get Started"
        }))
    }
  } catch (err) {
    console.error("Error fetching global workspace plans:", err)
  }
  return null
}

async function getLandingData() {
  try {
    // Fetch all required data concurrently from the REST API
    const [
      hero,
      features,
      pricingAccounts,
      fallbackPricingWorkspaces,
      addons,
      workflow,
      faq,
      whatsapp,
      about,
      owners,
      testimonials,
      globalPlans
    ] = await Promise.all([
      fetchSingle("sacms-hero"),
      fetchCollection("sacms-features", "sort=createdAt:asc"),
      fetchCollection("sacms-account-pricing", "sort=price:asc"),
      fetchCollection("sacms-workspace-pricing", "sort=price:asc"),
      fetchCollection("sacms-addons", "sort=price:asc"),
      fetchCollection("sacms-workflow", "sort=step:asc"),
      fetchCollection("sacms-faq", "sort=order:asc"),
      fetchSingle("sacms-whatsapp"),
      fetchSingle("sacms-about"),
      fetchCollection("sacms-owners"),
      fetchCollection("sacms-testimonials"),
      fetchGlobalWorkspacePlans()
    ]);

    const pricingWorkspaces = globalPlans || fallbackPricingWorkspaces;

    // Format pricing. If the previous ModernLanding expects one array for pricing,
    // we'll pass workspace pricing as it's the standard SaaS model,
    // or we can pass both if ModernLanding supports it (it currently expects one array `pricing`).
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
