import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))
vi.mock("@/lib/midtrans", () => ({
  getTransactionStatus: vi.fn(),
  cancelTransaction: vi.fn(),
}))

const { db } = vi.hoisted(() => ({
  db: {
    paymentTransaction: { findUnique: vi.fn(), updateMany: vi.fn() },
    subscription: { findMany: vi.fn() },
  },
}))
vi.mock("@/lib/database", () => ({ db }))

import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { cancelTransaction, getTransactionStatus } from "@/lib/midtrans"
import { POST } from "@/app/api/tenant/[tenant]/transactions/[orderId]/cancel/route"

const call = (orderId = "TPL-1") =>
  POST(new Request("https://app.test/x", { method: "POST" }) as never, { params: Promise.resolve({ tenant: "acme", orderId }) } as never)

const asAdmin = () =>
  vi.mocked(getTenantAccess).mockResolvedValue({ role: "admin", tenantId: "tenant-1", userId: "user-1", tenant: { id: "tenant-1", slug: "acme", name: "Acme", plan: "pro" } } as never)

const pendingTemplateOrder = (over: Record<string, unknown> = {}) => ({
  id: "tx-1", status: "pending", subscriptionId: null,
  rawResponse: { type: "WEBSITE_TEMPLATE_PURCHASE", tenantId: "tenant-1" }, ...over,
})

describe("POST /api/tenant/[tenant]/transactions/[orderId]/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-1", role: "user" } } as never)
    asAdmin()
    db.subscription.findMany.mockResolvedValue([])
    db.paymentTransaction.findUnique.mockResolvedValue(pendingTemplateOrder())
    db.paymentTransaction.updateMany.mockResolvedValue({ count: 1 })
    vi.mocked(getTransactionStatus).mockResolvedValue({ transaction_status: "pending" } as never)
    vi.mocked(cancelTransaction).mockResolvedValue(undefined as never)
  })

  it("cancels a pending order that belongs to the workspace", async () => {
    const res = await call()
    expect(res.status).toBe(200)
    expect(cancelTransaction).toHaveBeenCalledWith("TPL-1")
    expect(db.paymentTransaction.updateMany).toHaveBeenCalledWith({ where: { id: "tx-1", status: "pending" }, data: { status: "cancelled" } })
  })

  it("refuses when Midtrans already reports the payment as settled", async () => {
    vi.mocked(getTransactionStatus).mockResolvedValue({ transaction_status: "settlement" } as never)
    const res = await call()
    expect(res.status).toBe(409)
    expect(cancelTransaction).not.toHaveBeenCalled()
    expect(db.paymentTransaction.updateMany).not.toHaveBeenCalled()
  })

  it("still cancels locally when the Midtrans status lookup fails", async () => {
    vi.mocked(getTransactionStatus).mockRejectedValue(new Error("network"))
    expect((await call()).status).toBe(200)
    expect(db.paymentTransaction.updateMany).toHaveBeenCalled()
  })

  it("still cancels locally when Midtrans refuses the cancel call", async () => {
    vi.mocked(cancelTransaction).mockRejectedValue(new Error("expired at Midtrans"))
    expect((await call()).status).toBe(200)
    expect(db.paymentTransaction.updateMany).toHaveBeenCalled()
  })

  it("refuses an order that is no longer pending", async () => {
    db.paymentTransaction.findUnique.mockResolvedValue(pendingTemplateOrder({ status: "success" }))
    const res = await call()
    expect(res.status).toBe(409)
    expect(db.paymentTransaction.updateMany).not.toHaveBeenCalled()
  })

  it("says an expired order is expired, not paid", async () => {
    db.paymentTransaction.findUnique.mockResolvedValue(pendingTemplateOrder({ status: "expired" }))
    const res = await call()
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/kedaluwarsa/)
  })

  it("404s for an order that belongs to another workspace", async () => {
    db.paymentTransaction.findUnique.mockResolvedValue(pendingTemplateOrder({ rawResponse: { tenantId: "tenant-other" } }))
    expect((await call()).status).toBe(404)
    expect(cancelTransaction).not.toHaveBeenCalled()
    expect(db.paymentTransaction.updateMany).not.toHaveBeenCalled()
  })

  it("accepts a subscription order that belongs to the workspace's own subscription", async () => {
    db.subscription.findMany.mockResolvedValue([{ id: "sub-1" }])
    db.paymentTransaction.findUnique.mockResolvedValue(pendingTemplateOrder({ subscriptionId: "sub-1", rawResponse: null }))
    expect((await call("SUB-9")).status).toBe(200)
  })

  it("404s for an unknown order", async () => {
    db.paymentTransaction.findUnique.mockResolvedValue(null)
    expect((await call("NOPE")).status).toBe(404)
  })
})
