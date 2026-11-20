import type { Metadata } from "next"
import { HeroSection } from "@/components/landing/sections/hero-section"
import { TemplatesSection } from "@/components/landing/sections/templates-section"
import { AiAgentFrontendSection } from "@/components/landing/sections/ai-agent-frontend-section"
import { TechIntroSection } from "@/components/landing/sections/tech-intro-section"
import { LocalPrideStrip } from "@/components/landing/sections/papua-pride-strip"
import { TestimonialsSection } from "@/components/landing/sections/testimonials-section"
import { PricingTeaserSection } from "@/components/landing/sections/pricing-teaser-section"
import { FaqSection } from "@/components/landing/sections/faq-section"
import { CtaBanner } from "@/components/landing/sections/cta-banner"
import { getLandingData } from "@/lib/public-api"
import { getSiteUrl, SEO_CONFIG, generatePlatformJsonLd, generateFaqJsonLd } from "@/lib/seo"

// ISR: Rebuild landing page every 60s from cache. getLandingData() is a direct DB query, not HTTP — caching is safe.
export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl()
  const title = "SaCMS — Smart Content Management System | Build smarter. Manage easier. Scale faster."
  const description = SEO_CONFIG.defaultDescription

  return {
    title: { absolute: title },
    description,
    keywords: SEO_CONFIG.keywords,
    alternates: { canonical: siteUrl },
    openGraph: {
      title,
      description,
      url: siteUrl,
      siteName: "SaCMS — Smart Content Management System",
      locale: "id_ID",
      alternateLocale: ["en_US"],
      type: "website",
      images: [{ url: `${siteUrl}/og-image.png`, width: 1200, height: 630, alt: "SaCMS — Smart Content Management System" }],
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

/**
 * The hero/AI-agent-intro/tech-intro/CTA-banner copy is intentionally
 * static (hardcoded in each section's own fallback) rather than driven by
 * /admin/cms. Website Templates, Testimonials, Pricing, FAQ, and the Local
 * Pride strip below are real data (never fabricated), same arrays /fitur,
 * /harga, and /tentang already read from the same getLandingData() call.
 */
export default async function HomePage() {
  const data = await getLandingData()

  const platformJsonLd = generatePlatformJsonLd()
  const faqJsonLd = generateFaqJsonLd(data.faq || [])

  return (
    <>
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

      <main className="flex-1">
        <HeroSection data={null} />
        <TemplatesSection templates={data.websiteTemplates} />
        <AiAgentFrontendSection data={null} />
        <TechIntroSection intro={null} features={[]} />
        <LocalPrideStrip data={data.localPride} />
        <TestimonialsSection testimonials={data.testimonials} />
        <PricingTeaserSection plans={data.pricingWorkspaces} />
        <FaqSection faq={(data.faq || []).slice(0, 4)} />
        <CtaBanner cta={null} />
      </main>
    </>
  )
}
