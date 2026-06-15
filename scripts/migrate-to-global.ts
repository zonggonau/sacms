
import { PrismaClient } from "../prisma/generated-client"
const prisma = new PrismaClient()

async function migrate() {
  console.log("🚀 Starting migration from 'sacms-global' to 'Global Content'...")

  const globalTenant = await prisma.tenant.findUnique({
    where: { slug: "sacms-global" }
  })

  if (!globalTenant) {
    console.log("❌ sacms-global tenant not found. Nothing to migrate.")
    return
  }

  const tId = globalTenant.id

  try {
    // 1. Migrate ContentTypes
    console.log("- Migrating Content Types...")
    await prisma.contentType.updateMany({
      where: { tenantId: tId },
      data: { tenantId: null }
    })

    // 2. Migrate SingleTypes
    console.log("- Migrating Single Types...")
    await prisma.singleType.updateMany({
      where: { tenantId: tId },
      data: { tenantId: null }
    })

    // 3. Migrate Components
    console.log("- Migrating Components...")
    await prisma.component.updateMany({
      where: { tenantId: tId },
      data: { tenantId: null }
    })

    // 4. Migrate ContentEntries
    console.log("- Migrating Content Entries...")
    await prisma.contentEntry.updateMany({
      where: { tenantId: tId },
      data: { tenantId: null }
    })

    // 5. Migrate Assignments
    console.log("- Migrating Assignments...")
    await prisma.tenantContentTypeAssignment.updateMany({
      where: { tenantId: tId },
      data: { tenantId: null }
    })
    await prisma.tenantSingleTypeAssignment.updateMany({
      where: { tenantId: tId },
      data: { tenantId: null }
    })
    await prisma.tenantComponentAssignment.updateMany({
      where: { tenantId: tId },
      data: { tenantId: null }
    })

    console.log("✅ Migration complete! sacms-global data is now Truly Global.")
  } catch (err) {
    console.error("❌ Migration failed:", err)
  }
}

migrate().finally(() => prisma.$disconnect())
