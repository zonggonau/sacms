/**
 * Seed: storage add-on tiers (5/10/20/50/100GB, 1TB — 1-year flat top-up)
 * Run: bun run scripts/seed/seed-storage-addons.ts
 *
 * These tiers are intentionally NOT hardcoded in application code — they
 * live as "sacms-addons" ContentEntry rows (quota_type: "storage") under
 * the global tenant, same place every other admin-editable addon lives
 * (same convention as scripts/seed/setup-sacms.ts: the ContentType itself
 * is global with tenantId: null, its entries are scoped to the global
 * tenant's id). Pricing/size can be changed later straight from the CMS;
 * this script only establishes the starting catalogue and is safe to
 * re-run (it updates existing entries by addon_slug instead of duplicating
 * them).
 */

import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

/**
 * Resolve the global tenant the same way the live app does (see
 * src/lib/settings.ts's getGlobalWorkspaceId + billing/page.tsx's lookup):
 * the "globalTenantId" Setting holds either a real tenant id OR its slug,
 * falling back to the literal slug "sacms-global" when unset. Not imported
 * from @/lib/settings directly since standalone bun scripts don't resolve
 * the Next.js "@/" path alias.
 */
async function resolveGlobalTenant() {
  const setting = await db.setting.findFirst({ where: { key: "globalTenantId", tenantId: null } })
  const slugOrId = setting?.value || "sacms-global"
  return db.tenant.findFirst({ where: { OR: [{ id: slugOrId }, { slug: slugOrId }] } })
}

// New fields this content type needs beyond its original icon/name/description/price/unit set,
// so an admin can actually edit tier size/pricing/features from the CMS entry editor.
const NEW_FIELDS = [
  { slug: "addon_slug", name: "Addon Slug", type: "text", required: false, order: 10 },
  { slug: "plan_slug", name: "Plan Slug (checkout alias)", type: "text", required: false, order: 11 },
  { slug: "yearly_price", name: "Yearly Price", type: "number", required: false, order: 12 },
  { slug: "is_topup", name: "Is Top-up", type: "boolean", required: false, order: 13 },
  { slug: "quota_type", name: "Quota Type", type: "text", required: false, order: 14 },
  { slug: "amount_units", name: "Amount Units (bytes)", type: "number", required: false, order: 15 },
  { slug: "billing_period", name: "Billing Period", type: "text", required: false, order: 16 },
  { slug: "features", name: "Features", type: "json", required: false, order: 17 },
]

const GB = 1024 * 1024 * 1024

const STORAGE_TIERS = [
  { sizeLabel: "5 GB", gb: 5, price: 199_000 },
  { sizeLabel: "10 GB", gb: 10, price: 349_000 },
  { sizeLabel: "20 GB", gb: 20, price: 599_000 },
  { sizeLabel: "50 GB", gb: 50, price: 1_299_000 },
  { sizeLabel: "100 GB", gb: 100, price: 2_199_000 },
  { sizeLabel: "1 TB", gb: 1024, price: 14_999_000 },
].map((tier) => ({
  addon_slug: `storage_${tier.gb >= 1024 ? "1tb" : `${tier.gb}gb`}_1y`,
  plan_slug: `storage_${tier.gb >= 1024 ? "1tb" : `${tier.gb}gb`}_1y`,
  name: `Storage +${tier.sizeLabel} / Tahun`,
  description: `+${tier.sizeLabel} kapasitas storage workspace, berlaku 1 tahun sejak aktif.`,
  icon: "HardDrive",
  price: tier.price,
  yearly_price: tier.price,
  unit: "once",
  is_topup: true,
  quota_type: "storage",
  amount_units: tier.gb * GB,
  billing_period: "year",
  features: [`+${tier.sizeLabel} Storage`, "Berlaku 1 Tahun", "Aktif Langsung Setelah Bayar", "Bisa Diperpanjang Kapan Saja"],
}))

async function main() {
  console.log("🌱 Seeding storage add-on tiers...\n")

  const globalTenant = await resolveGlobalTenant()
  if (!globalTenant) {
    console.error(`❌ Global tenant not found (checked the "globalTenantId" setting and the "sacms-global" slug). Run scripts/seed/setup-sacms.ts first.`)
    process.exit(1)
  }
  console.log(`  ℹ️  Global tenant: ${globalTenant.name} (${globalTenant.id})`)

  // Matches setup-sacms.ts's syncContentType convention: the ContentType is
  // global (tenantId: null); only its entries are scoped to the global tenant.
  const contentType = await db.contentType.findFirst({ where: { tenantId: null, slug: "sacms-addons" } })
  if (!contentType) {
    console.error(`❌ Content type "sacms-addons" not found. Run scripts/seed/setup-sacms.ts first.`)
    process.exit(1)
  }

  // 1. Make sure the content type has the fields these entries need.
  for (const field of NEW_FIELDS) {
    await db.schemaField.upsert({
      where: { contentTypeId_slug: { contentTypeId: contentType.id, slug: field.slug } },
      update: { name: field.name, type: field.type, order: field.order, required: field.required },
      create: { contentTypeId: contentType.id, name: field.name, slug: field.slug, type: field.type, order: field.order, required: field.required },
    })
  }
  console.log(`  ✅ Ensured ${NEW_FIELDS.length} fields exist on sacms-addons`)

  // 2. Upsert each tier entry by addon_slug (update in place on re-run).
  const existingEntries = await db.contentEntry.findMany({ where: { tenantId: globalTenant.id, contentTypeId: contentType.id } })
  let created = 0
  let updated = 0

  for (const tierData of STORAGE_TIERS) {
    const existing = existingEntries.find((e) => {
      const d = (typeof e.data === "string" ? JSON.parse(e.data) : e.data) as any
      return d?.addon_slug === tierData.addon_slug
    })

    if (existing) {
      await db.contentEntry.update({
        where: { id: existing.id },
        data: { data: tierData as any, status: "PUBLISHED", publishedAt: existing.publishedAt ?? new Date() },
      })
      updated++
      console.log(`  🔄 Updated: ${tierData.addon_slug}`)
    } else {
      const entry = await db.contentEntry.create({
        data: {
          tenantId: globalTenant.id,
          contentTypeId: contentType.id,
          locale: "en",
          data: tierData as any,
          status: "PUBLISHED",
          publishedAt: new Date(),
          createdBy: "system",
          updatedBy: "system",
        },
      })
      await db.contentEntry.update({ where: { id: entry.id }, data: { documentId: entry.id } })
      created++
      console.log(`  📦 Created: ${tierData.addon_slug}`)
    }
  }

  console.log(`\n✨ Done — ${created} created, ${updated} updated.`)
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
