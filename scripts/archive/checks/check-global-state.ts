
import { PrismaClient } from "../prisma/generated-client"
const prisma = new PrismaClient()

async function main() {
  const t = await prisma.tenant.findUnique({ where: { slug: "sacms-global" } })
  console.log("sacms-global exists:", !!t)
  
  const ctCount = await prisma.contentType.count({ where: { tenantId: null } })
  console.log("Truly Global CT Count:", ctCount)

  const entryCount = await prisma.contentEntry.count({ where: { tenantId: null } })
  console.log("Truly Global Entry Count:", entryCount)
}

main().finally(() => prisma.$disconnect())
