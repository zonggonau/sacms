
import { PrismaClient } from "../prisma/generated-client"
const prisma = new PrismaClient()

async function main() {
  const slug = "sacms-features"
  const ct = await prisma.contentType.findFirst({
    where: { slug, tenantId: null },
    include: { fields: true }
  })
  
  console.log("Fields count:", ct?.fields.length)
  console.log("Fields slugs:", ct?.fields.map(f => f.slug))
}

main().finally(() => prisma.$disconnect())
