
import { PrismaClient } from "../prisma/generated-client"
const prisma = new PrismaClient()

async function main() {
  const res = await prisma.contentEntry.findMany({ 
    where: { contentType: { slug: 'sacms-workspace-pricing' } }, 
    select: { id: true, tenantId: true, status: true, data: true } 
  })
  console.log(JSON.stringify(res, null, 2))
}

main().finally(() => prisma.$disconnect())
