/**
 * Script: Clear sacms-global seed data
 * Deletes all content entries AND content types from sacms-global tenant.
 * Run: bun scripts/seed/clear-global.ts
 */
import { db } from "@/lib/database"

const GLOBAL_SLUG = "sacms-global"

export async function clearGlobalData() {
  console.log("🗑️  Clearing sacms-global seed data...\n")

  const tenant = await db.tenant.findUnique({ where: { slug: GLOBAL_SLUG } })
  if (!tenant) {
    console.log("ℹ️  Tenant sacms-global not found — nothing to clear.")
    return
  }

  console.log(`Found tenant: ${tenant.name} (${tenant.id})`)

  // 1. Delete all content entries
  const { count: deletedEntries } = await db.contentEntry.deleteMany({
    where: { tenantId: tenant.id },
  })
  console.log(`✅ Deleted ${deletedEntries} content entries`)

  // 2. Delete all content types (fields cascade-deleted automatically)
  const { count: deletedTypes } = await db.contentType.deleteMany({
    where: { tenantId: tenant.id },
  })
  console.log(`✅ Deleted ${deletedTypes} content types (fields cascade-deleted)`)

  console.log(`\n🧹 sacms-global is now clean. Run seed-all-global.ts to re-seed.`)
}

if (import.meta.main) {
  clearGlobalData()
    .catch((e) => {
      console.error("❌ Clear failed:", e)
      process.exit(1)
    })
    .finally(() => db.$disconnect())
}
