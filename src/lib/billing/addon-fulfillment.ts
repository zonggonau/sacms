import { STORAGE_QUOTA_TYPE, grantStorageAddon } from "./storage-addon"

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
  if (params.raw.quotaType === STORAGE_QUOTA_TYPE) {
    // Size is whatever was resolved and stored at checkout time, not a
    // fixed constant — see the comment on grantStorageAddon.
    const bytes = Number(params.raw.amountUnits || 0)
    if (bytes > 0) {
      await grantStorageAddon(params.tenantId, params.orderId, bytes, { renewsAddonId: params.raw.renewsAddonId })
      return true
    }
  }
  return false
}
