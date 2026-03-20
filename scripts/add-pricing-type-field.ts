import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  console.log("🚀 Adding 'type' field to 'platform-pricing' content type...")

  const ct = await prisma.contentType.findUnique({
    where: { slug: "platform-pricing" },
    include: { fields: true }
  })

  if (!ct) {
    console.error("❌ Content Type 'platform-pricing' not found.")
    return
  }

  const hasTypeField = ct.fields.some(f => f.slug === "type")

  if (!hasTypeField) {
    await prisma.contentTypeField.create({
      data: {
        contentTypeId: ct.id,
        name: "Type",
        slug: "type",
        type: "select",
        options: {
          choices: [
            { label: "Main Plan", value: "plan" },
            { label: "Add-on", value: "addon" }
          ]
        },
        required: true,
        order: ct.fields.length
      }
    })
    console.log("✅ Field 'type' added to 'platform-pricing'.")
  } else {
    console.log("ℹ️ Field 'type' already exists.")
  }

  // Update existing entries
  const entries = await prisma.contentEntry.findMany({
    where: { contentTypeId: ct.id }
  })

  console.log(`Updating ${entries.length} entries...`)

  for (const entry of entries) {
    const data = entry.data as any
    let type = "plan"
    
    if (data.name && (data.name.toLowerCase().includes("backup") || data.name.toLowerCase().includes("storage"))) {
      type = "addon"
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

  console.log("\n✨ Migration complete!")
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
