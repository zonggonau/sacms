/**
 * Script: Clear sacms-global seed data
 * Deletes all content entries AND content types from sacms-global tenant.
 * Run: npx tsx scripts/clear-global.ts
 */

import { PrismaClient } from "../prisma/generated-client"

const db = new PrismaClient()
const GLOBAL_SLUG = "sacms-global"

async function main() {
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

  console.log(`\n🧹 sacms-global is now clean. Run seed-global.ts to re-seed.`)
}

main()
  .catch((e) => {
    console.error("❌ Clear failed:", e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
