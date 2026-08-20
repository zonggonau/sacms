import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const settings = await prisma.setting.findMany({
    where: {
      key: { contains: "v0" }
    }
  })
  console.log(settings)
}

main().catch(console.error).finally(() => prisma.$disconnect())
