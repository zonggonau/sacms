import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  // Buat Content Type Global (tenantId: null)
  const landingPage = await prisma.contentType.upsert({
    where: { slug: "platform-landing-page" },
    update: {},
    create: {
      tenantId: null, // Ini menjadikannya GLOBAL / SYSTEM
      name: "Platform Landing Page",
      slug: "platform-landing-page",
      description: "Main landing page for the entire SaaS platform",
      isPublished: true,
      fields: {
        create: [
          // HERO SECTION
          { name: "Hero Title", slug: "hero_title", type: "text", required: true, order: 0 },
          { name: "Hero Subtitle", slug: "hero_subtitle", type: "textarea", required: false, order: 1 },
          { name: "Hero Image", slug: "hero_image", type: "media", required: false, order: 2 },
          
          // MARKETING SECTIONS
          { name: "Marketing Headline", slug: "marketing_headline", type: "text", required: false, order: 3 },
          { name: "Pricing Table", slug: "pricing_json", type: "json", required: false, order: 4 },
          
          // ABOUT & FOOTER
          { name: "Footer Content", slug: "footer_content", type: "richText", required: false, order: 5 },
          
          // SEO
          { name: "Meta Tags", slug: "meta_tags", type: "json", required: false, order: 6 },
        ]
      }
    }
  })

  console.log(`Successfully created GLOBAL Landing Page (ID: ${landingPage.id})`)
  console.log(`Manage this at: http://localhost:3000/admin/content-types/edit/${landingPage.slug}`)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
