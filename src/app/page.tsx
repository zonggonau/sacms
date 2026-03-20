import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Database, 
  Code2, 
  Users, 
  Zap, 
  Shield, 
  Globe, 
  Layers,
  ArrowRight,
  Check,
  GitBranch,
  Languages,
  Search,
  Webhook,
  Cloud,
  Terminal,
  FileCode2,
  X,
} from "lucide-react"
import Link from "next/link"
import { LandingHeader } from "@/components/landing/header"
import { WhatsAppButton } from "@/components/landing/whatsapp-button"
import { db } from "@/lib/database"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"

// Map icons to slugs
const iconMap: Record<string, any> = {
  GitBranch,
  Languages,
  Users,
  Code2,
  Search,
  Cloud,
  Webhook,
  Terminal,
  Shield,
  Zap,
}

// Utility to strip HTML tags and entities
function stripHtml(html: string) {
  if (!html) return ""
  return html
    .replace(/<[^>]*>?/gm, '') // Remove tags
    .replace(/&nbsp;/g, ' ')   // Replace non-breaking spaces with regular spaces
    .replace(/&amp;/g, '&')    // Replace & entity
    .replace(/&quot;/g, '"')   // Replace " entity
    .replace(/\s+/g, ' ')      // Collapse multiple spaces into one
    .trim()
}

async function getLandingData() {
  const tenant = await db.tenant.findFirst()
  if (!tenant) return null

  // Fetch specific types from the first (system) tenant
  const systemEntries = await db.contentEntry.findMany({
    where: {
      tenantId: tenant.id,
      status: "PUBLISHED",
      contentType: {
        slug: { in: ["lp-config", "platform-features", "platform-testimonials", "startup-blog", "platform-contact", "platform-whatsapp"] }
      }
    },
    include: {
      contentType: true
    },
    orderBy: { createdAt: "desc" }
  })

  // Fetch pricing from ANY tenant (since they might be created in different ones during setup)
  const pricingEntries = await db.contentEntry.findMany({
    where: {
      status: "PUBLISHED",
      contentType: {
        slug: "platform-pricing"
      }
    },
    include: {
      contentType: true
    },
    orderBy: { createdAt: "asc" } // Sort by creation time to maintain order
  })

  const entries = [...systemEntries, ...pricingEntries]

  // Parse JSON data for each entry
  const parsedEntries = entries.map(e => ({
    ...e,
    data: typeof e.data === 'string' ? JSON.parse(e.data) : e.data
  }))

  return {
    hero: parsedEntries.find(e => e.contentType.slug === "lp-config")?.data as any,
    features: parsedEntries.filter(e => e.contentType.slug === "platform-features").map(e => e.data) as any[],
    pricing: parsedEntries.filter(e => e.contentType.slug === "platform-pricing").map(e => e.data) as any[],
    testimonials: parsedEntries.filter(e => e.contentType.slug === "platform-testimonials").map(e => e.data) as any[],
    blog: parsedEntries.filter(e => e.contentType.slug === "startup-blog").slice(0, 3).map(e => e.data) as any[],
    contact: parsedEntries.find(e => e.contentType.slug === "platform-contact")?.data as any,
    whatsapp: parsedEntries.find(e => e.contentType.slug === "platform-whatsapp")?.data as any,
  }
}

const apiExample = `// Install: npm install @contentflow/sdk

import { ContentFlow } from '@contentflow/sdk'

const cf = new ContentFlow({
  baseUrl: 'https://api.contentflow.dev',
  tenant: 'my-workspace',
  token: 'cf_xxxxx',
})

// Type-safe queries with filtering
const articles = await cf.collection('articles').findMany({
  filters: {
    category: { $eq: 'tutorial' },
    status: { $eq: 'published' },
  },
  populate: ['author', 'tags'],
  locale: 'id',
  sort: 'createdAt:desc',
})`

export default async function HomePage() {
  const cmsData = await getLandingData()

  // Fallback if no data in CMS
  const hero = cmsData?.hero || {
    hero_title: "The Headless CMS Strapi Can't Be",
    hero_subtitle: "Native multi-tenancy, content workflow, i18n, and billing built-in. REST + GraphQL APIs with advanced filtering. Deploy in minutes.",
    cta_text: "Start Building Free",
    cta_link: "/register"
  }

  const features = (cmsData?.features || []).length > 0 ? cmsData!.features : [
    { title: "Multi-Tenant Native", description: "Isolated workspaces per team. No plugins needed.", icon: "Users", tag: "Unique" },
    { title: "Content Workflow", description: "Draft → Review → Publish workflow.", icon: "GitBranch", tag: "Core" },
    { title: "REST + GraphQL", description: "Auto-generated APIs with filtering.", icon: "Code2", tag: "API" },
  ]

  const pricingPlans = (cmsData?.pricing || []).length > 0 ? cmsData!.pricing.map(p => {
    let featuresArray: string[] = []
    const rawFeatures = p.features

    try {
      if (!rawFeatures) {
        featuresArray = []
      } else if (Array.isArray(rawFeatures)) {
        featuresArray = rawFeatures
      } else if (typeof rawFeatures === 'string') {
        const trimmed = rawFeatures.trim()
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
          const parsed = JSON.parse(trimmed)
          featuresArray = Array.isArray(parsed) ? parsed : []
        } else {
          // Kasus teks biasa: "Fitur A, Fitur B, Fitur C"
          featuresArray = trimmed.split(',').map(f => f.trim()).filter(Boolean)
        }
      }
    } catch (e) {
      console.warn("Failed to parse features for:", p.name, e)
      featuresArray = []
    }

    // Fix NaNK logic
    const rawPrice = typeof p.price === 'string' ? parseFloat(p.price) : p.price
    const numericPrice = isNaN(rawPrice as number) ? 0 : (rawPrice as number)

    return {
      ...p,
      price: numericPrice,
      features: featuresArray
    }
  }).sort((a, b) => a.price - b.price) : [
    { name: "Starter", price: 0, description: "Side projects", features: ["1 Workspace", "Basic Support"], is_popular: false, buttonText: "Start Free" }
  ]

  const heroTitle = hero?.hero_title || "The Headless CMS Strapi Can't Be"
  const heroSubtitle = hero?.hero_subtitle || "Native multi-tenancy, content workflow, i18n, and billing built-in. REST + GraphQL APIs with advanced filtering. Deploy in minutes."

  return (
    <div className="min-h-screen flex flex-col">
      <LandingHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/80 via-background to-background dark:from-emerald-950/20 dark:via-background" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.12),transparent)]" />

          <div className="container relative pt-20 pb-16 md:pt-32 md:pb-24">
            <div className="flex flex-col items-center text-center space-y-6 max-w-3xl mx-auto">
              <div className="flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur px-4 py-1.5 text-sm">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-muted-foreground">Multi-tenant native &middot; Content workflow &middot; i18n built-in</span>
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
                {heroTitle.split(" ").slice(0, -3).join(" ")}{" "}
                <span className="bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">
                  {heroTitle.split(" ").slice(-3).join(" ")}
                </span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                {stripHtml(heroSubtitle)}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link href={hero.cta_link || "/register"}>
                  <Button size="lg" className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 px-8 h-12 text-base">
                    {hero.cta_text}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/docs">
                  <Button size="lg" variant="outline" className="px-8 h-12 text-base">
                    <FileCode2 className="w-4 h-4 mr-2" />
                    API Docs
                  </Button>
                </Link>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground pt-2">
                {["Free tier available", "No credit card required", "< 200ms API response"].map((item) => (
                  <div key={item} className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Dashboard Preview or Uploaded Image */}
            <div className="mt-16 relative max-w-5xl mx-auto">
              <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-2xl blur-3xl opacity-30" />
              
              {hero.hero_image ? (
                <div className="relative rounded-xl border shadow-2xl overflow-hidden bg-card">
                  <img 
                    src={typeof hero.hero_image === 'string' ? hero.hero_image : (hero.hero_image as any).url} 
                    alt="Dashboard Preview" 
                    className="w-full h-auto object-cover"
                  />
                </div>
              ) : (
                /* Hardcoded Fake Dashboard UI */
                <div className="relative rounded-xl border shadow-2xl overflow-hidden bg-card">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/50">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                      <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-1 text-xs text-muted-foreground">
                        <Globe className="w-3 h-3" />
                        app.contentflow.dev/dashboard
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-[200px_1fr] min-h-[360px]">
                    {/* Fake sidebar */}
                    <div className="border-r bg-muted/30 p-3 space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center">
                          <Database className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="text-xs font-semibold">My Workspace</div>
                      </div>
                      {["Dashboard", "Collections", "Single Types", "Media", "Localization"].map((item, i) => (
                        <div key={item} className={`text-xs px-2 py-1.5 rounded ${i === 1 ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground'}`}>
                          {item}
                        </div>
                      ))}
                      <div className="border-t pt-3 mt-3">
                        <div className="text-[10px] font-semibold text-muted-foreground mb-2 px-2">DEVELOPER</div>
                        {["API Tokens", "Webhooks", "SDK"].map((item) => (
                          <div key={item} className="text-xs px-2 py-1.5 text-muted-foreground">{item}</div>
                        ))}
                      </div>
                    </div>
                    {/* Fake content */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold">Articles</div>
                          <div className="text-[10px] text-muted-foreground">12 entries · 8 fields</div>
                        </div>
                        <div className="flex gap-1.5">
                          <div className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-full px-2 py-0.5">Published 8</div>
                          <div className="text-[10px] bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 rounded-full px-2 py-0.5">In Review 2</div>
                          <div className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full px-2 py-0.5">Draft 2</div>
                        </div>
                      </div>
                      <div className="rounded-md border text-xs">
                        <div className="grid grid-cols-[1fr_100px_80px_80px] gap-2 px-3 py-2 bg-muted/50 font-medium text-muted-foreground border-b">
                          <div>Title</div><div>Status</div><div>Locale</div><div>Updated</div>
                        </div>
                        {[
                          { title: "Getting Started with Next.js", status: "Published", statusColor: "text-emerald-600", locale: "en", date: "2h ago" },
                          { title: "Panduan API REST", status: "In Review", statusColor: "text-yellow-600", locale: "id", date: "5h ago" },
                          { title: "GraphQL Mutations Guide", status: "Draft", statusColor: "text-gray-500", locale: "en", date: "1d ago" },
                        ].map((row) => (
                          <div key={row.title} className="grid grid-cols-[1fr_100px_80px_80px] gap-2 px-3 py-2 border-b last:border-0 items-center">
                            <div className="font-medium truncate">{row.title}</div>
                            <div className={row.statusColor}>{row.status}</div>
                            <div><span className="bg-muted rounded px-1.5 py-0.5 text-[10px]">{row.locale}</span></div>
                            <div className="text-muted-foreground">{row.date}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 md:py-28">
          <div className="container">
            <div className="text-center mb-14">
              <Badge variant="secondary" className="mb-3">Features</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-3">
                Built for the modern content stack
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((feature, index) => {
                const Icon = iconMap[feature.icon] || Zap
                return (
                  <Card key={index} className="group hover:shadow-md hover:border-emerald-500/30 transition-all duration-200">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:from-emerald-500 group-hover:to-teal-600 transition-all duration-200">
                          <Icon className="w-5 h-5 text-emerald-600 group-hover:text-white transition-colors duration-200" />
                        </div>
                        {feature.tag && <Badge variant="outline" className="text-[10px] h-5">{feature.tag}</Badge>}
                      </div>
                      <CardTitle className="text-base">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm leading-relaxed">
                        {stripHtml(feature.description)}
                      </CardDescription>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20 md:py-28 bg-muted/30">
          {/* ... existing pricing content ... */}
          <div className="container">
            <div className="text-center mb-14">
              <Badge variant="secondary" className="mb-3">Pricing</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-3">
                Simple, transparent pricing
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {pricingPlans.map((plan, index) => (
                <Card
                  key={index}
                  className={`relative ${plan.is_popular ? 'border-emerald-500 shadow-lg shadow-emerald-500/10 scale-[1.02]' : ''}`}
                >
                  {plan.is_popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-600 shadow-sm">
                      Most Popular
                    </Badge>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <div className="mt-3">
                      <span className="text-3xl font-bold">
                        {plan.price === 0 ? "Free" : `Rp ${(plan.price).toLocaleString('id-ID')}`}
                      </span>
                      {plan.price > 0 && <span className="text-muted-foreground text-sm">/mo</span>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-2.5">
                      {(plan.features || []).map((feature: string, fi: number) => (
                        <li key={fi} className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href="/register" className="block pt-2">
                      <Button
                        className={`w-full ${plan.is_popular ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700' : ''}`}
                        variant={plan.is_popular ? "default" : "outline"}
                      >
                        {plan.buttonText || "Get Started"}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        {(cmsData?.testimonials || []).length > 0 && (
          <section className="py-20 md:py-28">
            <div className="container">
              <div className="text-center mb-14">
                <Badge variant="secondary" className="mb-3">Testimonials</Badge>
                <h2 className="text-3xl md:text-4xl font-bold">Trusted by founders</h2>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {cmsData!.testimonials.map((t, i) => (
                  <Card key={i} className="bg-muted/20 border-none">
                    <CardContent className="pt-6">
                      <div className="flex gap-1 mb-4">
                        {[...Array(t.rating || 5)].map((_, star) => (
                          <Zap key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <p className="italic text-muted-foreground mb-6">"{t.quote}"</p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                          {t.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.company}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Blog Section */}
        {(cmsData?.blog || []).length > 0 && (
          <section id="blog" className="py-20 md:py-28 bg-muted/30">
            <div className="container">
              <div className="flex items-center justify-between mb-12">
                <div>
                  <Badge variant="secondary" className="mb-3">Blog</Badge>
                  <h2 className="text-3xl md:text-4xl font-bold">Latest from our ecosystem</h2>
                </div>
                <Button variant="ghost" asChild>
                  <Link href="/blog">View All Posts <ArrowRight className="ml-2 w-4 h-4" /></Link>
                </Button>
              </div>
              <div className="grid md:grid-cols-3 gap-8">
                {cmsData!.blog.map((post, i) => (
                  <Link key={i} href={`/blog/${post.slug}`} className="group">
                    <div className="aspect-video rounded-xl bg-muted mb-4 overflow-hidden">
                      {/* Placeholder for image */}
                      <div className="w-full h-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                        <Database className="w-8 h-8 text-emerald-500/40" />
                      </div>
                    </div>
                    <h3 className="font-bold text-xl group-hover:text-primary transition-colors">{post.title}</h3>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{post.excerpt}</p>
                    <div className="flex items-center gap-2 mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <span>By {post.author}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Contact & Footer */}
        <section className="py-20 md:py-28 border-t">
          <div className="container">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">Let's talk about your project</h2>
                <p className="text-muted-foreground mb-8">Have questions about multi-tenancy, custom plans, or migration? Our team is here to help.</p>
                {cmsData?.contact && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><Globe className="w-5 h-5" /></div>
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase">Address</p>
                        <p className="text-sm">{cmsData.contact.address}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><Shield className="w-5 h-5" /></div>
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase">Email</p>
                        <p className="text-sm">{cmsData.contact.email}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-8 bg-card border rounded-2xl shadow-sm">
                <form className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><label className="text-xs font-bold">Name</label><input className="w-full h-10 rounded-lg bg-muted/50 border-none px-3 text-sm" placeholder="John" /></div>
                    <div className="space-y-2"><label className="text-xs font-bold">Email</label><input className="w-full h-10 rounded-lg bg-muted/50 border-none px-3 text-sm" placeholder="john@example.com" /></div>
                  </div>
                  <div className="space-y-2"><label className="text-xs font-bold">Message</label><textarea className="w-full rounded-lg bg-muted/50 border-none p-3 text-sm" rows={4} placeholder="Tell us about your startup..." /></div>
                  <Button className="w-full bg-primary font-bold">Send Message</Button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer (Static for now) */}
      <footer className="border-t">
        <div className="container py-10">
          <p className="text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} ContentFlow. Powered by its own CMS.
          </p>
        </div>
      </footer>

      {cmsData?.whatsapp && (
        <WhatsAppButton 
          phone={cmsData.whatsapp.phone}
          message={stripHtml(cmsData.whatsapp.message)}
          label={stripHtml(cmsData.whatsapp.label)}
          isActive={cmsData.whatsapp.is_active}
        />
      )}
    </div>
  )
}
