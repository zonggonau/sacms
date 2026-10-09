import { PrismaClient } from "../prisma/generated-client"
const prisma = new PrismaClient()

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { slug: true } })
  console.log("Tenants in DB:", tenants.map(t => t.slug))
}

main().finally(() => prisma.$disconnect())
