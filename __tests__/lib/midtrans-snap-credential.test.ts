import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { createTransaction, resolved } = vi.hoisted(() => ({
  createTransaction: vi.fn(async () => ({ token: "snap-token", redirect_url: "https://pay.example/redirect" })),
  resolved: { current: { isProduction: true, serverKey: "", clientKey: "" } },
}))
vi.mock("midtrans-client", () => ({
  default: { Snap: class { createTransaction = createTransaction } },
}))
vi.mock("@/lib/settings", () => ({ getResolvedMidtransConfig: async () => resolved.current }))

import { createSnapPayment } from "@/lib/midtrans"

const params = {
  orderId: "TPL-1",
  amount: 150_000,
  customerDetails: { email: "a@example.test", firstName: "Budi" },
  items: [{ id: "t1", name: "Website Template X", price: 150_000, quantity: 1 }],
}

describe("createSnapPayment credential check", () => {
  const original = process.env.MIDTRANS_SERVER_KEY
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.MIDTRANS_SERVER_KEY
  })
  afterEach(() => {
    if (original === undefined) delete process.env.MIDTRANS_SERVER_KEY
    else process.env.MIDTRANS_SERVER_KEY = original
  })

  it("uses a server key stored in Platform Settings even when the env var is unset", async () => {
    resolved.current = { isProduction: true, serverKey: "Mid-server-from-settings", clientKey: "" }
    const res = await createSnapPayment(params)
    expect(res).toEqual({ token: "snap-token", redirect_url: "https://pay.example/redirect" })
    expect(createTransaction).toHaveBeenCalled()
  })

  it("throws in production when no key exists anywhere", async () => {
    vi.stubEnv("NODE_ENV", "production")
    try {
      resolved.current = { isProduction: true, serverKey: "", clientKey: "" }
      await expect(createSnapPayment(params)).rejects.toThrow(/No credential configured/)
      expect(createTransaction).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
