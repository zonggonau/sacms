/**
 * One-time backfill: copies the existing CMS Content Entries under
 * sacms-account-pricing / sacms-workspace-pricing / sacms-ai-pricing /
 * sacms-addons (the "SaCMS Global" tenant's pricing content) into the new
 * AccountPlan / WorkspacePlan / AiCreditPack / Addon tables (see the long
 * comment above those models in prisma/schema.prisma).
 *
 * Does NOT delete or modify the source CMS content types/entries — those
 * stay exactly as they are, readable by the old code paths, until every
 * caller has been migrated to src/lib/pricing.ts and verified. Safe to run
 * more than once: every write is an `upsert` keyed by slug.
 */
import { db } from "@/lib/database"

function cleanNum(val: unknown, fallback = 0): number {
  if (typeof val === "number") return val
  if (typeof val === "string") return parseInt(val.replace(/[^\d.-]/g, ""), 10) || fallback
  return fallback
}

function cleanNumOrNull(val: unknown): number | null {
  if (val === undefined || val === null || val === "") return null
  return cleanNum(val, 0)
}

function parseData(raw: unknown): Record<string, any> {
  if (typeof raw === "string") {
    try { return JSON.parse(raw) } catch { return {} }
  }
  return (raw as Record<string, any>) || {}
}

async function getPublishedEntries(slug: string) {
  const contentType = await db.contentType.findFirst({ where: { slug } })
  if (!contentType) {
    console.log(`  (skip — content type "${slug}" not found)`)
    return []
  }
  return db.contentEntry.findMany({
    where: { contentTypeId: contentType.id, status: "PUBLISHED" },
    orderBy: { createdAt: "asc" },
  })
}

async function backfillAccountPlans() {
  console.log("Account plans (sacms-account-pricing)...")
  const entries = await getPublishedEntries("sacms-account-pricing")
  for (const [i, entry] of entries.entries()) {
    const d = parseData(entry.data)
    if (!d.plan_slug) continue
    await db.accountPlan.upsert({
      where: { slug: d.plan_slug },
      create: {
        slug: d.plan_slug,
        name: d.name || d.plan_slug,
        description: d.description || null,
        price: cleanNum(d.price),
        yearlyPrice: cleanNumOrNull(d.yearly_price),
        maxWorkspaces: cleanNum(d.max_workspaces),
        features: d.features ?? undefined,
        isPopular: Boolean(d.is_popular),
        ctaText: d.cta_text || null,
        ctaHref: d.cta_href || null,
        order: i,
      },
      update: {
        name: d.name || d.plan_slug,
        description: d.description || null,
        price: cleanNum(d.price),
        yearlyPrice: cleanNumOrNull(d.yearly_price),
        maxWorkspaces: cleanNum(d.max_workspaces),
        features: d.features ?? undefined,
        isPopular: Boolean(d.is_popular),
        ctaText: d.cta_text || null,
        ctaHref: d.cta_href || null,
        order: i,
      },
    })
    console.log(`  upserted: ${d.plan_slug}`)
  }
}

async function backfillWorkspacePlans() {
  console.log("Workspace plans (sacms-workspace-pricing)...")
  const entries = await getPublishedEntries("sacms-workspace-pricing")
  for (const [i, entry] of entries.entries()) {
    const d = parseData(entry.data)
    if (!d.plan_slug) continue
    const base = {
      name: d.name || d.plan_slug,
      description: d.description || null,
      price: cleanNum(d.price),
      yearlyPrice: cleanNumOrNull(d.yearly_price),
      maxContentTypes: cleanNum(d.max_content_types),
      maxContentEntries: cleanNum(d.max_content_entries),
      maxTeamMembers: cleanNum(d.max_team_members),
      maxStorageMb: cleanNum(d.max_storage),
      maxLocales: cleanNum(d.max_locales),
      maxApiCalls: cleanNum(d.max_api_calls),
      fairUseBandwidthGb: cleanNumOrNull(d.fair_use_bandwidth_gb),
      features: d.features ?? undefined,
      order: i,
    }
    await db.workspacePlan.upsert({
      where: { slug: d.plan_slug },
      create: { slug: d.plan_slug, ...base },
      update: base,
    })
    console.log(`  upserted: ${d.plan_slug}`)
  }
}

async function backfillAiCreditPacks() {
  console.log("AI credit packs (sacms-ai-pricing)...")
  const entries = await getPublishedEntries("sacms-ai-pricing")
  for (const [i, entry] of entries.entries()) {
    const d = parseData(entry.data)
    if (!d.pack_slug) continue
    const base = {
      name: d.name || d.pack_slug,
      description: d.description || null,
      credits: cleanNum(d.credits),
      priceUsd: cleanNum(d.price_usd),
      price: cleanNum(d.price),
      badge: d.badge || null,
      features: d.features ?? undefined,
      order: i,
    }
    await db.aiCreditPack.upsert({
      where: { slug: d.pack_slug },
      create: { slug: d.pack_slug, ...base },
      update: base,
    })
    console.log(`  upserted: ${d.pack_slug}`)
  }
}

async function backfillAddons() {
  console.log("Addons (sacms-addons)...")
  const entries = await getPublishedEntries("sacms-addons")
  for (const [i, entry] of entries.entries()) {
    const d = parseData(entry.data)
    if (!d.addon_slug) continue
    const base = {
      name: d.name || d.addon_slug,
      description: d.description || null,
      icon: d.icon || null,
      price: cleanNumOrNull(d.price),
      priceLabel: d.price_label || null,
      unit: d.unit || null,
      featureKey: d.feature_key || null,
      checkoutAlias: d.plan_slug || null,
      yearlyPrice: cleanNumOrNull(d.yearly_price),
      isTopup: Boolean(d.is_topup),
      quotaType: d.quota_type || null,
      amountUnits: d.amount_units !== undefined && d.amount_units !== null ? BigInt(cleanNum(d.amount_units)) : null,
      billingPeriod: d.billing_period || null,
      features: d.features ?? undefined,
      order: i,
    }
    await db.addon.upsert({
      where: { slug: d.addon_slug },
      create: { slug: d.addon_slug, ...base },
      update: base,
    })
    console.log(`  upserted: ${d.addon_slug}`)
  }
}

async function main() {
  await backfillAccountPlans()
  await backfillWorkspacePlans()
  await backfillAiCreditPacks()
  await backfillAddons()
  console.log("Backfill completed.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
