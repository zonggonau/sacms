import { db, getTenantDatabaseUrl, PrismaClient } from "@/lib/database"

async function verifyReleaseSchema() {
  await db.paymentTransaction.findFirst({ select: { fulfillmentStatus: true } })
  await db.subscription.findFirst({
    select: { billingInterval: true, recurringAmount: true, tenantNameSnapshot: true, tenantSlugSnapshot: true, userNameSnapshot: true },
  })
  const retentionRules = await db.$queryRaw<{ constraint_name: string }[]>`
    SELECT constraint_name
    FROM information_schema.referential_constraints
    WHERE constraint_schema = current_schema() AND delete_rule = 'SET NULL'
      AND constraint_name IN ('subscriptions_userId_fkey', 'subscriptions_tenantId_fkey')
  `
  if (retentionRules.length !== 2) throw new Error("Subscription foreign keys must retain billing records.")
  await db.tenantSingleTypeAssignment.findFirst({ select: { draftData: true } })

  const tenants = await db.tenant.findMany({ select: { id: true, slug: true, databaseUrl: true } })
  const checkedUrls = new Set<string>()
  for (const tenant of tenants) {
    const url = await getTenantDatabaseUrl(tenant)
    if (!url || checkedUrls.has(url)) continue

    const client = new PrismaClient({ datasources: { db: { url } } })
    try {
      await client.tenantSingleTypeAssignment.findFirst({ select: { draftData: true } })
      checkedUrls.add(url)
    } catch {
      throw new Error(`Dedicated database for "${tenant.slug}" needs connectivity and schema verification.`)
    } finally {
      await client.$disconnect()
    }
  }
  console.log(`Release schema verified on the shared database and ${checkedUrls.size} dedicated database(s).`)
}

try {
  await verifyReleaseSchema()
} catch (error) {
  console.error(error instanceof Error ? error.message : "Database schema verification failed.")
  process.exitCode = 1
} finally {
  await db.$disconnect()
}
