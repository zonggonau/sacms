"use client"

import { HeroSection } from "./sections/hero-section"
import { FeaturesBento } from "./sections/features-bento"
import { PricingGrid } from "./sections/pricing-grid"
import { WorkflowSection } from "./sections/workflow-section"
import { AddonsSection } from "./sections/addons-section"
import { TestimonialsSection } from "./sections/testimonials-section"
import { BlogPreviewSection } from "./sections/blog-preview-section"
import { AboutSection } from "./sections/about-section"
import { TeamSection } from "./sections/team-section"
import { FaqSection } from "./sections/faq-section"
import { SectorsSection } from "./sections/sectors-section"
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
    cta = null,
    footer = null,
    blogs = [],
  } = data

  return (
    <div className="bg-card text-foreground selection:bg-primary/30">
      <HeroSection data={hero} />
      <FadeIn delay={100}><FeaturesBento features={features} /></FadeIn>
      <FadeIn delay={100}><SectorsSection sectors={sectors} /></FadeIn>
      <FadeIn delay={100}><WorkflowSection workflow={workflow} /></FadeIn>
      <FadeIn delay={100}>
        <PricingGrid 
          plans={pricingWorkspaces} 
        />
      </FadeIn>
      {pricingAccounts.length > 0 && (
        <FadeIn delay={100}>
          <PricingGrid 
            plans={pricingAccounts} 
            bgClass="bg-card" 
          />
        </FadeIn>
      )}
      <FadeIn delay={100}><AddonsSection addons={addons} /></FadeIn>
      <FadeIn delay={100}><TestimonialsSection testimonials={testimonials} /></FadeIn>
      {blogs.length > 0 && (
        <FadeIn delay={100}><BlogPreviewSection blogs={blogs} /></FadeIn>
      )}
      <FadeIn delay={100}><AboutSection about={about} /></FadeIn>
      <FadeIn delay={100}><TeamSection owners={owners} /></FadeIn>
      <FadeIn delay={100}><FaqSection faq={faq} /></FadeIn>
      <FadeIn delay={100}><CtaBanner cta={cta} /></FadeIn>
      <FooterSection footer={footer} />
    </div>
  )
}
