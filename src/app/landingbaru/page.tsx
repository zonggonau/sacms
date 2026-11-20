import { getLandingData } from "@/lib/public-api"
import { AiAgentFrontendSection } from "@/components/landing/sections/ai-agent-frontend-section"
import { TechIntroSection } from "@/components/landing/sections/tech-intro-section"
import { CtaBanner } from "@/components/landing/sections/cta-banner"
import { FooterSection } from "@/components/landing/sections/footer-section"
import { HeroPreviewClient } from "./hero-preview-client"

/** Design preview only — see /landingbaru. Not linked from anywhere, not
 *  wired into navigation. The hero + 9-card template gallery below it are
 *  pure layout/motion exploration (HeroPreviewClient); everything from
 *  "Kembangkan Frontend..." down reuses the SAME real sections and real
 *  getLandingData() the actual homepage uses, so admin/cms edits show up
 *  here identically. */
export default async function LandingBaruPreview() {
  const data = await getLandingData()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <HeroPreviewClient />

      <AiAgentFrontendSection data={data.homepageAiAgentIntro} />
      <TechIntroSection intro={data.homepageTechIntro} features={data.features} />
      <CtaBanner cta={data.cta} />
      <FooterSection footer={data.footer} />
    </div>
  )
}
