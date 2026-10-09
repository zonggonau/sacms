import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
    }
  })
  console.log("--- TENANT PLAN DEBUG ---")
  console.table(tenants)
  
  const entriesCount = await prisma.contentEntry.groupBy({
    by: ['tenantId'],
    _count: true
  })
  console.log("--- ENTRIES COUNT ---")
  console.log(entriesCount)
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
