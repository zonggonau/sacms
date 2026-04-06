import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const tenantSlug = "06a30a1fe1"
  const contentTypeSlug = "menu"

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug }
  })

  if (!tenant) {
    console.log(`Tenant not found: ${tenantSlug}`)
    const allTenants = await prisma.tenant.findMany({ select: { slug: true, name: true } })
    console.log("All tenants:", allTenants)
    return
  }

  console.log(`Found tenant: ${tenant.name} (${tenant.id})`)

  const contentType = await prisma.contentType.findFirst({
    where: {
      slug: contentTypeSlug,
      OR: [
        { tenantId: tenant.id },
        { 
          tenantId: null, 
          tenants: { some: { tenantId: tenant.id, enabled: true } } 
        }
      ]
    },
    include: {
      tenants: {
        include: {
          tenant: true
        }
      }
    }
  })

  if (!contentType) {
    console.log(`Content type NOT found for tenant: ${contentTypeSlug}`)
    const allContentTypes = await prisma.contentType.findMany({
        where: { slug: contentTypeSlug },
        include: { tenants: { include: { tenant: true } } }
    })
    console.log(`All content types with slug '${contentTypeSlug}':`, JSON.stringify(allContentTypes, null, 2))
  } else {
    console.log(`Content type FOUND: ${contentType.name} (${contentType.id})`)
    console.log(`Is global: ${contentType.tenantId === null}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
