"use client"

import { Button } from "@/components/ui/button"
import {
  Check, Database, Sparkles,
  GitBranch, Languages, Webhook,
  Zap, Shield, Globe, Cpu, Layout,
  Quote, Brain, CreditCard, PenLine, FileEdit, Code2, Rocket,
  ChevronDown, ChevronUp, Bot, MessageCircle
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { LogoMarquee } from "./logo-marquee"

const iconMap: Record<string, any> = {
  Sparkles, Cpu, Layout, Zap, Webhook, Languages, GitBranch, Shield, Globe, Database,
  Brain, CreditCard, PenLine, FileEdit, Code2, Rocket, Bot, MessageCircle,
}

interface LandingData {
  hero: any
  features: any[]
  pricingAccounts: any[]
  pricingWorkspaces: any[]
  addons: any[]
  workflow: any[]
  faq: any[]
  about: any
  owners: any[]
  testimonials: any[]
  whatsapp: any
}

function formatRupiah(price: number) {
  if (price === 0) return "Free"
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price)
}

export function ModernLanding({ data }: { data: LandingData }) {
  const hero = data.hero || { headline: "Loading API Data..." }
  const features = data.features || []
  const pricingAccounts = data.pricingAccounts || []
  const pricingWorkspaces = data.pricingWorkspaces || []
  const workflow = data.workflow || []
  const faq = data.faq || []
  const testimonials = data.testimonials || []
  const about = data.about
  const owners = data.owners || []
  const addons = data.addons || []

  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="bg-card text-foreground selection:bg-primary/30">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="min-h-[90vh] flex items-center justify-center pt-32 pb-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="container px-6 max-w-5xl mx-auto text-center space-y-8 relative">
          {hero.badge_text && (
            <span className="inline-block px-4 py-1.5 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wide mb-2">
              {hero.badge_text}
            </span>
          )}

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight text-foreground">
            {/* Highlight last 2 words in orange */}
            {(() => {
              const words = (hero.headline || "").split(" ")
              const main = words.slice(0, -2).join(" ")
              const accent = words.slice(-2).join(" ")
              return (
                <>
                  {main}{" "}
                  <span className="text-primary">{accent}</span>
                </>
              )
            })()}
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {hero.subheadline}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href={hero.cta_href || "/register"}>
              <Button size="lg" className="h-12 px-10 bg-primary hover:bg-primary/90 text-white rounded-none font-semibold">
                {hero.cta_primary || "Mulai Gratis"}
              </Button>
            </Link>
            <Link href="/docs">
              <Button size="lg" variant="outline" className="h-12 px-10 rounded-none border-border font-semibold">
                {hero.cta_secondary || "Lihat Demo"}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <LogoMarquee />

      {/* ── BENTO GRID FEATURES ─────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-background border-t border-border scroll-mt-24">
        <div className="container px-6 max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Keunggulan Teknologi</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">
              Fitur Enterprise untuk Skalabilitas Penuh
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {features.map((feature: any, i: number) => {
              const Icon = iconMap[feature.icon] || Sparkles
              
              // Asymmetrical Bento Layout Logic
              let spanClass = "md:col-span-1"
              if (i === 0) spanClass = "md:col-span-2 md:row-span-2" // Large feature
              else if (i === 1) spanClass = "md:col-span-2"          // Top right
              else if (i === 2) spanClass = "md:col-span-2"          // Bottom right
              else if (i === 3) spanClass = "md:col-span-4"          // Full width banner
              else if (i === 4) spanClass = "md:col-span-2"          // Half width
              else if (i === 5) spanClass = "md:col-span-2"          // Half width
              else spanClass = "md:col-span-1"                       // Fallback

              return (
                <div key={i} className={`p-8 min-h-[250px] bg-card border border-border flex flex-col justify-between hover:bg-muted/10 transition-colors ${spanClass}`}>
                  <div>
                    <div className="w-12 h-12 bg-primary/10 flex items-center justify-center mb-6">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-black tracking-tight text-foreground mb-3">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">{feature.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── PRICING WORKSPACES ────────────────────────────────────────────── */}
      {pricingWorkspaces.length > 0 && (
        <section id="pricing" className="py-24 bg-background border-t border-border scroll-mt-24">
          <div className="container px-6 max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Workspace Plans</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                Simple Pricing for Teams
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {pricingWorkspaces.map((plan: any, i: number) => (
                <div
                  key={i}
                  className={`relative flex flex-col p-8 rounded-xl border ${plan.isPopular ? "bg-card shadow-lg border-orange-500 border-2 z-10" : "bg-muted/10 border-border hover:border-orange-500/50 transition-colors"
                    }`}
                >
                  {plan.isPopular && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-foreground mb-2">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-6 h-10">{plan.description}</p>
                  <div className="mb-6">
                    <span className="text-4xl font-extrabold text-foreground">Rp{plan.price.toLocaleString("id-ID")}</span>
                    <span className="text-sm text-muted-foreground">/{plan.interval}</span>
                  </div>
                  <ul className="space-y-4 mb-8 flex-1">
                    {plan.features?.map((feat: string, j: number) => (
                      <li key={j} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-sm text-muted-foreground">{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/register">
                    <Button
                      className={`w-full h-12 rounded-none font-bold ${plan.isPopular
                        ? "bg-primary hover:bg-primary/90 text-white"
                        : "bg-muted text-foreground hover:bg-muted/80"
                        }`}
                    >
                      {plan.cta || "Get Started"}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── PRICING ACCOUNTS ────────────────────────────────────────────── */}
      {pricingAccounts.length > 0 && (
        <section id="pricing-accounts" className="py-24 bg-card border-t border-border scroll-mt-24">
          <div className="container px-6 max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Account Plans</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                Developer & User Accounts
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {pricingAccounts.map((plan: any, i: number) => (
                <div
                  key={i}
                  className={`relative flex flex-col p-8 rounded-xl border ${plan.isPopular ? "bg-background shadow-lg border-orange-500 border-2 z-10" : "bg-muted/10 border-border hover:border-orange-500/50 transition-colors"
                    }`}
                >
                  {plan.isPopular && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-foreground mb-2">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-6 h-10">{plan.description}</p>
                  <div className="mb-6">
                    <span className="text-4xl font-extrabold text-foreground">Rp{plan.price.toLocaleString("id-ID")}</span>
                    <span className="text-sm text-muted-foreground">/{plan.interval}</span>
                  </div>
                  <ul className="space-y-4 mb-8 flex-1">
                    {plan.features?.map((feat: string, j: number) => (
                      <li key={j} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-sm text-muted-foreground">{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/register">
                    <Button
                      className={`w-full h-12 rounded-none font-bold ${plan.isPopular
                        ? "bg-primary hover:bg-primary/90 text-white"
                        : "bg-muted text-foreground hover:bg-muted/80"
                        }`}
                    >
                      {plan.cta || "Get Started"}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── WORKFLOW ─────────────────────────────────────────── */}
      {workflow.length > 0 && (
        <section id="workflow" className="py-24 bg-card border-t border-border scroll-mt-24">
          <div className="container px-6 max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">How It Works</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">
                From schema to live API in minutes
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {workflow.map((step: any, i: number) => {
                const Icon = iconMap[step.icon] || Sparkles
                return (
                  <div key={i} className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {step.step || i + 1}
                      </div>
                      <div className="h-px flex-1 bg-border hidden md:block" />
                    </div>
                    <Icon className="w-5 h-5 text-muted-foreground mb-3" />
                    <h3 className="font-bold text-foreground mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}



      {/* ── ADD-ONS ──────────────────────────────────────────── */}
      {addons.length > 0 && (
        <section id="addons" className="py-24 bg-card border-t border-border scroll-mt-24">
          <div className="container px-6 max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Add-ons</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">
                Supercharge Your Workspace
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
              {addons.map((addon: any, i: number) => {
                const Icon = iconMap[addon.icon] || Sparkles
                return (
                  <div key={i} className="p-6 bg-card flex items-start gap-4">
                    <div className="w-10 h-10 bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-foreground">{addon.name}</h3>
                        {addon.price > 0 && (
                          <span className="text-sm font-bold text-primary">
                            Rp {new Intl.NumberFormat("id-ID").format(addon.price)}
                            {addon.unit && <span className="text-xs text-muted-foreground font-normal">/{addon.unit}</span>}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{addon.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── TESTIMONIALS ─────────────────────────────────────── */}
      {testimonials.length > 0 && (
        <section id="testimonials" className="py-24 bg-background border-t border-border">
          <div className="container px-6 max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Testimonials</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">
                Loved by Developers
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
              {testimonials.map((t: any, i: number) => (
                <div key={i} className="p-8 bg-card">
                  <Quote className="w-6 h-6 text-primary/40 mb-4" />
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6">{t.content}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-muted flex items-center justify-center font-bold text-foreground text-sm shrink-0">
                      {t.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}{t.company ? `, ${t.company}` : ""}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── ABOUT ────────────────────────────────────────────── */}
      {about && (
        <section id="about" className="py-24 bg-card border-t border-border">
          <div className="container px-6 max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1 space-y-6">
              <p className="text-xs font-bold text-primary uppercase tracking-widest">About</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">{about.title}</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">{about.description}</p>
              {about.mission && (
                <blockquote className="border-l-2 border-primary pl-4 text-sm italic text-muted-foreground">
                  {about.mission}
                </blockquote>
              )}
            </div>
            <div className="flex-1 grid grid-cols-2 gap-4">
              {[
                { label: "Founded", value: about.founded || "2024" },
                { label: "Architecture", value: "Multi-Tenant" },
                { label: "API Protocols", value: "REST + GraphQL" },
                { label: "Storage", value: "Cloudflare R2" },
              ].map((item) => (
                <div key={item.label} className="p-6 border border-border bg-background">
                  <p className="text-2xl font-extrabold text-foreground">{item.value}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wider">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── TEAM / OWNERS ────────────────────────────────────── */}
      {owners.length > 0 && (
        <section id="team" className="py-24 bg-card border-t border-border">
          <div className="container px-6 max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">The Team</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
                Meet the Builders
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {owners.map((owner: any, i: number) => (
                <div key={i} className="flex flex-col items-center text-center p-6 border border-border bg-background">
                  <div className="w-24 h-24 rounded-full overflow-hidden mb-4 border-2 border-primary">
                    <img
                      src={owner.avatar_url || "https://i.pravatar.cc/150"}
                      alt={owner.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-1">{owner.name}</h3>
                  <p className="text-sm font-semibold text-primary mb-4">{owner.role}</p>
                  <p className="text-sm text-muted-foreground mb-6 line-clamp-3">{owner.bio}</p>
                  {owner.linkedin && (
                    <a href={owner.linkedin} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
                      </svg>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ──────────────────────────────────────────────── */}
      {faq.length > 0 && (
        <section id="faq" className="py-24 bg-background border-t border-border">
          <div className="container px-6 max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">FAQ</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">
                Frequently asked questions
              </h2>
            </div>

            <div className="divide-y divide-border border border-border">
              {faq.map((item: any, i: number) => (
                <div key={i}>
                  <button
                    className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span className="font-semibold text-foreground pr-4">{item.question}</span>
                    {openFaq === i
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    }
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-6 text-sm text-muted-foreground leading-relaxed border-t border-border pt-4">
                      {item.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── LOCAL PRIDE ────────────────────────────────────── */}
      <section className="py-24 bg-card border-t border-border overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/10 via-transparent to-indigo-500/5 pointer-events-none" />
        <div className="container px-6 max-w-5xl mx-auto text-center relative z-10">
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-4">Local Pride</p>
          <h2 className="text-4xl md:text-5xl font-black text-foreground mb-6">
            Made in Papua.<br/>Engineered for the World.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
            SaCMS lahir dari sebuah visi bahwa inovasi teknologi tingkat tinggi (Enterprise-Grade) bisa dirakit dan dikembangkan dari Timur Indonesia. Kami membangun infrastruktur digital kelas dunia untuk mendukung percepatan teknologi lokal hingga global.
          </p>
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────────── */}
      <section className="py-20 bg-primary border-t border-primary/90">
        <div className="container px-6 max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
            Ready to build something great?
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl mx-auto">
            Start for free. No credit card required. Upgrade when you need more.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="h-12 px-10 bg-white text-primary hover:bg-primary/10 rounded-none font-bold">
                Get Started Free
              </Button>
            </Link>
            <Link href="/docs">
              <Button size="lg" variant="outline" className="h-12 px-10 rounded-none border-white text-white hover:bg-primary/90 font-semibold">
                Read the Docs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="py-12 bg-card border-t border-border">
        <div className="container px-6 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-5 h-5 text-primary" />
                <span className="font-extrabold text-lg text-foreground">SaCMS</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                The modern headless CMS for Southeast Asia.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-sm">
              <div>
                <p className="font-bold text-foreground mb-3 text-xs uppercase tracking-wider">Product</p>
                <div className="space-y-2">
                  <Link href="/#features" className="block text-muted-foreground hover:text-foreground transition-colors">Features</Link>
                  <Link href="/#pricing" className="block text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
                  <Link href="/#addons" className="block text-muted-foreground hover:text-foreground transition-colors">Add-ons</Link>
                </div>
              </div>
              <div>
                <p className="font-bold text-foreground mb-3 text-xs uppercase tracking-wider">Company</p>
                <div className="space-y-2">
                  <Link href="/#about" className="block text-muted-foreground hover:text-foreground transition-colors">About</Link>
                  <Link href="/#testimonials" className="block text-muted-foreground hover:text-foreground transition-colors">Testimonials</Link>
                  <Link href="/#faq" className="block text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
                </div>
              </div>
              <div>
                <p className="font-bold text-foreground mb-3 text-xs uppercase tracking-wider">Developers</p>
                <div className="space-y-2">
                  <Link href="/docs" className="block text-muted-foreground hover:text-foreground transition-colors">Documentation</Link>
                  <Link href="/login" className="block text-muted-foreground hover:text-foreground transition-colors">Admin Login</Link>
                  <Link href="/register" className="block text-muted-foreground hover:text-foreground transition-colors">Register</Link>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} SaCMS. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              Built with Next.js · Prisma · Cloudflare R2 · Midtrans
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
