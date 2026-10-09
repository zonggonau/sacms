import { PrismaClient } from "../prisma/generated-client"
import { getGlobalWorkspaceId } from "../src/lib/settings"

const prisma = new PrismaClient()

async function main() {
  const globalId = await getGlobalWorkspaceId()
  console.log("Global workspace ID:", globalId)
  const entries = await prisma.contentEntry.findMany({
    where: { contentType: { slug: { in: ["sacms-account-pricing", "sacms-workspace-pricing"] } } },
    select: { id: true, tenantId: true, contentType: { select: { slug: true } }, data: true }
  })
  console.log("Entries:", JSON.stringify(entries, null, 2))
}

main().finally(() => prisma.$disconnect())
