
import { PrismaClient } from "../prisma/generated-client"
const prisma = new PrismaClient()

async function main() {
  const slug = "sacms-features"
  const contentType = await prisma.contentType.findFirst({
    where: { slug, tenantId: null }
  })
  
  if (!contentType) {
    console.log("CT Not Found")
    return
  }

  const status = "PUBLISHED"
  
  // RAW SQL check (mirroring the API)
  const entriesRaw = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM "content_entries" WHERE "contentTypeId" = $1 AND "status"::text = $2 AND "tenantId" IS NULL`,
    contentType.id,
    status
  )

  console.log("Raw SQL Results:", entriesRaw)
}

main().finally(() => prisma.$disconnect())
