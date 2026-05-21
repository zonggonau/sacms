import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

const GLOBAL_SLUG = "sacms-global"

const CONTENT_TYPES = [
  {
    slug: "sacms-hero",
    name: "SaCMS Hero Section",
    description: "Hero banner for the landing page",
    isSingleType: false,
    fields: [
      { slug: "headline",    name: "Headline",    type: "text",     required: true, order: 0 },
      { slug: "subheadline", name: "Subheadline", type: "text",     required: false, order: 1 },
      { slug: "cta_primary", name: "CTA Primary", type: "text",     required: false, order: 2 },
      { slug: "cta_secondary", name: "CTA Secondary", type: "text", required: false, order: 3 },
      { slug: "badge_text",  name: "Badge Text",  type: "text",     required: false, order: 4 },
      { slug: "image_url",   name: "Image URL",   type: "text",     required: false, order: 5 },
    ],
  },
  {
    slug: "sacms-features",
    name: "SaCMS Features",
    description: "Feature cards on landing page",
    isSingleType: false,
    fields: [
      { slug: "icon",        name: "Icon",        type: "text", required: false, order: 0 },
      { slug: "title",       name: "Title",       type: "text", required: true,  order: 1 },
      { slug: "description", name: "Description", type: "text", required: false, order: 2 },
      { slug: "color",       name: "Color",       type: "text", required: false, order: 3 },
    ],
  },
  {
    slug: "sacms-pricing",
    name: "SaCMS Pricing Plans",
    description: "Pricing tiers displayed on landing page",
    isSingleType: false,
    fields: [
      { slug: "name",        name: "Plan Name",     type: "text",    required: true,  order: 0 },
      { slug: "price",       name: "Price",         type: "number",  required: true,  order: 1 },
      { slug: "period",      name: "Period",        type: "text",    required: false, order: 2 },
      { slug: "description", name: "Description",   type: "text",    required: false, order: 3 },
      { slug: "features",    name: "Features",      type: "json",    required: false, order: 4 },
      { slug: "is_popular",  name: "Is Popular",    type: "boolean", required: false, order: 5 },
      { slug: "cta_text",    name: "CTA Text",      type: "text",    required: false, order: 6 },
      { slug: "cta_href",    name: "CTA URL",       type: "text",    required: false, order: 7 },
    ],
  },
  {
    slug: "sacms-addons",
    name: "SaCMS Addons",
    description: "Optional add-on services",
    isSingleType: false,
    fields: [
      { slug: "icon",        name: "Icon",        type: "text",   required: false, order: 0 },
      { slug: "name",        name: "Name",        type: "text",   required: true,  order: 1 },
      { slug: "description", name: "Description", type: "text",   required: false, order: 2 },
      { slug: "price",       name: "Price",       type: "number", required: false, order: 3 },
      { slug: "unit",        name: "Unit",        type: "text",   required: false, order: 4 },
    ],
  },
  {
    slug: "sacms-workflow",
    name: "SaCMS Workflow Steps",
    description: "How-it-works workflow steps",
    isSingleType: false,
    fields: [
      { slug: "step",        name: "Step Number", type: "number", required: true,  order: 0 },
      { slug: "title",       name: "Title",       type: "text",   required: true,  order: 1 },
      { slug: "description", name: "Description", type: "text",   required: false, order: 2 },
      { slug: "icon",        name: "Icon",        type: "text",   required: false, order: 3 },
    ],
  },
  {
    slug: "sacms-faq",
    name: "SaCMS FAQ",
    description: "Frequently asked questions",
    isSingleType: false,
    fields: [
      { slug: "question", name: "Question", type: "text", required: true,  order: 0 },
      { slug: "answer",   name: "Answer",   type: "text", required: true,  order: 1 },
      { slug: "order",    name: "Order",    type: "number", required: false, order: 2 },
    ],
  },
  {
    slug: "sacms-testimonials",
    name: "SaCMS Testimonials",
    description: "Customer testimonials",
    isSingleType: false,
    fields: [
      { slug: "name",       name: "Name",       type: "text",   required: true,  order: 0 },
      { slug: "role",       name: "Role",       type: "text",   required: false, order: 1 },
      { slug: "company",    name: "Company",    type: "text",   required: false, order: 2 },
      { slug: "content",    name: "Content",    type: "text",   required: true,  order: 3 },
      { slug: "avatar_url", name: "Avatar URL", type: "text",   required: false, order: 4 },
      { slug: "rating",     name: "Rating",     type: "number", required: false, order: 5 },
    ],
  },
  {
    slug: "sacms-owners",
    name: "SaCMS Team/Owners",
    description: "Team member profiles",
    isSingleType: false,
    fields: [
      { slug: "name",       name: "Name",       type: "text", required: true,  order: 0 },
      { slug: "role",       name: "Role",       type: "text", required: false, order: 1 },
      { slug: "bio",        name: "Bio",        type: "text", required: false, order: 2 },
      { slug: "avatar_url", name: "Avatar URL", type: "text", required: false, order: 3 },
      { slug: "linkedin",   name: "LinkedIn",   type: "text", required: false, order: 4 },
    ],
  },
  {
    slug: "sacms-about",
    name: "SaCMS About Section",
    description: "About section content (single)",
    isSingleType: false,
    fields: [
      { slug: "title",       name: "Title",       type: "text", required: true,  order: 0 },
      { slug: "description", name: "Description", type: "text", required: false, order: 1 },
      { slug: "mission",     name: "Mission",     type: "text", required: false, order: 2 },
      { slug: "founded",     name: "Founded",     type: "text", required: false, order: 3 },
    ],
  },
  {
    slug: "sacms-whatsapp",
    name: "SaCMS WhatsApp Config",
    description: "WhatsApp floating button config (single)",
    isSingleType: false,
    fields: [
      { slug: "phone",     name: "Phone",     type: "text",    required: true,  order: 0 },
      { slug: "message",   name: "Message",   type: "text",    required: false, order: 1 },
      { slug: "label",     name: "Label",     type: "text",    required: false, order: 2 },
      { slug: "is_active", name: "Is Active", type: "boolean", required: false, order: 3 },
    ],
  },
]

const SEED_ENTRIES: Record<string, object[]> = {
  "sacms-hero": [
    {
      headline: "The Modern Headless CMS for Startups & Enterprises",
      subheadline: "Build, manage, and deliver content anywhere — with built-in multi-tenancy, billing, AI generation, and enterprise-grade security.",
      cta_primary: "Get Started Free",
      cta_secondary: "View Documentation",
      badge_text: "🚀 Now in Beta — Free for Early Adopters",
    },
  ],
  "sacms-features": [
    { icon: "Database", title: "Multi-Tenant Architecture", description: "Every workspace is completely isolated — data, API keys, webhooks, and roles.", color: "indigo" },
    { icon: "Zap", title: "Headless API-First", description: "REST + GraphQL APIs ready to use. Filter, search, populate relations, paginate — out of the box.", color: "blue" },
    { icon: "Brain", title: "AI Content Generation", description: "Generate structured content with DeepSeek AI. Works with your custom schemas.", color: "purple" },
    { icon: "Shield", title: "Enterprise Security", description: "RBAC, audit logs, rate limiting, sync hooks, custom domains — production-ready.", color: "slate" },
    { icon: "CreditCard", title: "Built-in Billing", description: "Midtrans-powered subscriptions with plan limits, upgrade flows, and invoice tracking.", color: "yellow" },
    { icon: "Globe", title: "i18n & Localization", description: "Full multi-language support with locale-aware content APIs and default locale management.", color: "teal" },
  ],
  "sacms-pricing": [
    { name: "Free", price: 0, period: "forever", description: "Perfect for personal projects and exploring the platform.", features: ["3 Content Types", "1,000 API requests/month", "100MB Storage", "Community Support"], is_popular: false, cta_text: "Get Started", cta_href: "/register" },
    { name: "Starter", price: 99000, period: "month", description: "For growing startups that need more power.", features: ["20 Content Types", "50,000 API requests/month", "5GB Storage", "Webhooks", "Email Support"], is_popular: false, cta_text: "Start Starter", cta_href: "/register" },
    { name: "Pro", price: 299000, period: "month", description: "For teams that need full control and customization.", features: ["Unlimited Content Types", "500,000 API requests/month", "50GB Storage", "AI Generation", "Priority Support", "Custom Domain"], is_popular: true, cta_text: "Go Pro", cta_href: "/register" },
    { name: "Enterprise", price: 999000, period: "month", description: "Dedicated infrastructure for mission-critical applications.", features: ["Everything in Pro", "Dedicated Database", "SLA 99.9%", "Custom Integrations", "Dedicated Account Manager"], is_popular: false, cta_text: "Contact Sales", cta_href: "https://wa.me/6281234567890" },
  ],
  "sacms-workflow": [
    { step: 1, title: "Define Your Schema", description: "Create content types, single types, and components with a powerful visual schema builder.", icon: "PenLine" },
    { step: 2, title: "Create & Manage Content", description: "Use the built-in CMS dashboard or your own interface. Workflows, approval, scheduling included.", icon: "FileEdit" },
    { step: 3, title: "Consume via API", description: "Fetch your content via REST or GraphQL with advanced filtering, full-text search, and relation population.", icon: "Code2" },
    { step: 4, title: "Go Live", description: "Deploy to Vercel, Cloudflare, or any platform. Scale automatically. Zero config needed.", icon: "Rocket" },
  ],
  "sacms-faq": [
    { question: "Is SaCMS really free?", answer: "Yes! The Free plan is completely free forever with no credit card required. You can upgrade when you need more capacity.", order: 1 },
    { question: "Can I use my own database?", answer: "Enterprise plan users can connect their own dedicated PostgreSQL database for full data isolation.", order: 2 },
    { question: "Does SaCMS support multiple languages?", answer: "Yes, full i18n support is built-in. Define locales per tenant and serve locale-aware content via API.", order: 3 },
    { question: "What payment methods are supported?", answer: "We use Midtrans which supports bank transfer, credit cards, GoPay, OVO, and many other Indonesian payment methods.", order: 4 },
    { question: "Is there a GraphQL API?", answer: "Yes! SaCMS auto-generates a GraphQL schema based on your content types, including queries and mutations.", order: 5 },
  ],
  "sacms-testimonials": [
    { name: "Ahmad Fauzi", role: "CTO", company: "TechStart ID", content: "SaCMS replaced our Strapi setup completely. Multi-tenancy and billing are built-in — no custom code needed.", rating: 5 },
    { name: "Sari Dewi", role: "Lead Developer", company: "Kreasi Digital", content: "The GraphQL API with DataLoader is blazing fast. Our Next.js frontend has never been this snappy.", rating: 5 },
    { name: "Budi Santoso", role: "Founder", company: "Nusantara Apps", content: "Finally a CMS that speaks Indonesian payment methods. Midtrans integration just works.", rating: 5 },
  ],
  "sacms-owners": [
    { name: "SaCMS Team", role: "Core Team", bio: "Building the future of headless content management for Southeast Asia.", avatar_url: "" },
  ],
  "sacms-about": [
    { title: "About SaCMS", description: "SaCMS is a modern, multi-tenant headless CMS built for the Southeast Asian market, with deep integration for local payment providers and enterprise-grade features.", mission: "To make world-class content infrastructure accessible to every startup and enterprise in Southeast Asia.", founded: "2024" },
  ],
  "sacms-whatsapp": [
    { phone: "6281234567890", message: "Halo! Saya tertarik dengan SaCMS. Bisakah saya mendapatkan informasi lebih lanjut?", label: "Chat dengan Kami", is_active: true },
  ],
  "sacms-addons": [
    { icon: "Bot", name: "AI Generation Pack", description: "10,000 extra AI content generation credits/month.", price: 49000, unit: "month" },
    { icon: "Database", name: "Extra Storage", description: "50GB additional storage for media and assets.", price: 29000, unit: "month" },
    { icon: "Zap", name: "API Boost", description: "500,000 extra API requests/month.", price: 39000, unit: "month" },
    { icon: "Shield", name: "Priority Security Scan", description: "Monthly security audit and compliance report.", price: 99000, unit: "month" },
  ],
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Auto-create sacms-global tenant if it doesn't exist yet
    let globalTenant = await db.tenant.findUnique({ where: { slug: GLOBAL_SLUG } })
    if (!globalTenant) {
      globalTenant = await db.tenant.create({
        data: {
          name: "SaCMS Global",
          slug: GLOBAL_SLUG,
          description: "Internal system tenant for landing page and global content. Hidden from regular tenant lists.",
          plan: "enterprise",
          status: "active",
        },
      })
    }

    const results: Record<string, { created: number; skipped: number }> = {}

    for (const ct of CONTENT_TYPES) {
      // Ensure content type exists
      let contentType = await db.contentType.findFirst({
        where: { slug: ct.slug, tenantId: globalTenant.id },
      })

      if (!contentType) {
        contentType = await db.contentType.create({
          data: {
            name: ct.name,
            slug: ct.slug,
            description: ct.description,
            tenantId: globalTenant.id,
            fields: {
              create: ct.fields.map((f) => ({
                name: f.name,
                slug: f.slug,
                type: f.type,
                required: f.required,
                order: f.order,
              })),
            },
          },
        })
      }

      // Seed entries (skip if already seeded)
      const seedData = SEED_ENTRIES[ct.slug]
      if (!seedData) {
        results[ct.slug] = { created: 0, skipped: 0 }
        continue
      }

      let created = 0
      let skipped = 0

      for (const entryData of seedData) {
        const existing = await db.contentEntry.findFirst({
          where: { tenantId: globalTenant.id, contentTypeId: contentType.id },
        })
        if (existing) {
          skipped++
          continue
        }

        await db.contentEntry.create({
          data: {
            tenantId: globalTenant.id,
            contentTypeId: contentType.id,
            status: "PUBLISHED",
            data: entryData,
            publishedAt: new Date(),
          },
        })
        created++
      }

      results[ct.slug] = { created, skipped }
    }

    return NextResponse.json({
      success: true,
      tenantCreated: !!(globalTenant),
      tenantId: globalTenant.id,
      tenantSlug: globalTenant.slug,
      results,
    })
  } catch (error) {
    console.error("Global seed error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const globalTenant = await db.tenant.findUnique({
      where: { slug: GLOBAL_SLUG },
      include: {
        contentTypes: {
          include: {
            contentEntries: {
              where: { status: "PUBLISHED" },
              select: { id: true, status: true, createdAt: true },
            },
          },
        },
      },
    })

    if (!globalTenant) {
      return NextResponse.json({ exists: false, message: "Global tenant not found. Run seed first." })
    }

    const summary = globalTenant.contentTypes.map((ct) => ({
      slug: ct.slug,
      name: ct.name,
      publishedEntries: ct.contentEntries.length,
    }))

    return NextResponse.json({
      exists: true,
      tenantId: globalTenant.id,
      tenantSlug: globalTenant.slug,
      contentTypes: summary,
    })
  } catch (error) {
    console.error("Global status error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
