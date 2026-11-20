import { getLandingData } from "@/lib/public-api"
import { AiAgentFrontendSection } from "@/components/landing/sections/ai-agent-frontend-section"
import { TechIntroSection } from "@/components/landing/sections/tech-intro-section"
import { CtaBanner } from "@/components/landing/sections/cta-banner"
import { FooterSection } from "@/components/landing/sections/footer-section"
import { HeroPreviewClient } from "./hero-preview-client"

/** Design preview only — see /landingbaru. Not linked from anywhere, not
 *  wired into navigation. The AI Agent/Tech Intro/CTA copy below the hero
 *  is static now, matching the real homepage (/admin/cms no longer has a
 *  way to edit it — removed to simplify the admin). */
export default async function LandingBaruPreview() {
  const data = await getLandingData()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <HeroPreviewClient />

      <AiAgentFrontendSection data={null} />
      <TechIntroSection intro={null} features={[]} />
      <CtaBanner cta={data.cta} />
      <FooterSection footer={data.footer} />
    </div>
  )
}
