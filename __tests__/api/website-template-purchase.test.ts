import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))
vi.mock("@/lib/midtrans", () => ({ createSnapPayment: vi.fn(async () => ({ token: "snap-token", redirect_url: "https://pay.example/redirect" })) }))

const { db } = vi.hoisted(() => ({
  db: {
    websiteTemplate: { findFirst: vi.fn() },
    websiteTemplatePurchase: { findUnique: vi.fn() },
    subscription: { findFirst: vi.fn() },
    paymentTransaction: { create: vi.fn() },
  },
}))
vi.mock("@/lib/database", () => ({ db }))

import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { createSnapPayment } from "@/lib/midtrans"
import { POST } from "@/app/api/tenant/[tenant]/website-templates/[id]/purchase/route"

const longName = "Ruang Bingkai — Studio Fotografi Profesional Nabire Papua Tengah"
const buy = () => POST(new Request("https://app.test/x", { method: "POST" }) as never, { params: Promise.resolve({ tenant: "acme", id: "wt-1" }) } as never)
const asPlan = (plan: string) =>
  vi.mocked(getTenantAccess).mockResolvedValue({ role: "owner", tenantId: "tenant-1", userId: "user-1", tenant: { id: "tenant-1", slug: "acme", name: "Acme", plan } } as never)

describe("POST /api/tenant/[tenant]/website-templates/[id]/purchase", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-1", role: "user", name: "Budi", email: "budi@example.test" } } as never)
    db.websiteTemplate.findFirst.mockResolvedValue({ id: "wt-1", name: longName, price: 150_000 })
    db.websiteTemplatePurchase.findUnique.mockResolvedValue(null)
    db.subscription.findFirst.mockResolvedValue({ id: "sub-1" })
    db.paymentTransaction.create.mockResolvedValue({})
  })

  it("starts a TPL- checkout for a Pro workspace and records the order as pending", async () => {
    asPlan("pro")
    const res = await buy()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ amount: 150_000, redirectUrl: "https://pay.example/redirect" })
    expect(body.orderId).toMatch(/^TPL-/)
    expect(db.paymentTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: body.orderId, amount: 150_000, status: "pending", subscriptionId: "sub-1",
        rawResponse: expect.objectContaining({ type: "WEBSITE_TEMPLATE_PURCHASE", tenantId: "tenant-1", websiteTemplateId: "wt-1" }),
      }),
    })
    const [{ items }] = vi.mocked(createSnapPayment).mock.calls[0] as any
    expect(items[0].name.length).toBeLessThanOrEqual(50)
    expect(items[0].price).toBe(150_000)
  })

  it("starts a checkout for a Business workspace too, since every plan buys templates", async () => {
    asPlan("business")
    expect((await buy()).status).toBe(200)
    expect(db.paymentTransaction.create).toHaveBeenCalled()
  })

  it("refuses a template the workspace already owns", async () => {
    asPlan("starter")
    db.websiteTemplatePurchase.findUnique.mockResolvedValue({ id: "purchase-1" })
    expect((await buy()).status).toBe(409)
    expect(createSnapPayment).not.toHaveBeenCalled()
  })

  it("refuses a template that is not for sale", async () => {
    asPlan("pro")
    db.websiteTemplate.findFirst.mockResolvedValue({ id: "wt-1", name: "Gratis", price: null })
    expect((await buy()).status).toBe(403)
    expect(db.paymentTransaction.create).not.toHaveBeenCalled()
  })

  it.each(["free", "enterprise", "custom"])("starts a checkout for a %s workspace", async (plan) => {
    asPlan(plan)
    expect((await buy()).status).toBe(200)
    expect(createSnapPayment).toHaveBeenCalled()
  })

  it("404s for a template that is not published", async () => {
    asPlan("pro")
    db.websiteTemplate.findFirst.mockResolvedValue(null)
    expect((await buy()).status).toBe(404)
  })
})
