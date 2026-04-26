import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("🚀 Menginisialisasi Content Types untuk SaCMS...")

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error("❌ Tenant tidak ditemukan. Jalankan aplikasi terlebih dahulu untuk membuat tenant pertama.")
    return
  }

  // Helper untuk mengelola Content Type dan Field-nya secara robust
  const syncContentType = async (data: { name: string, slug: string, description?: string, fields: any[] }) => {
    // 1. Find or Create/Update Content Type (tanpa menyentuh fields di sini)
    let ct = await prisma.contentType.findFirst({
      where: {
        tenantId: null,
        slug: data.slug
      }
    })

    if (ct) {
      ct = await prisma.contentType.update({
        where: { id: ct.id },
        data: { 
          name: data.name, 
          description: data.description 
        }
      })
    } else {
      ct = await prisma.contentType.create({
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          tenantId: null,
          isPublished: true,
        }
      })
    }

    // 2. Sync Fields
    for (const field of data.fields) {
      await prisma.contentTypeField.upsert({
        where: {
          contentTypeId_slug: {
            contentTypeId: ct.id,
            slug: field.slug
          }
        },
        update: {
          name: field.name,
          type: field.type,
          order: field.order,
          required: field.required || false,
        },
        create: {
          contentTypeId: ct.id,
          name: field.name,
          slug: field.slug,
          type: field.type,
          order: field.order,
          required: field.required || false,
        }
      })
    }

    return ct
  }

  // 1. HERO CONFIG
  const heroCt = await syncContentType({
    name: "SaCMS Hero",
    slug: "sacms-hero",
    description: "Konfigurasi bagian atas halaman utama",
    fields: [
      { name: "Badge Text", slug: "badge_text", type: "text", order: 0 },
      { name: "Title", slug: "title", type: "text", order: 1 },
      { name: "Subtitle", slug: "subtitle", type: "textarea", order: 2 },
      { name: "CTA Primary Text", slug: "cta_primary_text", type: "text", order: 3 },
      { name: "CTA Secondary Text", slug: "cta_secondary_text", type: "text", order: 4 },
    ]
  })

  // 2. FEATURES
  const featureCt = await syncContentType({
    name: "SaCMS Features",
    slug: "sacms-features",
    fields: [
      { name: "Title", slug: "title", type: "text", order: 0 },
      { name: "Description", slug: "description", type: "textarea", order: 1 },
      { name: "Icon Name", slug: "icon", type: "text", order: 2 },
      { name: "Is Main Feature", slug: "is_main", type: "boolean", order: 3 },
      { name: "Tag", slug: "tag", type: "text", order: 4 },
    ]
  })

  // 3. PRICING (DENGAN FIELD TEKNIS)
  const pricingCt = await syncContentType({
    name: "SaCMS Pricing",
    slug: "sacms-pricing",
    fields: [
      { name: "Plan Name", slug: "name", type: "text", order: 0 },
      { name: "Plan Slug", slug: "plan_slug", type: "text", order: 1 },
      { name: "Price", slug: "price", type: "text", order: 2 },
      { name: "Description", slug: "description", type: "text", order: 3 },
      { name: "Features List", slug: "features_list", type: "json", order: 4 },
      { name: "Max Content Schemas (Schemas)", slug: "max_content_types", type: "integer", order: 5 },
      { name: "Max Content Entries (Entries)", slug: "max_content_entries", type: "integer", order: 6 },
      { name: "Max Team Members (Team)", slug: "max_team_members", type: "integer", order: 7 },
      { name: "Max API Calls / Mo (API Calls)", slug: "max_api_calls", type: "integer", order: 8 },
      { name: "Max Storage MB", slug: "max_storage", type: "integer", order: 9 },
      { name: "Max Locales", slug: "max_locales", type: "integer", order: 10 },
      { name: "Audit Log Retention Days", slug: "audit_log_retention", type: "integer", order: 11 },
      { name: "Support Level", slug: "support_level", type: "text", order: 12 },
      { name: "Is Popular", slug: "is_popular", type: "boolean", order: 13 },
      { name: "Button Text", slug: "button_text", type: "text", order: 14 },
    ]
  })

  // 4. ADDONS
  const addonCt = await syncContentType({
    name: "SaCMS Addons",
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

  // 5. WORKFLOW
  const workflowCt = await syncContentType({
    name: "SaCMS Workflow",
    slug: "sacms-workflow",
    fields: [
      { name: "Step Number", slug: "step", type: "text", order: 0 },
      { name: "Title", slug: "title", type: "text", order: 1 },
      { name: "Description", slug: "description", type: "textarea", order: 2 },
      { name: "Icon Name", slug: "icon", type: "text", order: 3 },
    ]
  })

  // 6. FAQ
  const faqCt = await syncContentType({
    name: "SaCMS FAQ",
    slug: "sacms-faq",
    fields: [
      { name: "Question", slug: "question", type: "text", order: 0 },
      { name: "Answer", slug: "answer", type: "textarea", order: 1 },
    ]
  })

  // 7. WHATSAPP CONFIG
  const waCt = await syncContentType({
    name: "SaCMS WhatsApp",
    slug: "sacms-whatsapp",
    description: "Konfigurasi tombol chat WhatsApp mengambang",
    fields: [
      { name: "Phone Number", slug: "phone", type: "text", order: 0, required: true },
      { name: "Initial Message", slug: "message", type: "textarea", order: 1 },
      { name: "Button Label", slug: "label", type: "text", order: 2 },
      { name: "Is Active", slug: "is_active", type: "boolean", order: 3 },
    ]
  })

  // 8. ABOUT SECTION
  const aboutCt = await syncContentType({
    name: "SaCMS About",
    slug: "sacms-about",
    description: "Tentang platform dan misi kami",
    fields: [
      { name: "Title", slug: "title", type: "text", order: 0 },
      { name: "Content", slug: "content", type: "textarea", order: 1 },
      { name: "Image URL", slug: "image", type: "text", order: 2 },
    ]
  })

  // 9. OWNERS / FOUNDERS SECTION
  const ownerCt = await syncContentType({
    name: "SaCMS Owners",
    slug: "sacms-owners",
    description: "Profil pendiri dan tim inti",
    fields: [
      { name: "Name", slug: "name", type: "text", order: 0 },
      { name: "Role", slug: "role", type: "text", order: 1 },
      { name: "Bio", slug: "bio", type: "textarea", order: 2 },
      { name: "Avatar URL", slug: "avatar", type: "text", order: 3 },
      { name: "Social Links", slug: "social", type: "json", order: 4 },
    ]
  })

  // 10. TESTIMONIALS
  const testimonialCt = await syncContentType({
    name: "SaCMS Testimonials",
    slug: "sacms-testimonials",
    description: "Testimoni dari pengguna dan partner",
    fields: [
      { name: "Name", slug: "name", type: "text", order: 0 },
      { name: "Role", slug: "role", type: "text", order: 1 },
      { name: "Content", slug: "content", type: "textarea", order: 2 },
      { name: "Avatar URL", slug: "avatar", type: "text", order: 3 },
      { name: "Rating", slug: "rating", type: "integer", order: 4 },
    ]
  })

  console.log("✅ Content Types & Fields berhasil disinkronisasi.")

  // --- SEEDING DATA ---
  console.log("🌱 Menyinkronkan data entries...")

  // Helper untuk Sync Entry (Pricing)
  const syncPricingEntry = async (planSlug: string, data: any) => {
    // Cari entry berdasarkan plan_slug di dalam data JSON
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
        data: {
          contentTypeId: pricingCt.id,
          tenantId: tenant.id,
          status: "PUBLISHED",
          data
        }
      })
      console.log(`  ✅ Created plan: ${data.name}`)
    }
  }

  // Pricing Data
  const pricingData = [
    { 
      name: "Standard", 
      plan_slug: "starter",
      price: "499.000", 
      description: "Solusi workspace untuk tim kecil dan organisasi lokal.", 
      features_list: ["10 Content Schemas", "5.000 Content Entries", "5 Team Members", "100.000 API Calls / bulan", "1 GB Media Storage", "Email Support"], 
      max_content_types: 10,
      max_content_entries: 5000,
      max_team_members: 5,
      max_api_calls: 100000,
      max_storage: 1024,
      max_locales: 1,
      audit_log_retention: 0,
      support_level: "Email Support",
      is_popular: false, 
      button_text: "Mulai Trial 7 Hari" 
    },
    { 
      name: "Business", 
      plan_slug: "pro",
      price: "1.499.000", 
      description: "Tier pro untuk instansi dengan trafik konten menengah.", 
      features_list: ["50 Content Schemas", "50.000 Content Entries", "20 Team Members", "1.000.000 API Calls / bulan", "10 GB Media Storage", "Advanced Workflow", "Audit Logs (7 Days)", "Priority Support"], 
      max_content_types: 50,
      max_content_entries: 50000,
      max_team_members: 20,
      max_api_calls: 1000000,
      max_storage: 10240,
      max_locales: 5,
      audit_log_retention: 7,
      support_level: "Priority Support",
      is_popular: true, 
      button_text: "Mulai Trial 7 Hari" 
    },
    { 
      name: "Enterprise", 
      plan_slug: "enterprise",
      price: "2.499.000", 
      description: "Performa maksimal untuk infrastruktur skala besar.", 
      features_list: ["Unlimited Content Schemas", "Unlimited Content Entries", "Unlimited Team Members", "Unlimited API Calls", "100 GB+ Media Storage", "Custom Roles (RBAC)", "Unlimited Audit Logs", "24/7 Dedicated Support"], 
      max_content_types: 999,
      max_content_entries: 9999999,
      max_team_members: 999,
      max_api_calls: 99999999,
      max_storage: 102400,
      max_locales: 99,
      audit_log_retention: 9999,
      support_level: "24/7 Dedicated Support",
      is_popular: false, 
      button_text: "Mulai Trial 7 Hari" 
    },
  ]

  for (const p of pricingData) {
    await syncPricingEntry(p.plan_slug, p)
  }

  // WhatsApp Seeding
  const waEntry = await prisma.contentEntry.findFirst({
    where: { contentType: { slug: "sacms-whatsapp" } }
  })

  if (!waEntry) {
    await prisma.contentEntry.create({
      data: {
        contentTypeId: waCt.id,
        tenantId: tenant.id,
        status: "PUBLISHED",
        data: {
          phone: "6281234567890",
          message: "Halo SaCMS, saya ingin tanya seputar layanan Headless CMS.",
          label: "Chat with us",
          is_active: true
        }
      }
    })
    console.log("  ✅ Created default WhatsApp configuration")
  }

  console.log("✨ Semua sinkronisasi selesai!")
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
