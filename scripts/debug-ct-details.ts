
import { PrismaClient } from "../prisma/generated-client"
const prisma = new PrismaClient()

async function main() {
  const res = await prisma.contentType.findMany({ 
    select: { id: true, name: true, slug: true, isPublished: true, tenantId: true } 
  })
  console.log(JSON.stringify(res, null, 2))
}

main().finally(() => prisma.$disconnect())
