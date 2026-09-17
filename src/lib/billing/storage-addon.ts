import { db } from "@/lib/database"

/**
 * Storage add-on: extra storage on top of a workspace's plan quota, valid for one month.
 * Each purchase is its own row, so two purchases in the same month add up. Renewing an
 * add-on starts the new month when the renewed one expires, so there is no gap and no
 * overlap.
 */

export const STORAGE_ADDON_ID = "topup_storage_10gb"
export const STORAGE_ADDON_BYTES = 10 * 1024 * 1024 * 1024
export const STORAGE_ADDON_PRICE_IDR = 50_000

/** Same day next month, or that month's last day when it is shorter (31 Jan → 28/29 Feb). */
export function addOneMonth(date: Date): Date {
  const next = new Date(date)
  const day = next.getUTCDate()
  next.setUTCMonth(next.getUTCMonth() + 1)
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
 * Record a paid storage add-on. Keyed by the payment order, so the Midtrans webhook and the
 * payment status route can both process the same order without granting it twice.
 */
export async function grantStorageAddon(
  tenantId: string,
  orderId: string,
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
      bytes: BigInt(STORAGE_ADDON_BYTES),
      startsAt,
      expiresAt: addOneMonth(startsAt),
      ...(renewsAddonId ? { renewsAddonId } : {}),
    },
  })
}
