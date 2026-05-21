import { LandingHeader } from "@/components/landing/header"
import { ModernLanding } from "@/components/landing/modern-landing"
import { WhatsAppButton } from "@/components/landing/whatsapp-button"
import { db } from "@/lib/database"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "SaCMS - Premium Multi-Tenant Headless CMS",
  description: "A high-performance, enterprise-ready headless CMS designed for modern startups and digital ecosystems.",
}

async function getLandingData() {
  try {
    const globalTenant = await db.tenant.findUnique({
      where: { slug: "sacms-global" },
    })

    if (!globalTenant) return getDefaultData()

    const entries = await db.contentEntry.findMany({
      where: {
        status: "PUBLISHED",
        tenantId: globalTenant.id,
        contentType: {
          slug: {
            in: [
              "sacms-hero", "sacms-features", "sacms-pricing",
              "sacms-addons", "sacms-workflow", "sacms-faq",
              "sacms-whatsapp", "sacms-about", "sacms-owners", "sacms-testimonials",
            ],
          },
        },
      },
      include: { contentType: { select: { slug: true } } },
      orderBy: { createdAt: "asc" },
    })

    const parseData = (entry: any) => {
      if (!entry) return null
      return typeof entry.data === "string" ? JSON.parse(entry.data) : entry.data
    }

    const byType = (slug: string) =>
      entries.filter((e) => e.contentType.slug === slug).map(parseData)

    const single = (slug: string) =>
      parseData(entries.find((e) => e.contentType.slug === slug))

    return {
      hero: single("sacms-hero"),
      features: byType("sacms-features"),
      pricing: byType("sacms-pricing"),
      addons: byType("sacms-addons"),
      workflow: byType("sacms-workflow"),
      faq: byType("sacms-faq"),
      whatsapp: single("sacms-whatsapp"),
      about: single("sacms-about"),
      owners: byType("sacms-owners"),
      testimonials: byType("sacms-testimonials"),
    }
  } catch {
    return getDefaultData()
  }
}

function getDefaultData() {
  return {
    hero: null,
    features: [] as any[],
    pricing: [] as any[],
    addons: [] as any[],
    workflow: [] as any[],
    faq: [] as any[],
    whatsapp: null as any,
    about: null as any,
    owners: [] as any[],
    testimonials: [] as any[],
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
