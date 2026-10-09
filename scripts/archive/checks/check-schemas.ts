import { PrismaClient } from '../prisma/generated-client'

const db = new PrismaClient()

async function main() {
  const types = await db.contentType.findMany({
    where: { tenantId: null },
    select: { slug: true, name: true }
  })
  console.log(JSON.stringify(types, null, 2))
}

main().finally(() => db.$disconnect())
