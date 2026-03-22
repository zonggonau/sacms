import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("🚀 Creating 'Documentation' Content Type...")

  const ctDoc = await prisma.contentType.upsert({
    where: { slug: "documentation" },
    update: {},
    create: {
      name: "Documentation",
      slug: "documentation",
      description: "Official guide and API documentation for SaCMS",
      isPublished: true,
      fields: {
        create: [
          { name: "Title", slug: "title", type: "text", required: true, order: 0 },
          { name: "Slug", slug: "slug", type: "text", required: true, order: 1 },
          { name: "Category", slug: "category", type: "select", options: "Getting Started,API,Advanced,Guides", required: true, order: 2 },
          { name: "Content", slug: "content", type: "richText", required: true, order: 3 },
          { name: "Order", slug: "order", type: "number", required: false, order: 4 },
        ]
      }
    }
  })

  console.log("✅ Documentation model ready:", ctDoc.slug)
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
