
import { PrismaClient } from "../prisma/generated-client"
const prisma = new PrismaClient()

async function main() {
  const setting = await prisma.setting.findUnique({ where: { key: "systemApiKey" } })
  console.log("System API Key in DB:", setting?.value)
}

main().finally(() => prisma.$disconnect())
