import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  const entries = await prisma.contentEntry.findMany({
    where: { contentType: { slug: "sacms-workspace-pricing" } },
    select: { id: true, documentId: true, locale: true, tenantId: true, status: true, data: true, createdAt: true, updatedAt: true }
  })
  console.log("Count:", entries.length)
  for (const e of entries) {
    console.log({
      id: e.id,
      documentId: e.documentId,
      locale: e.locale,
      tenantId: e.tenantId,
      status: e.status,
      name: (e.data as any)?.name,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt
    })
  }
}
main().finally(() => prisma.$disconnect())
