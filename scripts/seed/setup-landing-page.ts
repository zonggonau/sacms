import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const tenantSlug = "e7dcfaf087" // Slug startup Papua
  
  // 1. Cari Tenant
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug }
  })

  if (!tenant) {
    console.error("Tenant not found!")
    return
  }

  // 2. Buat Content Type "Landing Page"
  const landingPage = await prisma.contentType.upsert({
    where: { slug: "landing-page" },
    update: {},
    create: {
      tenantId: tenant.id, // Startup Anda yang punya
      name: "Landing Page",
      slug: "landing-page",
      description: "Main configuration for startup landing page",
      isPublished: true,
      fields: {
        create: [
          // HERO SECTION
          { name: "Hero Title", slug: "hero_title", type: "text", required: true, order: 0 },
          { name: "Hero Subtitle", slug: "hero_subtitle", type: "textarea", required: false, order: 1 },
          { name: "Hero Image", slug: "hero_image", type: "media", required: false, order: 2 },
          { name: "CTA Button Text", slug: "cta_text", type: "text", required: false, order: 3 },
          { name: "CTA Button Link", slug: "cta_link", type: "text", required: false, order: 4 },
          
          // FEATURES SECTION
          { name: "Features List", slug: "features", type: "json", required: false, order: 5 },
          
          // ABOUT SECTION
          { name: "About Content", slug: "about_content", type: "richText", required: false, order: 6 },
          
          // SEO SECTION
          { name: "SEO Title", slug: "seo_title", type: "text", required: false, order: 7 },
          { name: "SEO Description", slug: "seo_description", type: "textarea", required: false, order: 8 },
        ]
      },
      tenants: {
        create: {
          tenantId: tenant.id,
          enabled: true
        }
      }
    }
  })

  console.log(`Successfully created Landing Page schema (ID: ${landingPage.id}) for Startup: ${tenant.name}`)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
