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
    isSingleType: true,
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
    slug: "sacms-account-pricing",
    name: "SaCMS Account Plans",
    description: "Account tiers that govern workspace limits",
    isSingleType: false,
    fields: [
      { slug: "name",        name: "Plan Name",     type: "text",    required: true,  order: 0 },
      { slug: "plan_slug",   name: "Plan Slug",     type: "text",    required: true,  order: 1 },
      { slug: "price",       name: "Price",         type: "number",  required: true,  order: 2 },
      { slug: "period",      name: "Period",        type: "text",    required: false, order: 3 },
      { slug: "max_workspaces", name: "Max Workspaces", type: "number", required: true, order: 4 },
      { slug: "description", name: "Description",   type: "text",    required: false, order: 5 },
      { slug: "features",    name: "Features",      type: "json",    required: false, order: 6 },
      { slug: "is_popular",  name: "Is Popular",    type: "boolean", required: false, order: 7 },
      { slug: "cta_text",    name: "CTA Text",      type: "text",    required: false, order: 8 },
      { slug: "cta_href",    name: "CTA URL",       type: "text",    required: false, order: 9 },
    ],
  },
  {
    slug: "sacms-workspace-pricing",
    name: "SaCMS Workspace Plans",
    description: "Pricing tiers for individual workspaces",
    isSingleType: false,
    fields: [
      { slug: "name",        name: "Plan Name",     type: "text",    required: true,  order: 0 },
      { slug: "plan_slug",   name: "Plan Slug",     type: "text",    required: true,  order: 1 },
      { slug: "price",       name: "Price",         type: "number",  required: true,  order: 2 },
      { slug: "period",      name: "Period",        type: "text",    required: false, order: 3 },
      { slug: "max_content_types",  name: "Max Content Types",  type: "number", required: true, order: 4 },
      { slug: "max_content_entries",name: "Max Content Entries",type: "number", required: true, order: 5 },
      { slug: "max_team_members",   name: "Max Team Members",   type: "number", required: true, order: 6 },
      { slug: "max_storage",        name: "Max Storage (MB)",   type: "number", required: true, order: 7 },
      { slug: "max_locales",        name: "Max Locales",        type: "number", required: true, order: 8 },
      { slug: "max_api_calls",      name: "Max API Calls/mo",   type: "number", required: true, order: 9 },
      { slug: "description", name: "Description",   type: "text",    required: false, order: 10 },
      { slug: "features",    name: "Features",      type: "json",    required: false, order: 11 },
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
    isSingleType: true,
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
    isSingleType: true,
    fields: [
      { slug: "phone",     name: "Phone",     type: "text",    required: true,  order: 0 },
      { slug: "message",   name: "Message",   type: "text",    required: false, order: 1 },
      { slug: "label",     name: "Label",     type: "text",    required: false, order: 2 },
      { slug: "is_active", name: "Is Active", type: "boolean", required: false, order: 3 },
    ],
  },
]

const COMPONENTS = [
  {
    slug: "seo-metadata",
    name: "SEO Metadata",
    description: "Standard SEO metadata fields",
    category: "shared",
    fields: [
      { slug: "meta_title", name: "Meta Title", type: "text", required: true, order: 0 },
      { slug: "meta_description", name: "Meta Description", type: "text", required: false, order: 1 },
      { slug: "meta_image", name: "Meta Image URL", type: "text", required: false, order: 2 },
      { slug: "keywords", name: "Keywords", type: "text", required: false, order: 3 },
    ]
  },
  {
    slug: "button-link",
    name: "Button Link",
    description: "Call to action button or link",
    category: "shared",
    fields: [
      { slug: "label", name: "Label", type: "text", required: true, order: 0 },
      { slug: "url", name: "URL", type: "text", required: true, order: 1 },
      { slug: "is_external", name: "Is External", type: "boolean", required: false, order: 2 },
      { slug: "variant", name: "Variant", type: "select", required: false, order: 3, options: { choices: ["primary", "secondary", "outline", "ghost"] } }
    ]
  },
  {
    slug: "image-with-caption",
    name: "Image with Caption",
    description: "Image with accessible alt text and caption",
    category: "media",
    fields: [
      { slug: "image_url", name: "Image URL", type: "text", required: true, order: 0 },
      { slug: "alt_text", name: "Alt Text", type: "text", required: true, order: 1 },
      { slug: "caption", name: "Caption", type: "text", required: false, order: 2 },
    ]
  },
  {
    slug: "author-profile",
    name: "Author Profile",
    description: "Author details for blog posts or articles",
    category: "content",
    fields: [
      { slug: "name", name: "Name", type: "text", required: true, order: 0 },
      { slug: "role", name: "Role", type: "text", required: false, order: 1 },
      { slug: "avatar_url", name: "Avatar URL", type: "text", required: false, order: 2 },
      { slug: "bio", name: "Bio", type: "text", required: false, order: 3 },
    ]
  }
]

const SEED_ENTRIES: Record<string, object[]> = {
  "sacms-hero": [
    {
      headline: "The Modern Headless CMS for Startups & Enterprises",
      subheadline: "Build, manage, and deliver content anywhere — with built-in multi-tenancy, billing, AI generation, and enterprise-grade security.",
      cta_primary: "Get Started Free",
      cta_secondary: "View Documentation",
      badge_text: "🚀 Now in Beta — Free for Early Adopters",
      image_url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=2070",
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
  "sacms-account-pricing": [
    { 
      name: "Free Account", plan_slug: "free", price: 0, period: "forever", description: "Get started for free.", 
      max_workspaces: 1,
      features: ["1 Workspace", "Community Support"], is_popular: false, cta_text: "Get Started", cta_href: "/register" 
    },
    { 
      name: "Starter Account", plan_slug: "starter", price: 99000, period: "month", description: "For small teams.", 
      max_workspaces: 3,
      features: ["3 Workspaces", "Email Support"], is_popular: false, cta_text: "Upgrade to Starter", cta_href: "/register" 
    },
    { 
      name: "Pro Account", plan_slug: "pro", price: 299000, period: "month", description: "For growing agencies.", 
      max_workspaces: 10,
      features: ["10 Workspaces", "Priority Support"], is_popular: true, cta_text: "Go Pro", cta_href: "/register" 
    },
    { 
      name: "Enterprise Account", plan_slug: "enterprise", price: 999000, period: "month", description: "Unlimited scale.", 
      max_workspaces: 20,
      features: ["20 Workspaces", "Dedicated Support", "Custom SLAs"], is_popular: false, cta_text: "Contact Sales", cta_href: "https://wa.me/6281234567890" 
    },
  ],
  "sacms-workspace-pricing": [
    { 
      name: "Free Workspace", plan_slug: "free", price: 0, period: "forever", description: "Basic workspace limits.", 
      max_content_types: 3, max_content_entries: 500, max_team_members: 1, max_storage: 100, max_locales: 1, max_api_calls: 1000,
      features: ["3 Content Types", "1,000 API requests/month", "100MB Storage", "1 Team Member"]
    },
    { 
      name: "Starter Workspace", plan_slug: "starter", price: 49000, period: "month", description: "More capacity for a single workspace.", 
      max_content_types: 5, max_content_entries: 5000, max_team_members: 3, max_storage: 1024, max_locales: 2, max_api_calls: 10000,
      features: ["5 Content Types", "10,000 API requests/month", "1GB Storage", "3 Team Members", "2 Locales"]
    },
    { 
      name: "Pro Workspace", plan_slug: "pro", price: 149000, period: "month", description: "High performance workspace.", 
      max_content_types: 10, max_content_entries: 10000, max_team_members: 10, max_storage: 5120, max_locales: 5, max_api_calls: 100000,
      features: ["10 Content Types", "100,000 API requests/month", "5GB Storage", "10 Team Members", "5 Locales"]
    },
    { 
      name: "Enterprise Workspace", plan_slug: "enterprise", price: 499000, period: "month", description: "Dedicated workspace.", 
      max_content_types: 20, max_content_entries: 20000, max_team_members: 20, max_storage: 10240, max_locales: 20, max_api_calls: 1000000,
      features: ["20 Content Types", "1,000,000 API requests/month", "10GB Storage", "Unlimited Team", "Unlimited Locales"]
    },
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
    { question: "Can I use SaCMS for Mobile Apps?", answer: "Absolutely. SaCMS works perfectly with Flutter, React Native, iOS, and Android applications via our REST and GraphQL APIs.", order: 6 },
  ],
  "sacms-testimonials": [
    { name: "Ahmad Fauzi", role: "CTO", company: "TechStart ID", content: "SaCMS replaced our Strapi setup completely. Multi-tenancy and billing are built-in — no custom code needed.", rating: 5, avatar_url: "https://i.pravatar.cc/150?u=a042581f4e29026024d" },
    { name: "Sari Dewi", role: "Lead Developer", company: "Kreasi Digital", content: "The GraphQL API with DataLoader is blazing fast. Our Next.js frontend has never been this snappy.", rating: 5, avatar_url: "https://i.pravatar.cc/150?u=a042581f4e29026704d" },
    { name: "Budi Santoso", role: "Founder", company: "Nusantara Apps", content: "Finally a CMS that speaks Indonesian payment methods. Midtrans integration just works.", rating: 5, avatar_url: "https://i.pravatar.cc/150?u=a04258a2462d826712d" },
  ],
  "sacms-owners": [
    { name: "Nauval", role: "Founder & Lead Developer", bio: "Building the future of headless content management for Southeast Asia.", avatar_url: "https://i.pravatar.cc/150?img=11", linkedin: "https://linkedin.com/" },
    { name: "Rizky", role: "Co-Founder & Head of Product", bio: "Ensuring SaCMS provides the best user experience for content editors.", avatar_url: "https://i.pravatar.cc/150?img=12", linkedin: "https://linkedin.com/" },
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
      if (ct.isSingleType) {
        let singleType = await db.singleType.findFirst({
          where: { slug: ct.slug, tenantId: globalTenant.id },
        })

        if (!singleType) {
          singleType = await db.singleType.create({
            data: {
              name: ct.name,
              slug: ct.slug,
              description: ct.description,
              tenantId: globalTenant.id,
              isPublished: true,
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

        const seedData = SEED_ENTRIES[ct.slug]
        if (!seedData || seedData.length === 0) {
          results[ct.slug] = { created: 0, skipped: 0 }
          continue
        }

        // Delete old assignment for fresh seed
        await db.tenantSingleTypeAssignment.deleteMany({
          where: { tenantId: globalTenant.id, singleTypeId: singleType.id },
        })

        await db.tenantSingleTypeAssignment.create({
          data: {
            tenantId: globalTenant.id,
            singleTypeId: singleType.id,
            data: seedData[0],
            publishedAt: new Date(),
          }
        })
        results[ct.slug] = { created: 1, skipped: 0 }
      } else {
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

        // Clear old entries to ensure fresh seed
        await db.contentEntry.deleteMany({
          where: { tenantId: globalTenant.id, contentTypeId: contentType.id },
        })

        let created = 0
        let skipped = 0

        for (const entryData of seedData) {
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
    }

    // === Seed Components ===
    for (const comp of COMPONENTS) {
      let component = await db.component.findFirst({
        where: { slug: comp.slug, tenantId: globalTenant.id },
      })

      if (!component) {
        component = await db.component.create({
          data: {
            name: comp.name,
            slug: comp.slug,
            description: comp.description,
            category: comp.category,
            tenantId: globalTenant.id,
            fields: {
              create: comp.fields.map((f) => ({
                name: f.name,
                slug: f.slug,
                type: f.type,
                required: f.required,
                order: f.order,
                options: f.options as any, // Cast to any to satisfy Prisma Json input
              })),
            },
          },
        })
      }
      
      // Ensure it is assigned to the global tenant so it can be used
      const existingAssignment = await db.tenantComponentAssignment.findFirst({
        where: { tenantId: globalTenant.id, componentId: component.id },
      })

      if (!existingAssignment) {
        await db.tenantComponentAssignment.create({
          data: {
            tenantId: globalTenant.id,
            componentId: component.id,
          }
        })
      }
    }

    // === Seed RBAC Permissions & RolePermissions ===
    const { PERMISSIONS } = await import("@/lib/rbac")

    const PERMISSION_DEFINITIONS = [
      { name: PERMISSIONS.CONTENT_READ, displayName: "Read Content", category: "content" },
      { name: PERMISSIONS.CONTENT_CREATE, displayName: "Create Content", category: "content" },
      { name: PERMISSIONS.CONTENT_UPDATE, displayName: "Update Content", category: "content" },
      { name: PERMISSIONS.CONTENT_DELETE, displayName: "Delete Content", category: "content" },
      { name: PERMISSIONS.MEDIA_READ, displayName: "Read Media", category: "media" },
      { name: PERMISSIONS.MEDIA_UPLOAD, displayName: "Upload Media", category: "media" },
      { name: PERMISSIONS.MEDIA_DELETE, displayName: "Delete Media", category: "media" },
      { name: PERMISSIONS.USER_INVITE, displayName: "Invite Users", category: "users" },
      { name: PERMISSIONS.USER_REMOVE, displayName: "Remove Users", category: "users" },
      { name: PERMISSIONS.SETTING_UPDATE, displayName: "Update Settings", category: "settings" },
      { name: PERMISSIONS.API_TOKEN_MANAGE, displayName: "Manage API Tokens", category: "api" },
    ]

    // 1. Seed Permissions
    for (const perm of PERMISSION_DEFINITIONS) {
      const existing = await db.permission.findUnique({ where: { name: perm.name } })
      if (!existing) {
        await db.permission.create({
          data: {
            name: perm.name,
            displayName: perm.displayName,
            category: perm.category,
            description: `Allows ${perm.displayName}`,
          }
        })
      }
    }

    // 2. Map standard roles to their permissions
    const DEFAULT_ROLES = {
      admin: Object.values(PERMISSIONS),
      editor: [
        PERMISSIONS.CONTENT_READ, PERMISSIONS.CONTENT_CREATE, PERMISSIONS.CONTENT_UPDATE, PERMISSIONS.CONTENT_DELETE,
        PERMISSIONS.MEDIA_READ, PERMISSIONS.MEDIA_UPLOAD, PERMISSIONS.MEDIA_DELETE,
      ],
      author: [
        PERMISSIONS.CONTENT_READ, PERMISSIONS.CONTENT_CREATE, PERMISSIONS.CONTENT_UPDATE,
        PERMISSIONS.MEDIA_READ, PERMISSIONS.MEDIA_UPLOAD,
      ],
      viewer: [
        PERMISSIONS.CONTENT_READ,
        PERMISSIONS.MEDIA_READ,
      ]
    }

    const allPerms = await db.permission.findMany()
    let rbacCreated = 0

    for (const [roleName, permNames] of Object.entries(DEFAULT_ROLES)) {
      for (const permName of permNames) {
        const permId = allPerms.find(p => p.name === permName)?.id
        if (!permId) continue

        // Check if exists globally (tenantId: null)
        const existing = await db.rolePermission.findFirst({
          where: {
            tenantId: null, // Global default
            roleId: roleName,
            permissionId: permId,
          }
        })

        if (!existing) {
          await db.rolePermission.create({
            data: {
              tenantId: null, // Global default applies to all tenants
              roleId: roleName,
              permissionId: permId,
              granted: true,
            }
          })
          rbacCreated++
        }
      }
    }
    return NextResponse.json({
      success: true,
      tenantCreated: !!(globalTenant),
      tenantId: globalTenant.id,
      tenantSlug: globalTenant.slug,
      rbacCreated,
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
            entries: {
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
      publishedEntries: ct.entries.length,
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
