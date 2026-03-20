import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("🚀 Starting Startup Management Model Setup...")

  const models = [
    {
      name: "Landing Page Config",
      slug: "lp-config",
      description: "Main configuration for the startup platform landing page",
      fields: [
        { name: "Hero Title", slug: "hero_title", type: "text", required: true },
        { name: "Hero Subtitle", slug: "hero_subtitle", type: "textarea", required: true },
        { name: "Hero Image", slug: "hero_image", type: "media", required: false },
        { name: "Primary CTA Text", slug: "cta_text", type: "text", required: false },
        { name: "Primary CTA Link", slug: "cta_link", type: "text", required: false },
      ]
    },
    {
      name: "Startup Blog",
      slug: "startup-blog",
      description: "Articles and news about our startup ecosystem",
      fields: [
        { name: "Title", slug: "title", type: "text", required: true },
        { name: "Slug", slug: "slug", type: "slug", required: true },
        { name: "Content", slug: "content", type: "richText", required: true },
        { name: "Excerpt", slug: "excerpt", type: "textarea", required: false },
        { name: "Featured Image", slug: "featured_image", type: "media", required: false },
        { name: "Author", slug: "author", type: "text", required: false },
      ]
    },
    {
      name: "Platform Features",
      slug: "platform-features",
      description: "List of features offered by the platform",
      fields: [
        { name: "Feature Name", slug: "title", type: "text", required: true },
        { name: "Description", slug: "description", type: "textarea", required: true },
        { name: "Icon Name", slug: "icon", type: "text", required: false },
        { name: "Display Order", slug: "order", type: "number", required: false },
      ]
    },
    {
      name: "Pricing Plans",
      slug: "platform-pricing",
      description: "Subscription plans for startups",
      fields: [
        { name: "Plan Name", slug: "name", type: "text", required: true },
        { name: "Price (Monthly)", slug: "price", type: "number", required: true },
        { name: "Features List (JSON)", slug: "features", type: "json", required: false },
        { name: "Is Popular", slug: "is_popular", type: "boolean", required: false },
      ]
    },
    {
      name: "Testimonials",
      slug: "platform-testimonials",
      description: "Customer success stories and reviews",
      fields: [
        { name: "Customer Name", slug: "name", type: "text", required: true },
        { name: "Company", slug: "company", type: "text", required: false },
        { name: "Avatar", slug: "avatar", type: "media", required: false },
        { name: "Quote", slug: "quote", type: "textarea", required: true },
        { name: "Rating", slug: "rating", type: "number", required: false },
      ]
    },
    {
      name: "Contact Info",
      slug: "platform-contact",
      description: "Official contact details and office location",
      fields: [
        { name: "Office Address", slug: "address", type: "textarea", required: true },
        { name: "Support Email", slug: "email", type: "email", required: true },
        { name: "Phone Number", slug: "phone", type: "text", required: true },
        { name: "Google Maps Embed URL", slug: "maps_url", type: "text", required: false },
      ]
    }
  ]

  for (const model of models) {
    await prisma.contentType.upsert({
      where: { slug: model.slug },
      update: {},
      create: {
        tenantId: null, // Global Super Admin access only
        name: model.name,
        slug: model.slug,
        description: model.description,
        isPublished: true,
        fields: {
          create: model.fields.map((f, idx) => ({
            name: f.name,
            slug: f.slug,
            type: f.type,
            required: f.required,
            order: idx
          }))
        }
      }
    })
    console.log(`✅ Model "${model.name}" created.`)
  }

  console.log("\n✨ Startup Management Ecosystem is ready!")
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
