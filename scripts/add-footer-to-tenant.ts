import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const tenantId = "cmnabljet002pujqgv55e09e0"
  console.log(`[Script] Adding Footer to tenant: ${tenantId}`)

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) {
    console.error("❌ Tenant not found.")
    return
  }

  // 1. Create Footer Single Type
  const footerST = await prisma.singleType.upsert({
    where: { 
      tenantId_slug: { tenantId, slug: "footer" } 
    },
    update: {},
    create: {
      tenantId,
      name: "Footer",
      slug: "footer",
      description: "Manage your site's footer content and social links",
      isPublished: true,
      fields: {
        create: [
          { name: "Copyright Text", slug: "copyright", type: "text", required: true, order: 0, options: "{}" },
          { name: "Social Links", slug: "socialLinks", type: "json", required: false, order: 1, options: "{}" },
          { name: "Footer Description", slug: "description", type: "textarea", required: false, order: 2, options: "{}" },
        ]
      }
    }
  })

  // 2. Assign and add initial data
  const initialData = {
    copyright: `© ${new Date().getFullYear()} My Workspace. All rights reserved.`,
    socialLinks: [
      { platform: "Twitter", url: "https://twitter.com" },
      { platform: "GitHub", url: "https://github.com" }
    ],
    description: "Built with SaCMS - The first Headless CMS from Papua."
  }

  await prisma.tenantSingleTypeAssignment.upsert({
    where: {
      tenantId_singleTypeId_locale: {
        tenantId,
        singleTypeId: footerST.id,
        locale: "en"
      }
    },
    update: {
      data: JSON.stringify(initialData)
    },
    create: {
      tenantId,
      singleTypeId: footerST.id,
      locale: "en",
      enabled: true,
      data: JSON.stringify(initialData),
      publishedAt: new Date()
    }
  })

  console.log(`✅ Footer added to tenant ${tenantId}`)
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
