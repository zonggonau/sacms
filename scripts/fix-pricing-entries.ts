import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("🚀 Fixing platform-pricing entries...")

  const ct = await prisma.contentType.findUnique({
    where: { slug: "platform-pricing" }
  })

  if (!ct) {
    console.error("❌ Content Type 'platform-pricing' not found.")
    return
  }

  const entries = await prisma.contentEntry.findMany({
    where: { contentTypeId: ct.id }
  })

  console.log(`Updating ${entries.length} entries...`)

  for (const entry of entries) {
    let data = entry.data as any
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
      } catch (e) {
        console.error("Failed to parse data for entry", entry.id)
        continue
      }
    }
    
    let type = "plan"
    if (data.name && (data.name.toLowerCase().includes("backup") || data.name.toLowerCase().includes("storage"))) {
      type = "addon"
    } else if (["Starter", "Pro", "Enterprise"].includes(data.name)) {
      type = "plan"
    }

    await prisma.contentEntry.update({
      where: { id: entry.id },
      data: {
        data: {
          ...data,
          type: type
        }
      }
    })
    console.log(`✅ Entry "${data.name}" updated to type: ${type}`)
  }

  console.log("\n✨ Fix complete!")
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
