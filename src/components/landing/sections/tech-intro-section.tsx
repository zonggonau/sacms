"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getIcon } from "../icon-map"
import { ArrowRight, Sparkles } from "lucide-react"
import type { FeatureItem, SectionIntroData } from "../types"

// Shown only when the admin hasn't marked anything "Fitur Utama" — keeps the
// teaser non-empty, same fallback idea as FeaturesBento's own
// defaultFeatures on /fitur.
const DEFAULT_HIGHLIGHT_FEATURES: FeatureItem[] = [
  {
    icon: "Database",
    title: "Dedicated Database Appliance",
    description: "Pilihan isolasi total dengan PostgreSQL 17 mandiri per tenant untuk kepatuhan regulasi data enterprise dan audit independen.",
  },
  {
    icon: "Cpu",
    title: "AI Schema Generator & Website Template",
    description: "Bangun skema konten dan relasi data kompleks cukup dari satu prompt teks, atau langsung mulai dari galeri Website Template siap pakai dengan live demo.",
  },
  {
    icon: "Globe",
    title: "Edge Custom DNS & Dynamic API",
    description: "Routing custom domain instan dengan verifikasi TXT challenge serta auto-generated REST dan GraphQL endpoint.",
  },
]

const HIGHLIGHT_ACCENTS = ["text-blue-500 bg-blue-500/10", "text-primary bg-primary/10", "text-emerald-500 bg-emerald-500/10"]

/**
 * Homepage's "Teknologi Inti" section — intro copy (badge/title/description/
 * CTA, editable via /admin/cms's "homepage_tech_intro") above 3 feature
 * highlight cards. Which features show is driven by "Fitur Utama" (is_main)
 * on the admin's "Fitur" section, falling back to the first 3 / a static
 * default when nothing is flagged. Shared by the real homepage
 * (modern-landing.tsx) and the /landingbaru design preview.
 */
export function TechIntroSection({ intro, features = [] }: { intro?: SectionIntroData | null; features?: FeatureItem[] }) {
  const mainFeatures = features.filter((f: any) => f.is_main)
  const highlightFeatures = (mainFeatures.length > 0 ? mainFeatures : features).slice(0, 3)
  const activeHighlights = highlightFeatures.length > 0 ? highlightFeatures : DEFAULT_HIGHLIGHT_FEATURES

  return (
    <section className="py-20 sm:py-28 relative bg-background border-t border-border/50 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[900px] h-[400px] bg-gradient-to-tr from-primary/15 via-blue-500/10 to-transparent blur-3xl rounded-full pointer-events-none opacity-50" />

      <div className="container px-4 sm:px-6 max-w-6xl mx-auto relative z-10 space-y-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-bold tracking-wide backdrop-blur-md shadow-xs">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{intro?.badge || "Teknologi Inti SaCMS"}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight leading-tight">
              {intro?.title || "Arsitektur Modern untuk Pengembang"}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground font-medium max-w-2xl leading-relaxed">
              {intro?.description || "Dirancang dari awal untuk kecepatan, isolasi data pelanggan, dan otomatisasi deployment Next.js 16."}
            </p>
          </div>

          <Button asChild variant="outline" className="h-11 px-5 rounded-2xl font-bold text-xs border-border/80 hover:border-primary/50 hover:bg-muted shadow-xs gap-2 shrink-0">
            <Link href="/fitur">
              <span>{intro?.cta_label || "Jelajahi Semua Fitur"}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {activeHighlights.map((feature, idx) => {
            const Icon = getIcon(feature.icon)
            const accent = HIGHLIGHT_ACCENTS[idx % HIGHLIGHT_ACCENTS.length]
            return (
              <div
                key={`${feature.title}-${idx}`}
                className="group relative p-7 rounded-3xl bg-card/60 backdrop-blur-xl border border-border/60 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform ${accent}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed mb-4">
                  {feature.description}
                </p>
                <div className="flex items-center text-xs font-bold text-primary gap-1">
                  <span>Pelajari Lebih Lanjut</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
                <Link href="/fitur" className="absolute inset-0" aria-label={feature.title} />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
