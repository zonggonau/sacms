import { beforeEach, describe, expect, it, vi } from "vitest"

const { master, publish, purchase } = vi.hoisted(() => ({
  master: { paymentTransaction: { findUnique: vi.fn(), updateMany: vi.fn() }, $transaction: vi.fn() },
  publish: vi.fn(async () => undefined),
  purchase: vi.fn(),
}))

vi.mock("@/lib/database", () => ({ db: master }))
vi.mock("@/lib/webhooks", () => ({ triggerWebhooks: publish }))
vi.mock("@/lib/audit-log", () => ({ AuditAction: { SETTINGS_UPDATED: "settings_updated" }, logAudit: vi.fn() }))
vi.mock("@/lib/midtrans", () => ({ calculatePeriodEndDate: vi.fn(() => new Date("2027-01-01T00:00:00Z")) }))
vi.mock("@/lib/vercel-registrar", () => ({ purchaseDomain: purchase }))

import { applyPaymentOutcome, paymentStatusForCheckout } from "@/lib/billing/payment-success"

const order = () => ({
  id: "payment-1",
  orderId: "ADD-123",
  status: "pending",
  fulfillmentStatus: null as string | null,
  subscriptionId: "sub-1",
  invoiceId: null as string | null,
  amount: 10_000,
  rawResponse: { addonId: "topup_api_500k" } as Record<string, unknown>,
  subscription: { id: "sub-1", tenantId: "tenant-1", plan: "pro", userId: "owner" },
})

let payment: ReturnType<typeof order>
let creditBalance: number
const invoice = vi.fn(async () => ({ id: "invoice-1" }))
const updateSubscription = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  payment = order()
  creditBalance = 0
  master.paymentTransaction.findUnique.mockImplementation(async () => structuredClone(payment))
  master.paymentTransaction.updateMany.mockImplementation(async ({ where, data }) => {
    if (where.status?.notIn?.includes(payment.status)) return { count: 0 }
    Object.assign(payment, Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)))
    return { count: 1 }
  })
  master.$transaction.mockImplementation(async (callback) => {
    const draft = structuredClone(payment)
    let balance = creditBalance
    const result = await callback({
      paymentTransaction: {
        updateMany: async ({ where, data }: any) => {
          if (typeof where.status === "string" && where.status !== draft.status) return { count: 0 }
          if (where.status?.notIn?.includes(draft.status)) return { count: 0 }
          if (where.fulfillmentStatus && where.fulfillmentStatus !== draft.fulfillmentStatus) return { count: 0 }
          Object.assign(draft, data)
          return { count: 1 }
        },
        update: async ({ data }: any) => Object.assign(draft, data),
      },
      tenant: { update: async () => { balance += 500_000 } },
      subscription: { update: updateSubscription },
      invoice: { create: invoice },
    })
    payment = draft
    creditBalance = balance
    return result
  })
})

describe("payment fulfillment", () => {
  it("retries a confirmed payment when writing its invoice failed, then avoids duplicate credit or notification", async () => {
    invoice.mockRejectedValueOnce(new Error("invoice write failed"))
    await expect(applyPaymentOutcome(payment.orderId, "success")).rejects.toThrow("invoice write failed")
    expect(payment).toMatchObject({ status: "success", fulfillmentStatus: "pending" })
    expect(paymentStatusForCheckout(payment)).toBe("pending")
    expect(creditBalance).toBe(0)
    expect(publish).not.toHaveBeenCalled()

    await expect(applyPaymentOutcome(payment.orderId, "success")).resolves.toMatchObject({ applied: true })
    await expect(applyPaymentOutcome(payment.orderId, "success")).resolves.toMatchObject({ alreadyProcessed: true })
    expect(payment).toMatchObject({ status: "success", fulfillmentStatus: "completed", invoiceId: "invoice-1" })
    expect(creditBalance).toBe(500_000)
    expect(publish).toHaveBeenCalledTimes(1)
  })

  it("preserves an existing subscription when an add-on payment fails", async () => {
    await expect(applyPaymentOutcome(payment.orderId, "failed")).resolves.toMatchObject({ applied: true, status: "failed" })
    expect(updateSubscription).not.toHaveBeenCalled()
    expect(invoice).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }))
  })

  it("holds an ambiguous domain purchase for review and never submits it again on retry", async () => {
    payment.orderId = "DOM-123"
    payment.rawResponse = { tenantId: "tenant-1", domainName: "example.test" }
    purchase.mockRejectedValueOnce(new Error("Registrar response was lost"))

    await applyPaymentOutcome(payment.orderId, "success")
    await applyPaymentOutcome(payment.orderId, "success")

    expect(payment).toMatchObject({ status: "success", fulfillmentStatus: "needs_review" })
    expect(paymentStatusForCheckout(payment)).toBe("needs_review")
    expect(purchase).toHaveBeenCalledTimes(1)
    expect(invoice).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })
})
