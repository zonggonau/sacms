
import { PrismaClient } from "../prisma/generated-client"
const prisma = new PrismaClient()

async function main() {
  const total = await prisma.contentType.count()
  const global = await prisma.contentType.count({ where: { tenantId: null } })
  const perTenant = await prisma.contentType.groupBy({
    by: ['tenantId'],
    _count: { _all: true }
  })

  console.log({
    total,
    global,
    perTenant
  })
}

main().finally(() => prisma.$disconnect())
