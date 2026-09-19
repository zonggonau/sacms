import type { Metadata } from "next"
import { LandingHeader } from "@/components/landing/header"
import { FooterSection } from "@/components/landing/sections/footer-section"
import { WhatsAppButton } from "@/components/landing/whatsapp-button"
import { FeaturesBento } from "@/components/landing/sections/features-bento"
import { SectorsSection } from "@/components/landing/sections/sectors-section"
import { WorkflowSection } from "@/components/landing/sections/workflow-section"
import { CtaBanner } from "@/components/landing/sections/cta-banner"
import { getLandingData } from "@/lib/public-api"
import { getSiteUrl, SEO_CONFIG } from "@/lib/seo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Sparkles, ArrowRight, Zap, Database, Shield, Globe } from "lucide-react"

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl()
  const title = "Fitur Lengkap SaCMS — Arsitektur Headless CMS Multi-Tenant Modern"
  const description =
    "Eksplorasi fitur komprehensif SaCMS: Dedicated PostgreSQL 17, AI Website Builder, Edge Custom DNS, Dynamic GraphQL, Multi-Reviewer Workflow, dan Midtrans Snap Billing."

  return {
    title: { absolute: title },
    description,
    keywords: [
      "Fitur SaCMS",
      "Headless CMS Multi-Tenant",
      "PostgreSQL 17 Native",
      "AI Schema Generator",
      "Dynamic GraphQL Next.js",
      "Vercel Custom DNS",
    ],
    alternates: {
      canonical: `${siteUrl}/fitur`,
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/fitur`,
      siteName: "SaCMS — Smart Content Management System",
      locale: "id_ID",
      type: "website",
    },
  }
}

export default async function FiturPage() {
  const data = await getLandingData()
  const {
    features = [],
    sectors = [],
    workflow = [],
    cta = null,
    footer = null,
    whatsapp = null,
  } = data

  const wa = whatsapp || {
    phone: "6282199220551",
    message: "Halo! Saya ingin konsultasi mengenai fitur SaCMS.",
    label: "Chat dengan Kami",
    is_active: true,
  }

  return (
    <div className="flex flex-col min-h-screen bg-card text-foreground">
      <LandingHeader brandName={footer?.brand_name} />

      <main className="flex-1 pt-24 pb-16">
        {/* Page Hero Header */}
        <section className="py-14 sm:py-20 text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] h-[350px] bg-gradient-to-tr from-primary/20 via-blue-500/10 to-transparent blur-3xl rounded-full pointer-events-none opacity-60" />

          <div className="container px-4 sm:px-6 max-w-4xl mx-auto relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-bold tracking-wide backdrop-blur-md shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Ekosistem Fitur SaCMS v2</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground leading-[1.15]">
              Fitur Lengkap untuk Skala Modern
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed">
              Arsitektur Headless CMS komprehensif yang dirancang untuk performa tinggi, isolasi data enterprise, otomasi deployment, dan efisiensi tim konten.
            </p>

            <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
              <Button asChild className="h-10 px-6 rounded-full font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm gap-1.5">
                <Link href="/register">
                  <span>Mulai Coba Gratis</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-10 px-6 rounded-full font-bold text-xs border-border/80 hover:bg-muted">
                <Link href="/harga">
                  <span>Lihat Paket &amp; Harga</span>
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Bento Grid */}
        <div id="fitur">
          <FeaturesBento features={features} />
        </div>

        {/* Sectors Solution Section */}
        <div id="sektor">
          <SectorsSection sectors={sectors} />
        </div>

        {/* Workflow Section */}
        <WorkflowSection workflow={workflow} />

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
