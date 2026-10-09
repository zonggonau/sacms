
import { PrismaClient } from "../prisma/generated-client"
const prisma = new PrismaClient()

async function main() {
  const comps = await prisma.component.findMany({
    select: { id: true, name: true, slug: true, tenantId: true }
  })
  console.log(JSON.stringify(comps, null, 2))
}

main().finally(() => prisma.$disconnect())
