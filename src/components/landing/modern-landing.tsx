"use client"

import Link from "next/link"
import { HeroSection } from "./sections/hero-section"
import { LocalPrideSection } from "./sections/papua-pride-section"
import { TemplatesSection } from "./sections/templates-section"
import { AiAgentFrontendSection } from "./sections/ai-agent-frontend-section"
import { TestimonialsSection } from "./sections/testimonials-section"
import { BlogPreviewSection } from "./sections/blog-preview-section"
import { TechIntroSection } from "./sections/tech-intro-section"
import { CtaBanner } from "./sections/cta-banner"
import { FadeIn } from "@/components/ui/fade-in"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight,
  Users2,
  BookOpen,
  CheckCircle2,
} from "lucide-react"
import type { LandingData } from "./types"

export function ModernLanding({ data }: { data: LandingData }) {
  const {
    hero = null,
    features = [],
    pricingWorkspaces = [],
    testimonials = [],
    cta = null,
    blogs = [],
    localPride = null,
    websiteTemplates = [],
    homepageTechIntro = null,
    homepageAiAgentIntro = null,
    homepagePricingSpotlight = null,
    homepageAboutDocsBanner = null,
  } = data

  return (
    <div className="bg-card text-foreground selection:bg-primary/30">
      {/* 1. Hero */}
      <HeroSection data={hero} />

      {/* 2. Website Template Gallery — click a card to preview its live demo */}
      <TemplatesSection templates={websiteTemplates} />

      {/* 3. Kembangkan Frontend dengan AI Agent — pulled out of Hero into its own section */}
      <AiAgentFrontendSection data={homepageAiAgentIntro} />

      {/* 4. Local Pride — Papua identity, leads before the generic feature pitch */}
      <LocalPrideSection data={localPride} />

      {/* 5. Streamlined Feature Highlights with Link to /fitur */}
      <TechIntroSection intro={homepageTechIntro} features={features} />

      {/* 6. Streamlined Pricing Spotlight with Link to /harga */}
      <section className="py-20 sm:py-28 relative bg-card/40 border-t border-border/50 overflow-hidden">
        <div className="container px-4 sm:px-6 max-w-6xl mx-auto relative z-10">
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-card via-card/80 to-primary/5 border border-border/70 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <Badge variant="outline" className="px-3.5 py-1 text-xs font-bold border-primary/40 bg-primary/10 text-primary">
                {homepagePricingSpotlight?.badge || "Paket & Langganan"}
              </Badge>
              <h2 className="text-2xl sm:text-4xl font-black text-foreground tracking-tight">
                {homepagePricingSpotlight?.title || "Mulai Gratis, Tingkatkan Saat Butuh Lebih"}
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground font-medium leading-relaxed">
                {homepagePricingSpotlight?.description || "Tersedia paket Free Starter untuk proyek personal, Pro Workspace untuk agensi, hingga Database Khusus berlisensi Enterprise."}
              </p>
              <div className="flex flex-wrap gap-4 pt-2 text-xs font-semibold text-foreground/80">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> {homepagePricingSpotlight?.checklist_1 || "Tanpa Kartu Kredit"}</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> {homepagePricingSpotlight?.checklist_2 || "Pembayaran QRIS & VA"}</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> {homepagePricingSpotlight?.checklist_3 || "Upgrade Kapan Saja"}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
              <Button asChild className="h-11 px-6 rounded-full font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm gap-2">
                <Link href="/harga">
                  <span>{homepagePricingSpotlight?.cta_primary || "Lihat Daftar Harga"}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 px-6 rounded-full font-bold text-xs border-border/80 hover:bg-muted">
                <Link href="/register">
                  <span>{homepagePricingSpotlight?.cta_secondary || "Daftar Gratis"}</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Testimonials (Social Proof) */}
      <FadeIn delay={100}>
        <TestimonialsSection testimonials={testimonials} />
      </FadeIn>

      {/* 8. Blog Preview Spotlight with Link to /blog */}
      {blogs.length > 0 && (
        <FadeIn delay={100}>
          <BlogPreviewSection blogs={blogs} />
        </FadeIn>
      )}

      {/* 9. About & Documentation Spotlight Banner */}
      <section className="py-16 relative bg-background border-t border-border/50">
        <div className="container px-4 sm:px-6 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Link
              href="/tentang"
              className="group p-6 rounded-3xl bg-card/50 border border-border/60 hover:border-primary/40 hover:bg-card/90 transition-all flex items-center justify-between shadow-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-primary">
                  <Users2 className="h-4 w-4" />
                  <span>{homepageAboutDocsBanner?.about_label || "Tentang SaCMS"}</span>
                </div>
                <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                  {homepageAboutDocsBanner?.about_title || "Visi, Misi & Tim Pengembang"}
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  {homepageAboutDocsBanner?.about_description || "Kenali filosofi produk dan para insinyur di balik SaCMS."}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 ml-4" />
            </Link>

            <Link
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="group p-6 rounded-3xl bg-card/50 border border-border/60 hover:border-primary/40 hover:bg-card/90 transition-all flex items-center justify-between shadow-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-primary">
                  <BookOpen className="h-4 w-4" />
                  <span>{homepageAboutDocsBanner?.docs_label || "Dokumentasi Developer"}</span>
                </div>
                <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                  {homepageAboutDocsBanner?.docs_title || "Panduan API & SDK Terpadu"}
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  {homepageAboutDocsBanner?.docs_description || "Referensi REST API, Dynamic GraphQL, dan Model Context Protocol."}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 ml-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 10. Call To Action Banner */}
      <FadeIn delay={100}>
        <CtaBanner cta={cta} />
      </FadeIn>
    </div>
  )
}
