import { PrismaClient } from "../prisma/generated-client"
const prisma = new PrismaClient()

async function main() {
  console.log("🚀 Menginisialisasi Content Types, Single Types, dan Components untuk SaCMS...")

  let globalTenant = await prisma.tenant.findUnique({
    where: { slug: "sacms-global" }
  })

  if (!globalTenant) {
    console.log("Membuat Global Tenant (sacms-global)...")
    globalTenant = await prisma.tenant.create({
      data: {
        id: "sacms-global",
        name: "SaCMS Global",
        slug: "sacms-global",
        plan: "ENTERPRISE",
        status: "active"
      }
    })
  }

  // ==========================
  // HELPER FUNCTIONS
  // ==========================
  
  const syncContentType = async (data: { name: string, slug: string, description?: string, fields: any[] }) => {
    let ct = await prisma.contentType.findFirst({
      where: { tenantId: null, slug: data.slug }
    })
    if (ct) {
      ct = await prisma.contentType.update({
        where: { id: ct.id },
        data: { name: data.name, description: data.description }
      })
    } else {
      ct = await prisma.contentType.create({
        data: { name: data.name, slug: data.slug, description: data.description, tenantId: null, isPublished: true }
      })
    }
    for (const field of data.fields) {
      await prisma.schemaField.upsert({
        where: { contentTypeId_slug: { contentTypeId: ct.id, slug: field.slug } },
        update: { name: field.name, type: field.type, order: field.order, required: field.required || false, options: field.options || null },
        create: { contentTypeId: ct.id, name: field.name, slug: field.slug, type: field.type, order: field.order, required: field.required || false, options: field.options || null }
      })
    }
    
    // Ensure assigned to global tenant
    if (globalTenant) {
      const existingAssignment = await prisma.tenantContentTypeAssignment.findFirst({
        where: { tenantId: globalTenant.id, contentTypeId: ct.id }
      })
      if (!existingAssignment) {
        await prisma.tenantContentTypeAssignment.create({
          data: {
            tenantId: globalTenant.id,
            contentTypeId: ct.id,
            enabled: true
          }
        })
      }
    }
    
    return ct
  }

  const syncSingleType = async (data: { name: string, slug: string, description?: string, fields: any[] }) => {
    let st = await prisma.singleType.findFirst({
      where: { tenantId: null, slug: data.slug }
    })
    if (st) {
      st = await prisma.singleType.update({
        where: { id: st.id },
        data: { name: data.name, description: data.description }
      })
    } else {
      st = await prisma.singleType.create({
        data: { name: data.name, slug: data.slug, description: data.description, tenantId: null }
      })
    }
    for (const field of data.fields) {
      await prisma.schemaField.upsert({
        where: { singleTypeId_slug: { singleTypeId: st.id, slug: field.slug } },
        update: { name: field.name, type: field.type, order: field.order, required: field.required || false, options: field.options || null },
        create: { singleTypeId: st.id, name: field.name, slug: field.slug, type: field.type, order: field.order, required: field.required || false, options: field.options || null }
      })
    }
    return st
  }

  const syncComponent = async (data: { name: string, slug: string, description?: string, fields: any[] }) => {
    let comp = await prisma.component.findFirst({
      where: { tenantId: null, slug: data.slug }
    })
    if (comp) {
      comp = await prisma.component.update({
        where: { id: comp.id },
        data: { name: data.name, description: data.description }
      })
    } else {
      comp = await prisma.component.create({
        data: { name: data.name, slug: data.slug, description: data.description, tenantId: null }
      })
    }
    for (const field of data.fields) {
      await prisma.schemaField.upsert({
        where: { componentId_slug: { componentId: comp.id, slug: field.slug } },
        update: { name: field.name, type: field.type, order: field.order, required: field.required || false, options: field.options || null },
        create: { componentId: comp.id, name: field.name, slug: field.slug, type: field.type, order: field.order, required: field.required || false, options: field.options || null }
      })
    }
    return comp
  }

  // ==========================================
  // 1. COLLECTION TYPES
  // ==========================================

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
    description: "Konfigurasi tombol chat WhatsApp",
    fields: [
      { name: "Phone Number", slug: "phone", type: "text", order: 0, required: true },
      { name: "Initial Message", slug: "message", type: "textarea", order: 1 },
      { name: "Button Label", slug: "label", type: "text", order: 2 },
      { name: "Is Active", slug: "is_active", type: "boolean", order: 3 },
    ]
  })

  console.log("✅ Schemas berhasil disinkronisasi.")

  // --- SEEDING DATA ---
  console.log("🌱 Menyinkronkan data entries...")

  const syncPricingEntry = async (planSlug: string, data: any) => {
    const entries = await prisma.contentEntry.findMany({
      where: { contentTypeId: pricingCt.id }
    })
    const existing = entries.find(e => {
      const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      return d.plan_slug === planSlug
    })
    if (existing) {
      await prisma.contentEntry.update({
        where: { id: existing.id },
        data: { data }
      })
      console.log(`  ✅ Updated plan: ${data.name}`)
    } else {
      await prisma.contentEntry.create({
        data: { contentTypeId: pricingCt.id, tenantId: globalTenant.id, status: "PUBLISHED", data }
      })
      console.log(`  ✅ Created plan: ${data.name}`)
    }
  }

  const pricingData = [
    { 
      name: "Standard", plan_slug: "starter", price: "499.000", description: "Solusi workspace untuk tim kecil dan organisasi lokal.", 
      features_list: ["5 Content Schemas", "5.000 Content Entries", "3 Team Members", "10.000 API Calls / bulan", "1 GB Media Storage", "Email Support"], 
      max_content_types: 5, max_content_entries: 5000, max_team_members: 3, max_api_calls: 10000, max_storage: 1024, max_locales: 2, audit_log_retention: 0, support_level: "Email Support", is_popular: false, button_text: "Mulai Trial 7 Hari" 
    },
    { 
      name: "Business", plan_slug: "pro", price: "1.499.000", description: "Tier pro untuk instansi dengan trafik konten menengah.", 
      features_list: ["10 Content Schemas", "10.000 Content Entries", "10 Team Members", "100.000 API Calls / bulan", "5 GB Media Storage", "Advanced Workflow", "Audit Logs (30 Days)", "Priority Support"], 
      max_content_types: 10, max_content_entries: 10000, max_team_members: 10, max_api_calls: 100000, max_storage: 5120, max_locales: 5, audit_log_retention: 30, support_level: "Priority Support", is_popular: true, button_text: "Mulai Trial 7 Hari" 
    },
    { 
      name: "Enterprise", plan_slug: "enterprise", price: "2.499.000", description: "Performa maksimal untuk infrastruktur skala besar.", 
      features_list: ["20 Content Schemas", "20.000 Content Entries", "20 Team Members", "1.000.000 API Calls / bulan", "10 GB Media Storage", "Custom Roles (RBAC)", "Audit Logs (365 Days)", "24/7 Dedicated Support"], 
      max_content_types: 20, max_content_entries: 20000, max_team_members: 20, max_api_calls: 1000000, max_storage: 10240, max_locales: 20, audit_log_retention: 365, support_level: "24/7 Dedicated Support", is_popular: false, button_text: "Mulai Trial 7 Hari" 
    },
  ]

  for (const p of pricingData) {
    await syncPricingEntry(p.plan_slug, p)
  }

  // Addons Seeding
  const addonEntries = await prisma.contentEntry.count({ where: { contentTypeId: addonCt.id } })
  if (addonEntries === 0) {
    const addons = [
      { title: "AI Writer", addon_slug: "ai_writer", feature_key: "ai", price_label: "Included in Pro", description: "Generate content effortlessly.", icon: "Sparkles" },
      { title: "Advanced Audit", addon_slug: "adv_audit", feature_key: "audit", price_label: "Enterprise Only", description: "Keep track of every action.", icon: "ShieldCheck" }
    ]
    for (const a of addons) {
      await prisma.contentEntry.create({
        data: { contentTypeId: addonCt.id, tenantId: globalTenant.id, status: "PUBLISHED", data: a }
      })
    }
    console.log("  ✅ Created Addons seed data")
  }

  // Templates Seeding
  const templateEntries = await prisma.contentEntry.count({ where: { contentTypeId: templateCt.id } })
  if (templateEntries === 0) {
    const templates = [
      { name: "Blog / Magazine", template_id: "blog", description: "Template untuk website berita atau blog personal.", icon: "FileText", schema_template: {} },
      { name: "Company Profile", template_id: "company", description: "Template untuk website profil perusahaan.", icon: "Building2", schema_template: {} },
      { name: "E-Commerce", template_id: "ecommerce", description: "Template untuk katalog produk dan toko online.", icon: "ShoppingCart", schema_template: {} }
    ]
    for (const t of templates) {
      await prisma.contentEntry.create({
        data: { contentTypeId: templateCt.id, tenantId: globalTenant.id, status: "PUBLISHED", data: t }
      })
    }
    console.log("  ✅ Created Templates seed data")
  }

  // WA Single Type Seeding
  const waEntry = await prisma.tenantSingleTypeAssignment.findFirst({
    where: { singleTypeId: waSt.id, tenantId: globalTenant.id }
  })
  if (!waEntry) {
    await prisma.tenantSingleTypeAssignment.create({
      data: { singleTypeId: waSt.id, tenantId: globalTenant.id, publishedAt: new Date(),
        data: { phone: "6281234567890", message: "Halo SaCMS, saya ingin tanya seputar layanan Headless CMS.", label: "Chat with us", is_active: true }
      }
    })
    console.log("  ✅ Created default WhatsApp configuration")
  }

  console.log("✨ Semua sinkronisasi selesai!")
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
