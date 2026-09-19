"use client"

import Link from "next/link"
import { HeroSection } from "./sections/hero-section"
import { TestimonialsSection } from "./sections/testimonials-section"
import { BlogPreviewSection } from "./sections/blog-preview-section"
import { CtaBanner } from "./sections/cta-banner"
import { FooterSection } from "./sections/footer-section"
import { FadeIn } from "@/components/ui/fade-in"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight,
  Sparkles,
  Database,
  Cpu,
  ShieldCheck,
  Zap,
  Globe,
  Layers,
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
    footer = null,
    blogs = [],
  } = data

  return (
    <div className="bg-card text-foreground selection:bg-primary/30">
      {/* 1. Hero */}
      <HeroSection data={hero} />

      {/* 2. Streamlined Feature Highlights with Link to /fitur */}
      <section className="py-20 sm:py-28 relative bg-background border-t border-border/50 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[900px] h-[400px] bg-gradient-to-tr from-primary/15 via-blue-500/10 to-transparent blur-3xl rounded-full pointer-events-none opacity-50" />

        <div className="container px-4 sm:px-6 max-w-6xl mx-auto relative z-10 space-y-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-bold tracking-wide backdrop-blur-md shadow-xs">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Teknologi Inti SaCMS</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight leading-tight">
                Arsitektur Modern untuk Pengembang
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground font-medium max-w-2xl leading-relaxed">
                Dirancang dari awal untuk kecepatan, isolasi data pelanggan, dan otomatisasi deployment Next.js 16.
              </p>
            </div>

            <Button asChild variant="outline" className="h-11 px-5 rounded-2xl font-bold text-xs border-border/80 hover:border-primary/50 hover:bg-muted shadow-xs gap-2 shrink-0">
              <Link href="/fitur">
                <span>Jelajahi Semua Fitur</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="group relative p-7 rounded-3xl bg-card/60 backdrop-blur-xl border border-border/60 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Database className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                Dedicated Database Appliance
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed mb-4">
                Pilihan isolasi total dengan PostgreSQL 17 mandiri per tenant untuk kepatuhan regulasi data enterprise dan audit independen.
              </p>
              <div className="flex items-center text-xs font-bold text-primary gap-1">
                <span>Pelajari Isolasi DB</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
              <Link href="/fitur#database" className="absolute inset-0" aria-label="Dedicated Database" />
            </div>

            <div className="group relative p-7 rounded-3xl bg-card/60 backdrop-blur-xl border border-border/60 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Cpu className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                AI Website &amp; Schema Generator
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed mb-4">
                Bangun skema konten, relasi data kompleks, dan template frontend lengkap cukup dari satu prompt teks bergaya v0.app.
              </p>
              <div className="flex items-center text-xs font-bold text-primary gap-1">
                <span>Pelajari AI Generator</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
              <Link href="/fitur#ai" className="absolute inset-0" aria-label="AI Generator" />
            </div>

            <div className="group relative p-7 rounded-3xl bg-card/60 backdrop-blur-xl border border-border/60 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Globe className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                Edge Custom DNS &amp; Dynamic API
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed mb-4">
                Routing custom domain instan ala Vercel dengan verifikasi TXT challenge serta auto-generated REST dan GraphQL endpoint.
              </p>
              <div className="flex items-center text-xs font-bold text-primary gap-1">
                <span>Pelajari Edge Routing</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
              <Link href="/fitur#dns" className="absolute inset-0" aria-label="Custom DNS" />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Streamlined Pricing Spotlight with Link to /harga */}
      <section className="py-20 sm:py-28 relative bg-card/40 border-t border-border/50 overflow-hidden">
        <div className="container px-4 sm:px-6 max-w-6xl mx-auto relative z-10">
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-card via-card/80 to-primary/5 border border-border/70 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <Badge variant="outline" className="px-3.5 py-1 text-xs font-bold border-primary/40 bg-primary/10 text-primary">
                Paket &amp; Langganan
              </Badge>
              <h2 className="text-2xl sm:text-4xl font-black text-foreground tracking-tight">
                Mulai Gratis, Tingkatkan Saat Butuh Dedicated Server
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground font-medium leading-relaxed">
                Tersedia paket Free Starter untuk proyek personal, Pro Workspace untuk agensi, hingga Dedicated Database Appliance berlisensi Enterprise.
              </p>
              <div className="flex flex-wrap gap-4 pt-2 text-xs font-semibold text-foreground/80">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Tanpa Kartu Kredit</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Pembayaran QRIS &amp; VA</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Upgrade Kapan Saja</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
              <Button asChild className="h-11 px-6 rounded-full font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm gap-2">
                <Link href="/harga">
                  <span>Lihat Daftar Harga</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 px-6 rounded-full font-bold text-xs border-border/80 hover:bg-muted">
                <Link href="/register">
                  <span>Daftar Gratis</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Testimonials (Social Proof) */}
      <FadeIn delay={100}>
        <TestimonialsSection testimonials={testimonials} />
      </FadeIn>

      {/* 5. Blog Preview Spotlight with Link to /blog */}
      {blogs.length > 0 && (
        <FadeIn delay={100}>
          <BlogPreviewSection blogs={blogs} />
        </FadeIn>
      )}

      {/* 6. About & Documentation Spotlight Banner */}
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
                  <span>Tentang SaCMS</span>
                </div>
                <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                  Visi, Misi &amp; Tim Pengembang
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Kenali filosofi produk dan para insinyur di balik SaCMS.
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
                  <span>Dokumentasi Developer</span>
                </div>
                <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                  Panduan API &amp; SDK Terpadu
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Referensi REST API, Dynamic GraphQL, dan Model Context Protocol.
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 ml-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 7. Call To Action Banner */}
      <FadeIn delay={100}>
        <CtaBanner cta={cta} />
      </FadeIn>

      {/* 8. Global Footer */}
      <FooterSection footer={footer} />
    </div>
  )
}
