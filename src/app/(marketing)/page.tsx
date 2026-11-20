import type { Metadata } from "next"
import { HeroSection } from "@/components/landing/sections/hero-section"
import { TemplatesSection } from "@/components/landing/sections/templates-section"
import { AiAgentFrontendSection } from "@/components/landing/sections/ai-agent-frontend-section"
import { TechIntroSection } from "@/components/landing/sections/tech-intro-section"
import { CtaBanner } from "@/components/landing/sections/cta-banner"
import { getPublishedWebsiteTemplates } from "@/lib/public-api"
import { getSiteUrl, SEO_CONFIG, generatePlatformJsonLd } from "@/lib/seo"

// ISR: Rebuild every 60s — only the Template gallery is a real DB query now.
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
 * The homepage's marketing copy is intentionally static (hardcoded in each
 * section component's own fallback) rather than driven by /admin/cms —
 * only the Website Template gallery stays real/dynamic, pulled straight
 * from the database. /fitur, /harga, and /tentang are untouched and still
 * fully editable via /admin/cms as before.
 */
export default async function HomePage() {
  const templates = (await getPublishedWebsiteTemplates()).slice(0, 9)

  const platformJsonLd = generatePlatformJsonLd()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(platformJsonLd) }}
      />

      <main className="flex-1">
        <HeroSection data={null} />
        <TemplatesSection templates={templates} />
        <AiAgentFrontendSection data={null} />
        <TechIntroSection intro={null} features={[]} />
        <CtaBanner cta={null} />
      </main>
    </>
  )
}
