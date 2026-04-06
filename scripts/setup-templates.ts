import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("🚀 Initializing Templates Content Type...")

  // 1. Ensure System Tenant exists
  let systemTenant = await prisma.tenant.findFirst({
    where: { slug: "system" },
  })

  if (!systemTenant) {
    systemTenant = await prisma.tenant.create({
      data: {
        name: "System",
        slug: "system",
        description: "Platform-level content",
        status: "active",
        plan: "enterprise",
      },
    })
    console.log("✅ Created System Tenant")
  }

  // 2. Create Templates Content Type (Global)
  let contentType = await prisma.contentType.findFirst({
    where: { slug: "templates", tenantId: null }
  })

  if (!contentType) {
    contentType = await prisma.contentType.create({
      data: {
        name: "Templates",
        slug: "templates",
        description: "System workspace templates",
        tenantId: null, // Global
        isPublished: true,
      }
    })
    console.log("✅ Created Content Type 'templates'")
  } else {
    await prisma.contentType.update({
      where: { id: contentType.id },
      data: { name: "Templates", description: "System workspace templates" }
    })
    console.log("✅ Updated Content Type 'templates'")
  }

  // 3. Sync Fields
  const fields = [
    { name: "Name", slug: "name", type: "text", order: 0, required: true },
    { name: "Description", slug: "description", type: "textarea", order: 1 },
    { name: "Icon", slug: "icon", type: "text", order: 2 },
    { name: "Template ID", slug: "template_id", type: "text", order: 3, required: true },
    { name: "Schema Template", slug: "schema_template", type: "json", order: 4 },
  ]

  for (const field of fields) {
    await prisma.contentTypeField.upsert({
      where: {
        contentTypeId_slug: {
          contentTypeId: contentType.id,
          slug: field.slug
        }
      },
      update: {
        name: field.name,
        type: field.type,
        order: field.order,
        required: field.required,
      },
      create: {
        contentTypeId: contentType.id,
        name: field.name,
        slug: field.slug,
        type: field.type,
        order: field.order,
        required: field.required,
      }
    })
  }
  console.log("✅ Fields synced")

  // 4. Seed Template Entries
  const blogSchema = {
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

  const templatesData = [
    { 
        name: "Blog & News", 
        description: "Posts, Categories, Authors", 
        icon: "LayoutDashboard", 
        template_id: "blog",
        schema_template: blogSchema
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
    const entries = await prisma.contentEntry.findMany({
      where: { contentTypeId: contentType.id }
    })
    
    const existing = entries.find(e => {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        return d.template_id === tpl.template_id
    })

    if (!existing) {
      await prisma.contentEntry.create({
        data: {
          contentTypeId: contentType.id,
          tenantId: systemTenant.id,
          status: "PUBLISHED",
          data: tpl
        }
      })
      console.log(`✅ Seeded template: ${tpl.name}`)
    } else {
      await prisma.contentEntry.update({
        where: { id: existing.id },
        data: { data: tpl }
      })
      console.log(`✅ Updated template: ${tpl.name}`)
    }
  }

  console.log("✨ Template setup complete!")
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
