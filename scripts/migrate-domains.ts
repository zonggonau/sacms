import { db } from "../src/lib/database"

async function migrateDomains() {
  console.log("Starting domain migration...")

  const tenantsWithDomain = await db.tenant.findMany({
    where: {
      customDomain: { not: null },
    },
    select: {
      id: true,
      customDomain: true,
      customDomainStatus: true,
      customDomainVerifiedAt: true,
    }
  })

  console.log(`Found ${tenantsWithDomain.length} tenants with custom domains.`)

  for (const tenant of tenantsWithDomain) {
    if (!tenant.customDomain) continue

    const existing = await db.customDomain.findUnique({
      where: { domain: tenant.customDomain }
    })

    if (!existing) {
      await db.customDomain.create({
        data: {
          tenantId: tenant.id,
          domain: tenant.customDomain,
          status: tenant.customDomainStatus || "pending",
          verifiedAt: tenant.customDomainVerifiedAt,
          isPrimary: true,
        }
      })
      console.log(`Migrated domain ${tenant.customDomain} for tenant ${tenant.id}`)
    } else {
      console.log(`Domain ${tenant.customDomain} already exists in CustomDomain table.`)
    }
  }

  console.log("Migration completed.")
}

migrateDomains()
  .catch(console.error)
  .finally(() => process.exit(0))
