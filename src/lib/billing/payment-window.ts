// How long a checkout stays payable. Unpaid orders expire after this many hours.
// 1 hour, as chosen by the platform owner. The Midtrans default of 24 hours leaves
// too many orders waiting. Midtrans enforces the same
// window on its payment page (see the `expiry` field on Snap transactions).
export const PAYMENT_WINDOW_HOURS = 1
export const PAYMENT_WINDOW_MS = PAYMENT_WINDOW_HOURS * 60 * 60 * 1000

/** The moment an order created at `createdAt` stops being payable. */
export function paymentDeadline(createdAt: Date | string): Date {
  return new Date(new Date(createdAt).getTime() + PAYMENT_WINDOW_MS)
}

/** Snap `expiry` block, in the shape Midtrans expects. */
export const SNAP_EXPIRY = { unit: "hours" as const, duration: PAYMENT_WINDOW_HOURS }
