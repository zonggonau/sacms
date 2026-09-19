import type { Metadata } from "next"
import { LandingHeader } from "@/components/landing/header"
import { FooterSection } from "@/components/landing/sections/footer-section"
import { WhatsAppButton } from "@/components/landing/whatsapp-button"
import { AboutSection } from "@/components/landing/sections/about-section"
import { TeamSection } from "@/components/landing/sections/team-section"
import { TestimonialsSection } from "@/components/landing/sections/testimonials-section"
import { CtaBanner } from "@/components/landing/sections/cta-banner"
import { getLandingData } from "@/lib/public-api"
import { getSiteUrl } from "@/lib/seo"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Sparkles, ArrowRight, Users2, Shield, HeartHandshake } from "lucide-react"

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl()
  const title = "Tentang SaCMS — Visi, Misi & Tim Pengembang"
  const description =
    "Pelajari perjalanan SaCMS: Smart Headless CMS multi-tenant pertama yang menggabungkan Next.js 16, PostgreSQL 17, AI Builder, dan isolasi tenant enterprise di Indonesia."

  return {
    title: { absolute: title },
    description,
    keywords: [
      "Tentang SaCMS",
      "Headless CMS Indonesia",
      "Tim Pengembang SaCMS",
      "Visi Misi SaCMS",
      "Next.js CMS Multi-Tenant",
    ],
    alternates: {
      canonical: `${siteUrl}/tentang`,
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/tentang`,
      siteName: "SaCMS — Smart Content Management System",
      locale: "id_ID",
      type: "website",
    },
  }
}

export default async function TentangPage() {
  const data = await getLandingData()
  const {
    about = null,
    owners = [],
    testimonials = [],
    cta = null,
    footer = null,
    whatsapp = null,
  } = data

  const wa = whatsapp || {
    phone: "6282199220551",
    message: "Halo! Saya ingin tahu lebih lanjut tentang tim dan teknologi SaCMS.",
    label: "Chat dengan Kami",
    is_active: true,
  }

  return (
    <div className="flex flex-col min-h-screen bg-card text-foreground">
      <LandingHeader brandName={footer?.brand_name} />

      <main className="flex-1 pt-24 pb-16">
        {/* Page Hero Header */}
        <section className="py-14 sm:py-20 text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] h-[350px] bg-gradient-to-tr from-purple-500/15 via-primary/10 to-transparent blur-3xl rounded-full pointer-events-none opacity-60" />

          <div className="container px-4 sm:px-6 max-w-4xl mx-auto relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold tracking-wide backdrop-blur-md shadow-xs">
              <Users2 className="h-3.5 w-3.5" />
              <span>Dedikasi &amp; Komitmen</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground leading-[1.15]">
              Membangun Standar Baru <br className="hidden sm:inline" />
              Headless CMS Indonesia
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed">
              SaCMS dibangun untuk menjembatani kesenjangan antara fleksibilitas developer dan kemudahan tim marketing, dengan fondasi arsitektur cloud enterprise yang tangguh.
            </p>

            <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
              <Button asChild className="h-10 px-6 rounded-full font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm gap-1.5">
                <Link href="/auth/register">
                  <span>Mulai Sekarang</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-10 px-6 rounded-full font-bold text-xs border-border/80 hover:bg-muted">
                <Link href="/fitur">
                  <span>Eksplorasi Fitur</span>
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* About Story & Metrics */}
        <div id="about">
          <AboutSection about={about} />
        </div>

        {/* Engineering Team */}
        <div id="team">
          <TeamSection owners={owners} />
        </div>

        {/* Testimonials */}
        <div id="testimonials">
          <TestimonialsSection testimonials={testimonials} />
        </div>

        {/* CTA Banner */}
        <CtaBanner cta={cta} />
      </main>

      <FooterSection footer={footer} />
      <WhatsAppButton
        phone={wa.phone}
        message={wa.message}
        label={wa.label}
        isActive={wa.is_active}
      />
    </div>
  )
}
