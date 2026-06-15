
import { PrismaClient } from "../prisma/generated-client"
const prisma = new PrismaClient()

async function main() {
  const token = "cf_cc0045e6f75d9cb58a5a81a4b03dbc5602258b70c06c5c6ce8be304e9474b5fd"
  const setting = await prisma.setting.findUnique({ where: { key: "systemApiKey" } })
  console.log("Token in setting:", setting?.value)
  console.log("Matches:", setting?.value === token)

  const hero = await prisma.singleType.findFirst({
    where: { slug: "sacms-hero", tenantId: null },
    include: {
      assignments: {
        where: { tenantId: null }
      }
    }
  })

  console.log("Hero SingleType:", hero?.id)
  console.log("Hero Data:", hero?.assignments?.[0]?.data ? "Present" : "Missing")
}

main().finally(() => prisma.$disconnect())
