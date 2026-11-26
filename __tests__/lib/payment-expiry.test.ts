import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({
  db: { paymentTransaction: { updateMany: vi.fn() } },
}))
vi.mock("@/lib/database", () => ({ db }))

import { expireStalePendingPayments } from "@/lib/billing/payment-expiry"
import { PAYMENT_WINDOW_HOURS, PAYMENT_WINDOW_MS, paymentDeadline, SNAP_EXPIRY } from "@/lib/billing/payment-window"

describe("payment window", () => {
  it("is 1 hour, and Snap gets the same expiry", () => {
    expect(PAYMENT_WINDOW_HOURS).toBe(1)
    expect(PAYMENT_WINDOW_MS).toBe(60 * 60 * 1000)
    expect(SNAP_EXPIRY).toEqual({ unit: "hours", duration: 1 })
  })

  it("deadline is 1 hour after the order was created", () => {
    const created = new Date("2026-11-26T02:00:00.000Z")
    expect(paymentDeadline(created).toISOString()).toBe("2026-11-26T03:00:00.000Z")
    expect(paymentDeadline(created.toISOString()).toISOString()).toBe("2026-11-26T03:00:00.000Z")
  })
})

describe("expireStalePendingPayments", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-26T10:00:00.000Z"))
    db.paymentTransaction.updateMany.mockResolvedValue({ count: 2 })
  })

  it("expires only pending orders older than the window, inside the caller's scope", async () => {
    const scope = { OR: [{ subscriptionId: { in: ["sub-1"] } }] }
    const count = await expireStalePendingPayments(scope)
    expect(count).toBe(2)

    const call = db.paymentTransaction.updateMany.mock.calls[0][0]
    expect(call.data).toEqual({ status: "expired" })
    expect(call.where.AND[0]).toBe(scope)
    expect(call.where.AND[1].status).toBe("pending")
    expect(call.where.AND[1].createdAt.lt.toISOString()).toBe("2026-11-26T09:00:00.000Z")
  })

  it("never touches paid, cancelled, or failed orders", async () => {
    await expireStalePendingPayments({})
    const call = db.paymentTransaction.updateMany.mock.calls[0][0]
    expect(call.where.AND[1]).toEqual({ status: "pending", createdAt: { lt: expect.any(Date) } })
  })
})
