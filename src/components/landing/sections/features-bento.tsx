"use client"

import { getIcon } from "../icon-map"
import type { FeatureItem } from "../types"
import { Cpu, Server, Layers, LayoutTemplate, HardDrive, CreditCard } from "lucide-react"

export function FeaturesBento({ features = [] }: { features?: FeatureItem[] }) {
  // Default localized features fallback
  const defaultFeatures = [
    {
      icon: "Layers",
      title: "Hybrid Multi-Tenancy & Dedicated Appliance",
      description: "Mulai dari shared multi-tenant hemat biaya hingga PostgreSQL 17 + MinIO Appliance terisolasi penuh untuk privasi data absolut.",
    },
    {
      icon: "Sparkles",
      title: "1-Prompt AI Fullstack Website Engine",
      description: "Bangun landing page & website instan berbasis Next.js dengan AI prompt, preview interaktif, export kode, dan 1-click edge deploy.",
    },
    {
      icon: "Database",
      title: "Dynamic GraphQL, REST API & MCP",
      description: "Skema otomatis sesuai data model Anda, query filter canggih ala Strapi, dan integrasi AI IDE via Model Context Protocol (MCP).",
    },
    {
      icon: "Globe",
      title: "Vercel-Style Custom DNS & Registrar",
      description: "Manajemen domain instan dengan verifikasi otomatis A-Record Apex, CNAME Subdomain, dan pencarian domain terintegrasi.",
    },
    {
      icon: "CreditCard",
      title: "Billing Otomatis QRIS & Midtrans",
      description: "Tagihan otomatis berbasis workspace dan akun (QRIS, VA, Kartu Kredit) dengan proteksi akses dan top-up kuota terintegrasi.",
    },
    {
      icon: "ShieldCheck",
      title: "Enterprise RBAC & 7-Stage Workflow",
      description: "Kontrol hak akses tim bertingkat dan alur publikasi konten terstruktur (Draft -> In Review -> Scheduled -> Published) lengkap dengan audit log.",
    },
  ]

  const activeFeatures = features && features.length > 0 ? features : defaultFeatures

  return (
    <section id="fitur" className="py-20 relative bg-background overflow-hidden scroll-mt-24">
      {/* Abstract Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[600px] opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent blur-3xl rounded-full" />
      </div>

      <div className="container px-6 max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16 space-y-3">
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest backdrop-blur-sm shadow-sm shadow-primary/20">
            Keunggulan Platform
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight max-w-3xl mx-auto leading-tight">
            Dibangun untuk Skalabilitas, Kecepatan & Keamanan Maksimal
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto font-medium leading-relaxed">
            Arsitektur headless API-first yang memberi Anda kebebasan penuh untuk mendistribusikan konten ke berbagai platform.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {activeFeatures.map((feature, i) => {
            const Icon = getIcon(feature.icon)

            return (
              <div 
                key={i} 
                className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 backdrop-blur-xl shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 hover:border-primary/40 flex flex-col p-6 min-h-[200px]"
              >
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                <div className="relative z-10 flex flex-col h-full">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold tracking-tight text-foreground mb-2 group-hover:text-primary transition-colors duration-300">
                      {feature.title}
                    </h3>
                    <div 
                      className="text-muted-foreground leading-relaxed text-xs sm:text-sm [&>p]:mb-0 [&_p]:mb-0" 
                      dangerouslySetInnerHTML={{ __html: feature.description || '' }} 
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
