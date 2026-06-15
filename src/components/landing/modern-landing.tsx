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
      <LogoMarquee />
      <FeaturesBento features={features} />
      
      <PricingGrid 
        plans={pricingWorkspaces} 
        label="Paket Workspace" 
        title="Harga Transparan untuk Semua Kebutuhan" 
      />
      
      <PricingGrid 
        plans={pricingAccounts} 
        label="Paket Akun" 
        title="Pilih Paket Sesuai Kebutuhan Anda" 
        bgClass="bg-card" 
      />

      <WorkflowSection workflow={workflow} />
      <AddonsSection addons={addons} />
      <TestimonialsSection testimonials={testimonials} />
      <AboutSection about={about} />
      <TeamSection owners={owners} />
      <FaqSection faq={faq} />
      <SectorsSection sectors={sectors} />
      <LocalPrideSection localPride={localPride} />
      <CtaBanner cta={cta} />
      <FooterSection footer={footer} />
    </div>
  )
}
