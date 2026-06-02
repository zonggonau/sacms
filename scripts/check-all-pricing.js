
const { PrismaClient } = require("./prisma/generated-client")
const prisma = new PrismaClient()

async function main() {
  const slugs = ["sacms-workspace-pricing", "sacms-account-pricing"]
  for (const slug of slugs) {
    console.log(`\n--- ${slug} ---`)
    const ct = await prisma.contentType.findFirst({ where: { slug } })
    if (!ct) {
      console.log("Not found")
      continue
    }
    const entries = await prisma.contentEntry.findMany({ where: { contentTypeId: ct.id } })
    console.log(`Found ${entries.length} entries`)
    entries.forEach(e => {
      console.log(`- ${e.data.name || e.data.title || 'No Name'}: ${JSON.stringify(e.data)}`)
    })
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
