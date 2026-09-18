import type { Metadata } from "next"
import { LandingHeader } from "@/components/landing/header"
import { FooterSection } from "@/components/landing/sections/footer-section"
import { WhatsAppButton } from "@/components/landing/whatsapp-button"
import { PricingGrid } from "@/components/landing/sections/pricing-grid"
import { AddonsSection } from "@/components/landing/sections/addons-section"
import { FaqSection } from "@/components/landing/sections/faq-section"
import { CtaBanner } from "@/components/landing/sections/cta-banner"
import { getLandingData } from "@/lib/public-api"
import { getSiteUrl } from "@/lib/seo"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Sparkles, ArrowRight, CreditCard, ShieldCheck } from "lucide-react"

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl()
  const title = "Paket & Harga SaCMS — Transparan & Terukur untuk Semua Skala"
  const description =
    "Daftar paket harga SaCMS: Free Starter, Pro Workspace, Dedicated Database Appliance, dan Enterprise License. Pembayaran otomatis QRIS, Bank Transfer via Midtrans."

  return {
    title: { absolute: title },
    description,
    keywords: [
      "Harga SaCMS",
      "Paket Headless CMS",
      "SaaS CMS Pricing Indonesia",
      "Dedicated PostgreSQL Hosting",
      "Midtrans Billing Headless CMS",
    ],
    alternates: {
      canonical: `${siteUrl}/harga`,
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/harga`,
      siteName: "SaCMS — Smart Content Management System",
      locale: "id_ID",
      type: "website",
    },
  }
}

export default async function HargaPage() {
  const data = await getLandingData()
  const {
    pricingWorkspaces = [],
    pricingAccounts = [],
    addons = [],
    faq = [],
    cta = null,
    footer = null,
    whatsapp = null,
  } = data

  const wa = whatsapp || {
    phone: "6282199220551",
    message: "Halo! Saya ingin bertanya mengenai paket dan harga SaCMS.",
    label: "Chat dengan Kami",
    is_active: true,
  }

  return (
    <div className="flex flex-col min-h-screen bg-card text-foreground">
      <LandingHeader brandName={footer?.brand_name} />

      <main className="flex-1 pt-24 pb-16">
        {/* Hero Section */}
        <section className="py-14 sm:py-20 text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] h-[350px] bg-gradient-to-tr from-emerald-500/15 via-primary/10 to-transparent blur-3xl rounded-full pointer-events-none opacity-60" />

          <div className="container px-4 sm:px-6 max-w-4xl mx-auto relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold tracking-wide backdrop-blur-md shadow-xs">
              <CreditCard className="h-3.5 w-3.5" />
              <span>Transparan &amp; Fleksibel</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground leading-[1.15]">
              Paket &amp; Investasi Terukur
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed">
              Mulai gratis untuk eksperimen dan eksplorasi, lalu upgrade ke dedicated database appliance dan kuota AI tak terbatas saat traffic Anda berkembang.
            </p>

            <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
              <Button asChild className="h-10 px-6 rounded-full font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm gap-1.5">
                <Link href="/register">
                  <span>Daftar Akun Gratis</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-10 px-6 rounded-full font-bold text-xs border-border/80 hover:bg-muted">
                <Link href="/fitur">
                  <span>Pelajari Fitur Lengkap</span>
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Workspace Pricing Grid */}
        <div id="pricing">
          <PricingGrid plans={pricingWorkspaces} />
        </div>

        {/* Account Plans (if any) */}
        {pricingAccounts.length > 0 && (
          <div className="pt-8">
            <PricingGrid plans={pricingAccounts} bgClass="bg-card" />
          </div>
        )}

        {/* Addons Section */}
        <div id="addons">
          <AddonsSection addons={addons} />
        </div>

        {/* FAQ Section */}
        <div id="faq">
          <FaqSection faq={faq} />
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
