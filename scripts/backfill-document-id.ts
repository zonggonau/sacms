import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const result = await prisma.$executeRawUnsafe(`UPDATE content_entries SET "documentId" = id WHERE "documentId" IS NULL`)
  console.log("Backfilled documentId on null entries. Rows affected:", result)
}
main().finally(() => prisma.$disconnect())
