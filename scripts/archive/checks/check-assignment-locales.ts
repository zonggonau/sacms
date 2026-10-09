
import { PrismaClient } from "../prisma/generated-client"
const prisma = new PrismaClient()

async function main() {
  const res = await prisma.tenantSingleTypeAssignment.findMany({ 
    select: { locale: true, singleType: { select: { slug: true } }, tenantId: true } 
  })
  console.log(JSON.stringify(res, null, 2))
}

main().finally(() => prisma.$disconnect())
