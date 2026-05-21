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

const iconMap: Record<string, any> = {
  Sparkles, Cpu, Layout, Zap, Webhook, Languages, GitBranch, Shield, Globe, Database,
  Brain, CreditCard, PenLine, FileEdit, Code2, Rocket, Bot, MessageCircle,
}

interface LandingData {
  hero: any
  features: any[]
  pricing: any[]
  addons: any[]
  workflow: any[]
  faq: any[]
  about: any
  owners: any[]
  testimonials: any[]
  whatsapp: any
}

const DEFAULT_HERO = {
  headline: "The Modern Headless CMS for Startups & Enterprises",
  subheadline: "Build, manage, and deliver content anywhere — with built-in multi-tenancy, billing, AI generation, and enterprise-grade security.",
  cta_primary: "Get Started Free",
  cta_secondary: "View Documentation",
  badge_text: "🚀 Now in Beta",
}

const DEFAULT_FEATURES = [
  { icon: "Database", title: "Multi-Tenant Architecture", description: "Every workspace is completely isolated — data, API keys, webhooks, and roles." },
  { icon: "Zap", title: "Headless API-First", description: "REST + GraphQL APIs with advanced filtering, full-text search, and relation population." },
  { icon: "Brain", title: "AI Content Generation", description: "Generate structured content with DeepSeek AI. Works with your custom schemas." },
  { icon: "Shield", title: "Enterprise Security", description: "RBAC, audit logs, rate limiting, sync hooks, custom domains — production-ready." },
  { icon: "CreditCard", title: "Built-in Billing", description: "Midtrans-powered subscriptions with plan limits and invoice tracking." },
  { icon: "Globe", title: "i18n & Localization", description: "Full multi-language support with locale-aware content APIs." },
]

const DEFAULT_PRICING = [
  { name: "Free", price: 0, period: "forever", description: "For personal projects.", features: ["3 Content Types", "1,000 API req/month", "100MB Storage"], is_popular: false, cta_text: "Get Started", cta_href: "/register" },
  { name: "Pro", price: 299000, period: "month", description: "For growing teams.", features: ["Unlimited Content Types", "500K API req/month", "50GB Storage", "AI Generation"], is_popular: true, cta_text: "Go Pro", cta_href: "/register" },
  { name: "Enterprise", price: 999000, period: "month", description: "For mission-critical apps.", features: ["Everything in Pro", "Dedicated Database", "SLA 99.9%", "Dedicated Support"], is_popular: false, cta_text: "Contact Sales", cta_href: "/register" },
]

const DEFAULT_WORKFLOW = [
  { step: 1, title: "Define Your Schema", description: "Create content types with the visual schema builder.", icon: "PenLine" },
  { step: 2, title: "Create & Manage Content", description: "Use the built-in dashboard. Workflows, approval, scheduling included.", icon: "FileEdit" },
  { step: 3, title: "Consume via API", description: "Fetch via REST or GraphQL with advanced filtering.", icon: "Code2" },
  { step: 4, title: "Go Live", description: "Deploy to Vercel, Cloudflare, or any platform.", icon: "Rocket" },
]

function formatRupiah(price: number) {
  if (price === 0) return "Free"
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price)
}

export function ModernLanding({ data }: { data: LandingData }) {
  const hero     = data.hero || DEFAULT_HERO
  const features = data.features?.length ? data.features : DEFAULT_FEATURES
  const pricing  = data.pricing?.length  ? data.pricing  : DEFAULT_PRICING
  const workflow = data.workflow?.length  ? data.workflow  : DEFAULT_WORKFLOW
  const faq      = data.faq?.length      ? data.faq      : []
  const testimonials = data.testimonials?.length ? data.testimonials : []
  const about    = data.about
  const addons   = data.addons?.length   ? data.addons   : []

  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="bg-card text-foreground selection:bg-orange-500/30">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="min-h-[90vh] flex items-center justify-center pt-32 pb-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="container px-6 max-w-5xl mx-auto text-center space-y-8 relative">
          {hero.badge_text && (
            <span className="inline-block px-4 py-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-semibold tracking-wide mb-2">
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
                  <span className="text-orange-500">{accent}</span>
                </>
              )
            })()}
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {hero.subheadline}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href={hero.cta_href || "/register"}>
              <Button size="lg" className="h-12 px-10 bg-orange-500 hover:bg-orange-600 text-white rounded-none font-semibold">
                {hero.cta_primary || "Get Started"}
              </Button>
            </Link>
            <Link href="/docs">
              <Button size="lg" variant="outline" className="h-12 px-10 rounded-none border-border font-semibold">
                {hero.cta_secondary || "Documentation"}
              </Button>
            </Link>
          </div>

          {/* Stats strip */}
          <div className="flex flex-wrap justify-center gap-8 pt-12 border-t border-border mt-12">
            {[
              { label: "Tenants Supported", value: "∞" },
              { label: "API Protocols", value: "REST + GraphQL" },
              { label: "Payment Provider", value: "Midtrans" },
              { label: "Storage", value: "Cloudflare R2" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-background border-t border-border">
        <div className="container px-6 max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">
              Everything you need, nothing you don&apos;t
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {features.map((feature: any, i: number) => {
              const Icon = iconMap[feature.icon] || Sparkles
              return (
                <div key={i} className="p-8 bg-card hover:bg-background transition-colors">
                  <div className="w-10 h-10 bg-orange-500/10 flex items-center justify-center mb-6">
                    <Icon className="w-5 h-5 text-orange-500" />
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── WORKFLOW ─────────────────────────────────────────── */}
      {workflow.length > 0 && (
        <section id="workflow" className="py-24 bg-card border-t border-border">
          <div className="container px-6 max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">How It Works</p>
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
                      <div className="w-8 h-8 bg-orange-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
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

      {/* ── PRICING ──────────────────────────────────────────── */}
      <section id="pricing" className="py-24 bg-background border-t border-border">
        <div className="container px-6 max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">
              Simple, transparent pricing
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-border">
            {pricing.map((plan: any, i: number) => (
              <div
                key={i}
                className={`relative flex flex-col p-8 ${
                  plan.is_popular
                    ? "bg-orange-500 text-white"
                    : "bg-card text-foreground"
                } ${i < pricing.length - 1 ? "border-r border-border" : ""}`}
              >
                {plan.is_popular && (
                  <div className="absolute top-4 right-4 text-[10px] font-bold bg-white text-orange-500 px-2 py-0.5">
                    POPULAR
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-extrabold mb-1">{plan.name}</h3>
                  <p className={`text-sm ${plan.is_popular ? "text-orange-100" : "text-muted-foreground"}`}>
                    {plan.description}
                  </p>
                </div>

                <div className="mb-8">
                  <div className="flex items-baseline gap-1">
                    {plan.price === 0 || plan.price === "0" ? (
                      <span className="text-4xl font-extrabold">Free</span>
                    ) : (
                      <>
                        <span className="text-sm font-medium">Rp</span>
                        <span className="text-4xl font-extrabold">
                          {new Intl.NumberFormat("id-ID").format(Number(plan.price))}
                        </span>
                      </>
                    )}
                  </div>
                  {plan.period && plan.price !== 0 && (
                    <p className={`text-xs mt-1 ${plan.is_popular ? "text-orange-100" : "text-muted-foreground"}`}>
                      per {plan.period}
                    </p>
                  )}
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {(Array.isArray(plan.features) ? plan.features : []).map((f: string, fi: number) => (
                    <li key={fi} className="flex items-start gap-2 text-sm">
                      <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.is_popular ? "text-white" : "text-orange-500"}`} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link href={plan.cta_href || "/register"}>
                  <Button
                    className={`w-full rounded-none font-semibold h-11 ${
                      plan.is_popular
                        ? "bg-white text-orange-500 hover:bg-orange-50"
                        : "bg-orange-500 hover:bg-orange-600 text-white"
                    }`}
                  >
                    {plan.cta_text || "Get Started"}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ADD-ONS ──────────────────────────────────────────── */}
      {addons.length > 0 && (
        <section id="addons" className="py-24 bg-card border-t border-border">
          <div className="container px-6 max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">Add-ons</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">
                Supercharge your workspace
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border">
              {addons.map((addon: any, i: number) => {
                const Icon = iconMap[addon.icon] || Sparkles
                return (
                  <div key={i} className="p-6 bg-card flex items-start gap-4">
                    <div className="w-10 h-10 bg-orange-500/10 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-foreground">{addon.name}</h3>
                        {addon.price > 0 && (
                          <span className="text-sm font-bold text-orange-500">
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
              <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">Testimonials</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">
                Loved by developers
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
              {testimonials.map((t: any, i: number) => (
                <div key={i} className="p-8 bg-card">
                  <Quote className="w-6 h-6 text-orange-500/40 mb-4" />
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
              <p className="text-xs font-bold text-orange-500 uppercase tracking-widest">About</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-foreground">{about.title}</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">{about.description}</p>
              {about.mission && (
                <blockquote className="border-l-2 border-orange-500 pl-4 text-sm italic text-muted-foreground">
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

      {/* ── FAQ ──────────────────────────────────────────────── */}
      {faq.length > 0 && (
        <section id="faq" className="py-24 bg-background border-t border-border">
          <div className="container px-6 max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">FAQ</p>
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

      {/* ── CTA BANNER ───────────────────────────────────────── */}
      <section className="py-20 bg-orange-500 border-t border-orange-600">
        <div className="container px-6 max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
            Ready to build something great?
          </h2>
          <p className="text-orange-100 text-lg mb-8 max-w-xl mx-auto">
            Start for free. No credit card required. Upgrade when you need more.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="h-12 px-10 bg-white text-orange-500 hover:bg-orange-50 rounded-none font-bold">
                Get Started Free
              </Button>
            </Link>
            <Link href="/docs">
              <Button size="lg" variant="outline" className="h-12 px-10 rounded-none border-white text-white hover:bg-orange-600 font-semibold">
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
                <Database className="w-5 h-5 text-orange-500" />
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
                  <Link href="/#pricing"  className="block text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
                  <Link href="/#addons"   className="block text-muted-foreground hover:text-foreground transition-colors">Add-ons</Link>
                </div>
              </div>
              <div>
                <p className="font-bold text-foreground mb-3 text-xs uppercase tracking-wider">Company</p>
                <div className="space-y-2">
                  <Link href="/#about"        className="block text-muted-foreground hover:text-foreground transition-colors">About</Link>
                  <Link href="/#testimonials" className="block text-muted-foreground hover:text-foreground transition-colors">Testimonials</Link>
                  <Link href="/#faq"          className="block text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
                </div>
              </div>
              <div>
                <p className="font-bold text-foreground mb-3 text-xs uppercase tracking-wider">Developers</p>
                <div className="space-y-2">
                  <Link href="/docs"     className="block text-muted-foreground hover:text-foreground transition-colors">Documentation</Link>
                  <Link href="/login"    className="block text-muted-foreground hover:text-foreground transition-colors">Admin Login</Link>
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
