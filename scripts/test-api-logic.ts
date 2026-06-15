
import { PrismaClient } from "../prisma/generated-client"
const prisma = new PrismaClient()

async function main() {
  const contentTypes = await prisma.contentType.findMany({
    where: { tenantId: null },
    include: {
      fields: true,
      tenants: {
        include: {
          tenant: { select: { id: true, name: true, slug: true } }
        }
      },
      _count: { select: { entries: true, tenants: true } }
    }
  })

  console.log("Count:", contentTypes.length)
  if (contentTypes.length > 0) {
    console.log("First item:", JSON.stringify(contentTypes[0], null, 2))
  }
}

main().finally(() => prisma.$disconnect())
