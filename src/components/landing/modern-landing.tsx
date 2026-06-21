"use client"

import { LogoMarquee } from "./logo-marquee"
import { HeroSection } from "./sections/hero-section"
import { FeaturesBento } from "./sections/features-bento"
import { PricingGrid } from "./sections/pricing-grid"
import { WorkflowSection } from "./sections/workflow-section"
import { AddonsSection } from "./sections/addons-section"
import { TestimonialsSection } from "./sections/testimonials-section"
import { AboutSection } from "./sections/about-section"
import { TeamSection } from "./sections/team-section"
import { FaqSection } from "./sections/faq-section"
import { SectorsSection } from "./sections/sectors-section"
import { LocalPrideSection } from "./sections/local-pride-section"
import { CtaBanner } from "./sections/cta-banner"
import { FooterSection } from "./sections/footer-section"
import { FadeIn } from "@/components/ui/fade-in"
import type { LandingData } from "./types"

export function ModernLanding({ data }: { data: LandingData }) {
  const {
    hero = null,
    features = [],
    pricingAccounts = [],
    pricingWorkspaces = [],
    addons = [],
    workflow = [],
    faq = [],
    about = null,
    owners = [],
    testimonials = [],
    sectors = [],
    localPride = null,
    cta = null,
    footer = null,
  } = data

  return (
    <div className="bg-card text-foreground selection:bg-primary/30">
      <HeroSection data={hero} />
      <FadeIn><LogoMarquee /></FadeIn>
      <FadeIn delay={100}><FeaturesBento features={features} /></FadeIn>
      <FadeIn delay={100}>
        <PricingGrid 
          plans={pricingWorkspaces} 
          label="Paket Workspace" 
          title="Harga Transparan untuk Semua Kebutuhan" 
        />
      </FadeIn>
      <FadeIn delay={100}>
        <PricingGrid 
          plans={pricingAccounts} 
          label="Paket Akun" 
          title="Pilih Paket Sesuai Kebutuhan Anda" 
          bgClass="bg-card" 
        />
      </FadeIn>
      <FadeIn delay={100}><WorkflowSection workflow={workflow} /></FadeIn>
      <FadeIn delay={100}><AddonsSection addons={addons} /></FadeIn>
      <FadeIn delay={100}><TestimonialsSection testimonials={testimonials} /></FadeIn>
      <FadeIn delay={100}><AboutSection about={about} /></FadeIn>
      <FadeIn delay={100}><TeamSection owners={owners} /></FadeIn>
      <FadeIn delay={100}><FaqSection faq={faq} /></FadeIn>
      <FadeIn delay={100}><SectorsSection sectors={sectors} /></FadeIn>
      <FadeIn delay={100}><LocalPrideSection localPride={localPride} /></FadeIn>
      <FadeIn delay={100} direction="up"><CtaBanner cta={cta} /></FadeIn>
      <FadeIn delay={100}><FooterSection footer={footer} /></FadeIn>
    </div>
  )
}
