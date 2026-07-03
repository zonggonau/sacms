import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let globalTenant = await db.tenant.findUnique({
      where: { slug: "sacms-global" }
    })

    if (!globalTenant) {
      globalTenant = await db.tenant.create({
        data: {
          id: "sacms-global",
          name: "SaCMS Global",
          slug: "sacms-global",
          plan: "ENTERPRISE",
          status: "active"
        }
      })
    }

    // Helper untuk mengelola Content Type (Collection Type)
    const syncContentType = async (data: { name: string, slug: string, description?: string, fields: any[] }) => {
      let ct = await db.contentType.findFirst({
        where: { tenantId: null, slug: data.slug }
      })

      if (ct) {
        ct = await db.contentType.update({
          where: { id: ct.id },
          data: { name: data.name, description: data.description }
        })
      } else {
        ct = await db.contentType.create({
          data: {
            name: data.name,
            slug: data.slug,
            description: data.description,
            tenantId: null,
            isPublished: true,
          }
        })
      }

      for (const field of data.fields) {
        await db.schemaField.upsert({
          where: {
            contentTypeId_slug: { contentTypeId: ct.id, slug: field.slug }
          },
          update: {
            name: field.name, type: field.type, order: field.order,
            required: field.required || false, options: field.options || null
          },
          create: {
            contentTypeId: ct.id, name: field.name, slug: field.slug, type: field.type,
            order: field.order, required: field.required || false, options: field.options || null
          }
        })
      }

      return ct
    }

    // Helper untuk mengelola Single Type
    const syncSingleType = async (data: { name: string, slug: string, description?: string, fields: any[] }) => {
      let st = await db.singleType.findFirst({
        where: { tenantId: null, slug: data.slug }
      })

      if (st) {
        st = await db.singleType.update({
          where: { id: st.id },
          data: { name: data.name, description: data.description }
        })
      } else {
        st = await db.singleType.create({
          data: {
            name: data.name,
            slug: data.slug,
            description: data.description,
            tenantId: null,
            isPublished: true,
          }
        })
      }

      for (const field of data.fields) {
        await db.schemaField.upsert({
          where: {
            singleTypeId_slug: { singleTypeId: st.id, slug: field.slug }
          },
          update: {
            name: field.name, type: field.type, order: field.order,
            required: field.required || false, options: field.options || null
          },
          create: {
            singleTypeId: st.id, name: field.name, slug: field.slug, type: field.type,
            order: field.order, required: field.required || false, options: field.options || null
          }
        })
      }

      return st
    }

    // Helper untuk mengelola Component
    const syncComponent = async (data: { name: string, slug: string, description?: string, fields: any[] }) => {
      let comp = await db.component.findFirst({
        where: { tenantId: null, slug: data.slug }
      })

      if (comp) {
        comp = await db.component.update({
          where: { id: comp.id },
          data: { name: data.name, description: data.description }
        })
      } else {
        comp = await db.component.create({
          data: {
            name: data.name,
            slug: data.slug,
            description: data.description,
            tenantId: null,
          }
        })
      }

      for (const field of data.fields) {
        await db.schemaField.upsert({
          where: {
            componentId_slug: { componentId: comp.id, slug: field.slug }
          },
          update: {
            name: field.name, type: field.type, order: field.order,
            required: field.required || false, options: field.options || null
          },
          create: {
            componentId: comp.id, name: field.name, slug: field.slug, type: field.type,
            order: field.order, required: field.required || false, options: field.options || null
          }
        })
      }

      return comp
    }


    // ==========================================
    // 1. COLLECTION TYPES
    // ==========================================

    // PRICING
    const pricingCt = await syncContentType({
      name: "Workspace Plans",
      slug: "sacms-pricing",
      fields: [
        { name: "Plan Name", slug: "name", type: "text", order: 0 },
        { name: "Plan Slug", slug: "plan_slug", type: "text", order: 1 },
        { name: "Price", slug: "price", type: "text", order: 2 },
        { name: "Description", slug: "description", type: "text", order: 3 },
        { name: "Features List", slug: "features_list", type: "json", order: 4 },
        { name: "Max Content Schemas", slug: "max_content_types", type: "integer", order: 5 },
        { name: "Max Content Entries", slug: "max_content_entries", type: "integer", order: 6 },
        { name: "Max Team Members", slug: "max_team_members", type: "integer", order: 7 },
        { name: "Max API Calls", slug: "max_api_calls", type: "integer", order: 8 },
        { name: "Max Storage MB", slug: "max_storage", type: "integer", order: 9 },
        { name: "Max Locales", slug: "max_locales", type: "integer", order: 10 },
        { name: "Audit Log Retention", slug: "audit_log_retention", type: "integer", order: 11 },
        { name: "Support Level", slug: "support_level", type: "text", order: 12 },
        { name: "Is Popular", slug: "is_popular", type: "boolean", order: 13 },
        { name: "Button Text", slug: "button_text", type: "text", order: 14 },
      ]
    })

    // ADDONS
    const addonCt = await syncContentType({
      name: "Addons",
      slug: "sacms-addons",
      fields: [
        { name: "Title", slug: "title", type: "text", order: 0 },
        { name: "Addon Slug", slug: "addon_slug", type: "text", order: 1 },
        { name: "Feature Key", slug: "feature_key", type: "text", order: 2 },
        { name: "Price Label", slug: "price_label", type: "text", order: 3 },
        { name: "Description", slug: "description", type: "text", order: 4 },
        { name: "Icon Name", slug: "icon", type: "text", order: 5 },
      ]
    })

    // TEMPLATES
    const templateCt = await syncContentType({
      name: "Templates",
      slug: "templates",
      description: "System workspace templates",
      fields: [
        { name: "Name", slug: "name", type: "text", order: 0, required: true },
        { name: "Description", slug: "description", type: "textarea", order: 1 },
        { name: "Icon", slug: "icon", type: "text", order: 2 },
        { name: "Template ID", slug: "template_id", type: "text", order: 3, required: true },
        { name: "Schema Template", slug: "schema_template", type: "json", order: 4 },
      ]
    })


    // ==========================================
    // 2. COMPONENTS
    // ==========================================

    const featureComp = await syncComponent({
      name: "Feature Item",
      slug: "sacms-component-feature",
      fields: [
        { name: "Title", slug: "title", type: "text", order: 0 },
        { name: "Description", slug: "description", type: "textarea", order: 1 },
        { name: "Icon Name", slug: "icon", type: "text", order: 2 },
        { name: "Is Main Feature", slug: "is_main", type: "boolean", order: 3 },
        { name: "Tag", slug: "tag", type: "text", order: 4 },
      ]
    })

    const workflowComp = await syncComponent({
      name: "Workflow Item",
      slug: "sacms-component-workflow",
      fields: [
        { name: "Step Number", slug: "step", type: "text", order: 0 },
        { name: "Title", slug: "title", type: "text", order: 1 },
        { name: "Description", slug: "description", type: "textarea", order: 2 },
        { name: "Icon Name", slug: "icon", type: "text", order: 3 },
      ]
    })

    const faqComp = await syncComponent({
      name: "FAQ Item",
      slug: "sacms-component-faq",
      fields: [
        { name: "Question", slug: "question", type: "text", order: 0 },
        { name: "Answer", slug: "answer", type: "textarea", order: 1 },
      ]
    })

    const ownerComp = await syncComponent({
      name: "Owner Profile",
      slug: "sacms-component-owner",
      fields: [
        { name: "Name", slug: "name", type: "text", order: 0 },
        { name: "Role", slug: "role", type: "text", order: 1 },
        { name: "Bio", slug: "bio", type: "textarea", order: 2 },
        { name: "Avatar URL", slug: "avatar", type: "text", order: 3 },
        { name: "Social Links", slug: "social", type: "json", order: 4 },
      ]
    })

    const testimonialComp = await syncComponent({
      name: "Testimonial Item",
      slug: "sacms-component-testimonial",
      fields: [
        { name: "Name", slug: "name", type: "text", order: 0 },
        { name: "Role", slug: "role", type: "text", order: 1 },
        { name: "Content", slug: "content", type: "textarea", order: 2 },
        { name: "Avatar URL", slug: "avatar", type: "text", order: 3 },
        { name: "Rating", slug: "rating", type: "integer", order: 4 },
      ]
    })

    const sectorComp = await syncComponent({
      name: "Sector Item",
      slug: "sacms-component-sector",
      fields: [
        { name: "Icon", slug: "icon", type: "text", order: 0 },
        { name: "Label", slug: "label", type: "text", order: 1 },
        { name: "Description", slug: "desc", type: "text", order: 2 },
      ]
    })

    const localPrideComp = await syncComponent({
      name: "Local Pride Section",
      slug: "sacms-component-local-pride",
      fields: [
        { name: "Badge Text", slug: "badge", type: "text", order: 0 },
        { name: "Title", slug: "title", type: "text", order: 1 },
        { name: "Description", slug: "description", type: "textarea", order: 2 },
      ]
    })

    const ctaComp = await syncComponent({
      name: "CTA Banner",
      slug: "sacms-component-cta",
      fields: [
        { name: "Title", slug: "title", type: "text", order: 0 },
        { name: "Description", slug: "description", type: "text", order: 1 },
        { name: "Primary Button Text", slug: "button_primary_text", type: "text", order: 2 },
        { name: "Secondary Button Text", slug: "button_secondary_text", type: "text", order: 3 },
      ]
    })

    const footerComp = await syncComponent({
      name: "Footer Config",
      slug: "sacms-component-footer",
      fields: [
        { name: "Brand Name", slug: "brand_name", type: "text", order: 0 },
        { name: "Description", slug: "description", type: "text", order: 1 },
        { name: "Copyright Text", slug: "copyright", type: "text", order: 2 },
      ]
    })

    // ==========================================
    // 3. SINGLE TYPES
    // ==========================================

    const landingPageSt = await syncSingleType({
      name: "Landing Page",
      slug: "sacms-landing-page",
      description: "Halaman Utama SaCMS",
      fields: [
        { name: "Hero Badge", slug: "hero_badge", type: "text", order: 0 },
        { name: "Hero Title", slug: "hero_title", type: "text", order: 1 },
        { name: "Hero Subtitle", slug: "hero_subtitle", type: "textarea", order: 2 },
        { name: "Hero Primary CTA", slug: "hero_cta_primary", type: "text", order: 3 },
        { name: "Hero Secondary CTA", slug: "hero_cta_secondary", type: "text", order: 4 },
        { name: "Features", slug: "features", type: "component", order: 5, options: { repeatable: true, componentSlug: "sacms-component-feature" } },
        { name: "Workflows", slug: "workflows", type: "component", order: 6, options: { repeatable: true, componentSlug: "sacms-component-workflow" } },
        { name: "FAQs", slug: "faqs", type: "component", order: 7, options: { repeatable: true, componentSlug: "sacms-component-faq" } },
        { name: "Owners", slug: "owners", type: "component", order: 8, options: { repeatable: true, componentSlug: "sacms-component-owner" } },
        { name: "Testimonials", slug: "testimonials", type: "component", order: 9, options: { repeatable: true, componentSlug: "sacms-component-testimonial" } },
        { name: "Sectors", slug: "sectors", type: "component", order: 10, options: { repeatable: true, componentSlug: "sacms-component-sector" } },
        { name: "Local Pride", slug: "local_pride", type: "component", order: 11, options: { repeatable: false, componentSlug: "sacms-component-local-pride" } },
        { name: "CTA Banner", slug: "cta_banner", type: "component", order: 12, options: { repeatable: false, componentSlug: "sacms-component-cta" } },
        { name: "Footer", slug: "footer", type: "component", order: 13, options: { repeatable: false, componentSlug: "sacms-component-footer" } }
      ]
    })

    const aboutSt = await syncSingleType({
      name: "About Us",
      slug: "sacms-about",
      fields: [
        { name: "Title", slug: "title", type: "text", order: 0 },
        { name: "Content", slug: "content", type: "textarea", order: 1 },
        { name: "Image URL", slug: "image", type: "text", order: 2 },
      ]
    })

    const waSt = await syncSingleType({
      name: "WhatsApp Config",
      slug: "sacms-whatsapp",
      fields: [
        { name: "Phone Number", slug: "phone", type: "text", order: 0, required: true },
        { name: "Initial Message", slug: "message", type: "textarea", order: 1 },
        { name: "Button Label", slug: "label", type: "text", order: 2 },
        { name: "Is Active", slug: "is_active", type: "boolean", order: 3 },
      ]
    })

    // ==========================================
    // 4. SEEDING DATA
    // ==========================================

    // Helper untuk Sync Entry (Pricing - Collection Type)
    const syncPricingEntry = async (planSlug: string, data: any) => {
      const entries = await db.contentEntry.findMany({
        where: { contentTypeId: pricingCt.id }
      })

      const existing = entries.find(e => {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        return d.plan_slug === planSlug
      })

      if (existing) {
        await db.contentEntry.update({
          where: { id: existing.id },
          data: { data }
        })
      } else {
        await db.contentEntry.create({
          data: {
            contentTypeId: pricingCt.id,
            tenantId: globalTenant.id,
            status: "PUBLISHED",
            data
          }
        })
      }
    }

    const pricingData = [
      { 
        name: "Standard", plan_slug: "starter", price: "499.000", 
        description: "Solusi workspace untuk tim kecil dan organisasi lokal.", 
        features_list: ["5 Content Schemas", "5.000 Content Entries", "3 Team Members", "10.000 API Calls / bulan", "1 GB Media Storage", "Email Support"], 
        max_content_types: 5, max_content_entries: 5000, max_team_members: 3, max_api_calls: 10000, max_storage: 1024, max_locales: 2,
        audit_log_retention: 0, support_level: "Email Support", is_popular: false, button_text: "Mulai Trial 7 Hari" 
      },
      { 
        name: "Business", plan_slug: "pro", price: "1.499.000", 
        description: "Tier pro untuk instansi dengan trafik konten menengah.", 
        features_list: ["10 Content Schemas", "10.000 Content Entries", "10 Team Members", "100.000 API Calls / bulan", "5 GB Media Storage", "Advanced Workflow", "Audit Logs (30 Days)", "Priority Support"], 
        max_content_types: 10, max_content_entries: 10000, max_team_members: 10, max_api_calls: 100000, max_storage: 5120, max_locales: 5,
        audit_log_retention: 30, support_level: "Priority Support", is_popular: true, button_text: "Mulai Trial 7 Hari" 
      },
      { 
        name: "Enterprise", plan_slug: "enterprise", price: "2.499.000", 
        description: "Performa maksimal untuk infrastruktur skala besar.", 
        features_list: ["20 Content Schemas", "20.000 Content Entries", "20 Team Members", "1.000.000 API Calls / bulan", "10 GB Media Storage", "Custom Roles (RBAC)", "Audit Logs (365 Days)", "24/7 Dedicated Support"], 
        max_content_types: 20, max_content_entries: 20000, max_team_members: 20, max_api_calls: 1000000, max_storage: 10240, max_locales: 20,
        audit_log_retention: 365, support_level: "24/7 Dedicated Support", is_popular: false, button_text: "Mulai Trial 7 Hari" 
      },
    ]

    for (const p of pricingData) {
      await syncPricingEntry(p.plan_slug, p)
    }

    // Addons (Collection Type)
    const addonEntries = await db.contentEntry.count({ where: { contentTypeId: addonCt.id } })
    if (addonEntries === 0) {
      const addons = [
        { title: "AI Writer", addon_slug: "ai_writer", feature_key: "ai", price_label: "Included in Pro", description: "Generate content effortlessly.", icon: "Sparkles" },
        { title: "Advanced Audit", addon_slug: "adv_audit", feature_key: "audit", price_label: "Enterprise Only", description: "Keep track of every action.", icon: "ShieldCheck" }
      ]
      for (const a of addons) {
        await db.contentEntry.create({
          data: { contentTypeId: addonCt.id, tenantId: globalTenant.id, status: "PUBLISHED", data: a }
        })
      }
    }

    // Templates (Collection Type)
    const syncTemplateEntry = async (templateId: string, data: any) => {
      const entries = await db.contentEntry.findMany({
        where: { contentTypeId: templateCt.id }
      })
      const existing = entries.find(e => {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        return d.template_id === templateId
      })
      if (existing) {
        await db.contentEntry.update({
          where: { id: existing.id },
          data: { data }
        })
      } else {
        await db.contentEntry.create({
          data: { contentTypeId: templateCt.id, tenantId: globalTenant.id, status: "PUBLISHED", data }
        })
      }
    }

    const templatesData = [
      { 
          name: "Blog & News", 
          description: "Posts, Categories, Authors", 
          icon: "LayoutDashboard", 
          template_id: "blog",
          schema_template: {
            contentTypes: [
              {
                name: "Berita",
                slug: "berita",
                description: "Koleksi berita dan artikel",
                fields: [
                  { name: "Judul", slug: "title", type: "text", required: true, order: 0 },
                  { name: "Konten", slug: "content", type: "richText", required: true, order: 1 },
                  { name: "Gambar Utama", slug: "featured_image", type: "media", order: 2 }
                ]
              }
            ],
            singleTypes: [
              {
                name: "Pengaturan Umum",
                slug: "general-settings",
                fields: [
                  { name: "Nama Situs", slug: "site_name", type: "text", required: true, order: 0 },
                  { name: "Logo", slug: "logo", type: "media", order: 1 }
                ]
              },
              {
                name: "Navbar",
                slug: "navbar",
                fields: [
                  { name: "Nama Brand", slug: "brandName", type: "text", required: true, order: 0 },
                  { name: "Logo Navbar", slug: "logo", type: "media", order: 1 },
                  { name: "Slogan", slug: "slogan", type: "text", order: 2 },
                  { name: "Menu Navigasi", slug: "menuItems", type: "component", required: true, options: { componentSlug: "nav-item-l1", repeatable: true }, order: 3 },
                  { name: "Tombol CTA Label", slug: "ctaLabel", type: "text", order: 4 },
                  { name: "Tombol CTA Link", slug: "ctaLink", type: "text", order: 5 },
                ]
              },
              {
                name: "Footer",
                slug: "footer",
                fields: [
                  { name: "Deskripsi Footer", slug: "description", type: "textarea", order: 0 },
                  { name: "Teks Copyright", slug: "copyright", type: "text", order: 1 },
                  { name: "Link Sections", slug: "sections", type: "component", required: false, options: { componentSlug: "footer-section", repeatable: true }, order: 2 },
                  { name: "Link Sosial Media", slug: "socialLinks", type: "component", required: false, options: { componentSlug: "link", repeatable: true }, order: 3 },
                ]
              },
              {
                name: "Beranda",
                slug: "homepage",
                fields: [
                  { 
                    name: "Konten Beranda", 
                    slug: "blocks", 
                    type: "component", 
                    required: false, 
                    options: { repeatable: true, metadata: { isDynamicZone: true } },
                    order: 0 
                  },
                ]
              }
            ]
          }
      },
      { 
          name: "E-commerce", 
          description: "Products, Stock, Orders", 
          icon: "Search", 
          template_id: "ecommerce",
          schema_template: { contentTypes: [], singleTypes: [], components: [] }
      },
      { 
          name: "Portfolio", 
          description: "Projects, Services, Reviews", 
          icon: "Settings", 
          template_id: "portfolio",
          schema_template: { contentTypes: [], singleTypes: [], components: [] }
      },
      { 
          name: "Corporate", 
          description: "Team, Case Studies, Company", 
          icon: "Building2", 
          template_id: "corporate",
          schema_template: { contentTypes: [], singleTypes: [], components: [] }
      },
    ]

    for (const tpl of templatesData) {
      await syncTemplateEntry(tpl.template_id, tpl)
    }

    // Helper untuk Single Type Seed Data
    const syncSingleTypeEntry = async (singleTypeId: string, data: any) => {
      const existing = await db.tenantSingleTypeAssignment.findFirst({
        where: { singleTypeId, tenantId: globalTenant.id }
      })

      if (!existing) {
        await db.tenantSingleTypeAssignment.create({
          data: {
            singleTypeId,
            tenantId: globalTenant.id,
            publishedAt: new Date(),
            data
          }
        })
      }
    }

    // Seed About Single Type
    await syncSingleTypeEntry(aboutSt.id, {
      title: "Empowering Developers",
      content: "We believe content management should be simple, robust, and scalable. Our mission is to provide the best tools for developers.",
      image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80"
    })

    // Seed WhatsApp Single Type
    await syncSingleTypeEntry(waSt.id, {
      phone: "6281234567890",
      message: "Halo SaCMS, saya ingin tanya seputar layanan Headless CMS.",
      label: "Chat with us",
      is_active: true
    })

    // Seed Landing Page Single Type
    await syncSingleTypeEntry(landingPageSt.id, {
      hero_badge: "SaCMS v0.2.0 is out!",
      hero_title: "Build Faster with Headless CMS",
      hero_subtitle: "Manage your content easily with our multi-tenant headless CMS platform. Fast, secure, and highly scalable.",
      hero_cta_primary: "Get Started",
      hero_cta_secondary: "View Documentation",
      features: [
        { title: "Multi-tenant Architecture", description: "Isolate data securely between workspaces.", icon: "Building2", is_main: true, tag: "Core" },
        { title: "GraphQL & REST APIs", description: "Flexible APIs for any frontend framework.", icon: "Globe", is_main: true, tag: "API" },
        { title: "AI Content Generation", description: "Built-in AI to help you write better content faster.", icon: "Sparkles", is_main: true, tag: "AI" }
      ],
      workflows: [
        { step: "01", title: "Setup Tenant", description: "Create your isolated workspace instantly.", icon: "Building" },
        { step: "02", title: "Define Schemas", description: "Build data structures with no-code tools.", icon: "Database" },
        { step: "03", title: "Fetch API", description: "Consume data anywhere securely.", icon: "Code" }
      ],
      faqs: [
        { question: "What is SaCMS?", answer: "SaCMS is a multi-tenant headless CMS tailored for SaaS businesses." },
        { question: "Can I use it for free?", answer: "Yes, we offer a generous free tier for small projects." }
      ],
      owners: [], // Can be empty by default
      testimonials: [] // Can be empty by default
    })

    return NextResponse.json({ success: true, message: "Global Tenant & Seed Data provisioned successfully." })

  } catch (error) {
    console.error("Setup Global Tenant Error:", error)
    return NextResponse.json({ error: "Failed to setup global tenant" }, { status: 500 })
  }
}
