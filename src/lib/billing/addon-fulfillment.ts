import { STORAGE_ADDON_ID, grantStorageAddon } from "./storage-addon"
import { fulfillManagedInfraOrder, isManagedInfraProduct } from "./managed-infra"

/**
 * Checkout stores what was bought in PaymentTransaction.rawResponse; payment providers
 * report back on the same row. Keep the checkout fields and file the provider's payload
 * under `provider`, so a "pending" notification cannot erase `addonId` before settlement.
 */
export function mergeProviderResponse(existing: unknown, providerPayload: unknown): Record<string, unknown> {
  const base = existing && typeof existing === "object" && !Array.isArray(existing) ? (existing as Record<string, unknown>) : {}
  return { ...base, provider: providerPayload }
}

/**
 * Add-ons whose purchase needs more than a counter increment. Returns true when this
 * module handled the order. Shared by the Midtrans webhook and the payment status route.
 */
export async function fulfillAddonOrder(params: {
  tenantId: string
  orderId: string
  raw: Record<string, any>
  userId?: string | null
}): Promise<boolean> {
  const addonId = String(params.raw.addonId || "")
  if (addonId === STORAGE_ADDON_ID) {
    await grantStorageAddon(params.tenantId, params.orderId, { renewsAddonId: params.raw.renewsAddonId })
    return true
  }
  if (isManagedInfraProduct(addonId)) {
    await fulfillManagedInfraOrder({
      tenantId: params.tenantId,
      orderId: params.orderId,
      productId: addonId,
      userId: params.userId,
    })
    return true
  }
  return false
}
