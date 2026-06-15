
import { PrismaClient } from "../prisma/generated-client"
const prisma = new PrismaClient()

async function main() {
  const slug = "sacms-hero"
  
  // Simulation of src/app/api/public/single/[singleType]/route.ts
  const singleType = await prisma.singleType.findFirst({
    where: { slug, tenantId: null },
    include: { fields: { orderBy: { order: "asc" } } }
  })

  if (!singleType) {
    console.log("Single Type Not Found")
    return
  }

  const assignment = await prisma.tenantSingleTypeAssignment.findFirst({
    where: {
      singleTypeId: singleType.id,
      locale: "en",
      tenantId: null
    }
  })

  if (!assignment) {
    console.log("Assignment Not Found")
    return
  }

  console.log("Data:", JSON.stringify(assignment.data, null, 2))
}

main().finally(() => prisma.$disconnect())
