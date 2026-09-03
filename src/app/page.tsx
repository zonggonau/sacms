import type { Metadata } from "next"
import { LandingHeader } from "@/components/landing/header"
import { ModernLanding } from "@/components/landing/modern-landing"
import { WhatsAppButton } from "@/components/landing/whatsapp-button"
import { getLandingData } from "@/lib/public-api"
import { getSiteUrl, SEO_CONFIG, generatePlatformJsonLd, generateFaqJsonLd } from "@/lib/seo"

// ISR: Rebuild landing page every 60s from cache. getLandingData() is a direct DB query, not HTTP — caching is safe.
export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const data = await getLandingData()
  const siteUrl = getSiteUrl()

  const rawSubheadline = data.hero?.subheadline ? data.hero.subheadline.replace(/<[^>]*>/g, "") : ""
  const description = rawSubheadline || SEO_CONFIG.defaultDescription
  const title = "SaCMS — Smart Content Management System | Build smarter. Manage easier. Scale faster."

  return {
    title: {
      absolute: title,
    },
    description,
    keywords: SEO_CONFIG.keywords,
    alternates: {
      canonical: siteUrl,
    },
    openGraph: {
      title,
      description,
      url: siteUrl,
      siteName: "SaCMS — Smart Content Management System",
      locale: "id_ID",
      alternateLocale: ["en_US"],
      type: "website",
      images: [
        {
          url: `${siteUrl}/og-image.png`,
          width: 1200,
          height: 630,
          alt: "SaCMS — Smart Content Management System",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${siteUrl}/og-image.png`],
      creator: SEO_CONFIG.social.twitter,
    },
  }
}

export default async function HomePage() {
  const data = await getLandingData()
  const wa = data.whatsapp || {
    phone: "6282199220551",
    message: "Halo! Saya tertarik dengan SaCMS.",
    label: "Chat dengan Kami",
    is_active: true,
  }

  const platformJsonLd = generatePlatformJsonLd()
  const faqJsonLd = generateFaqJsonLd(data.faq || [])

  return (
    <div className="flex flex-col min-h-screen">
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(platformJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      <LandingHeader brandName={data.footer?.brand_name} />
      <main className="flex-1">
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
