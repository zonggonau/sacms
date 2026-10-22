import { db } from "@/lib/database"

/**
 * Storage add-on: extra storage on top of a workspace's plan quota, sold as
 * a flat one-year top-up. Tiers (5/10/20/50/100GB, 1TB) and their prices are
 * NOT hardcoded here — they live in the Addon table (src/lib/pricing.ts,
 * rows with quotaType: "storage", originally seeded by
 * scripts/seed/seed-storage-addons.ts into the old CMS catalog and migrated
 * by scripts/migrate/backfill-pricing-plans.ts) so an admin can add/retire
 * tiers or change prices from /admin/pricing without a deploy. Only
 * the one-year duration is fixed in code, since every tier is sold on that
 * same term by design. Each purchase is its own row, so two purchases in
 * the same year add up. Renewing an add-on starts the new year when the
 * renewed one expires, so there is no gap and no overlap.
 */

export const STORAGE_QUOTA_TYPE = "storage"

/** Same day next month, or that month's last day when it is shorter (31 Jan → 28/29 Feb). */
export function addOneMonth(date: Date): Date {
  const next = new Date(date)
  const day = next.getUTCDate()
  next.setUTCMonth(next.getUTCMonth() + 1)
  if (next.getUTCDate() < day) next.setUTCDate(0)
  return next
}

/** Same day next year, or Feb 28 when the purchase date was a Feb 29. */
export function addOneYear(date: Date): Date {
  const next = new Date(date)
  const day = next.getUTCDate()
  next.setUTCFullYear(next.getUTCFullYear() + 1)
  if (next.getUTCDate() < day) next.setUTCDate(0)
  return next
}

/** Why a renewal of `addonId` cannot be bought, or null when it can. */
export async function storageAddonRenewalRefusal(tenantId: string, addonId: string): Promise<string | null> {
  const addon = await db.storageAddon.findFirst({ where: { id: addonId, tenantId } })
  if (!addon) return "Add-on storage yang ingin diperpanjang tidak ditemukan di workspace ini."
  const renewal = await db.storageAddon.findUnique({ where: { renewsAddonId: addon.id } })
  if (renewal) return "Add-on storage ini sudah diperpanjang."
  return null
}

/**
 * Record a paid storage add-on. `bytes` is whatever tier size was actually
 * paid for — resolved at checkout time from the CMS catalog and carried in
 * the payment's rawResponse (see addon-fulfillment.ts) — never a fixed
 * constant, so a later catalog/price edit can't silently change what an
 * already-paid order grants. Keyed by the payment order, so the Midtrans
 * webhook and the payment status route can both process the same order
 * without granting it twice.
 */
export async function grantStorageAddon(
  tenantId: string,
  orderId: string,
  bytes: number,
  options: { renewsAddonId?: string | null; now?: Date } = {},
) {
  const now = options.now ?? new Date()
  let startsAt = now
  let renewsAddonId: string | undefined

  if (options.renewsAddonId && !(await storageAddonRenewalRefusal(tenantId, options.renewsAddonId))) {
    const renewed = await db.storageAddon.findFirst({ where: { id: options.renewsAddonId, tenantId } })
    if (renewed) {
      renewsAddonId = renewed.id
      if (renewed.expiresAt > now) startsAt = renewed.expiresAt
    }
  }

  return db.storageAddon.upsert({
    where: { orderId },
    update: {},
    create: {
      tenantId,
      orderId,
      bytes: BigInt(bytes),
      startsAt,
      expiresAt: addOneYear(startsAt),
      ...(renewsAddonId ? { renewsAddonId } : {}),
    },
  })
}
