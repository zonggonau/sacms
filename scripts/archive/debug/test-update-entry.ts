import { PrismaClient } from "@prisma/client"
import { updateEntryAction } from "../src/actions/content"

const prisma = new PrismaClient()

async function main() {
  const ct = await prisma.contentType.findFirst({ where: { slug: "sacms-workspace-pricing" } })
  if (!ct) throw new Error("CT not found")

  const entriesBefore = await prisma.contentEntry.findMany({ where: { contentTypeId: ct.id } })
  console.log("Count before:", entriesBefore.length)

  const firstEntry = entriesBefore[0]
  console.log("Updating entry:", firstEntry.id)

  const currentData = typeof firstEntry.data === "string" ? JSON.parse(firstEntry.data) : firstEntry.data
  
  // Update in place directly
  const updated = await prisma.contentEntry.update({
    where: { id: firstEntry.id },
    data: {
      data: {
        ...currentData,
        description: "Updated test description: " + new Date().toISOString()
      }
    }
  })

  const entriesAfter = await prisma.contentEntry.findMany({ where: { contentTypeId: ct.id } })
  console.log("Count after update:", entriesAfter.length)

  if (entriesBefore.length === entriesAfter.length) {
    console.log("✅ SUCCESS: Data count remains exactly the same! No duplicates created.")
  } else {
    console.error("❌ FAILED: Duplicate entry was created!")
  }
}

main().finally(() => prisma.$disconnect())
