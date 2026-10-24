import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@/lib/mail", () => ({
  getBaseUrl: vi.fn().mockResolvedValue("https://developer.sacms.cloud"),
  sendBillingNoticeEmail: vi.fn().mockResolvedValue(undefined),
}))

import { db } from "@/lib/database"
import { sendBillingNoticeEmail } from "@/lib/mail"
import { grantStorageAddon, storageAddonRenewalRefusal } from "@/lib/billing/storage-addon"
import { fulfillAddonOrder, mergeProviderResponse } from "@/lib/billing/addon-fulfillment"
import { runBillingReminders } from "@/lib/billing/reminders"

const mockDb = db as any
const now = new Date("2026-09-17T10:00:00Z")
const FIVE_GB = 5 * 1024 ** 3

describe("storage add-on renewal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("starts the renewal when the renewed add-on expires", async () => {
    const expiresAt = new Date("2026-09-30T00:00:00Z")
    mockDb.storageAddon = {
      findFirst: vi.fn().mockResolvedValue({ id: "a1", tenantId: "t1", expiresAt }),
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(async ({ create }: any) => create),
    }

    const created = await grantStorageAddon("t1", "ADD-2", FIVE_GB, { renewsAddonId: "a1", now })

    expect(created.startsAt).toEqual(expiresAt)
    expect(created.expiresAt.toISOString()).toBe("2027-09-30T00:00:00.000Z")
    expect(created.renewsAddonId).toBe("a1")
  })

  it("starts now when renewing an add-on that already expired", async () => {
    mockDb.storageAddon = {
      findFirst: vi.fn().mockResolvedValue({ id: "a1", tenantId: "t1", expiresAt: new Date("2026-09-01T00:00:00Z") }),
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(async ({ create }: any) => create),
    }

    const created = await grantStorageAddon("t1", "ADD-2", FIVE_GB, { renewsAddonId: "a1", now })

    expect(created.startsAt).toEqual(now)
  })

  it("grants a plain add-on when the renewal target was already renewed", async () => {
    mockDb.storageAddon = {
      findFirst: vi.fn().mockResolvedValue({ id: "a1", tenantId: "t1", expiresAt: new Date("2026-09-30T00:00:00Z") }),
      findUnique: vi.fn().mockResolvedValue({ id: "a2" }),
      upsert: vi.fn(async ({ create }: any) => create),
    }

    const created = await grantStorageAddon("t1", "ADD-3", FIVE_GB, { renewsAddonId: "a1", now })

    expect(created.startsAt).toEqual(now)
    expect(created.renewsAddonId).toBeUndefined()
  })

  it("refuses to renew another workspace's add-on", async () => {
    mockDb.storageAddon = { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn() }
    expect(await storageAddonRenewalRefusal("t1", "other")).toMatch(/tidak ditemukan/)
  })
})

describe("payment fulfillment", () => {
  it("keeps checkout fields when the provider reports back", () => {
    const merged = mergeProviderResponse({ isAddon: true, addonId: "topup_storage_10gb" }, { transaction_status: "pending" })
    expect(merged).toEqual({ isAddon: true, addonId: "topup_storage_10gb", provider: { transaction_status: "pending" } })
    expect(mergeProviderResponse(null, { a: 1 })).toEqual({ provider: { a: 1 } })
  })

  it("ignores add-ons it does not handle", async () => {
    expect(await fulfillAddonOrder({ tenantId: "t1", orderId: "ADD-1", raw: { addonId: "topup_ai_500k" } })).toBe(false)
  })
})

describe("billing reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.tenant.findMany = vi.fn().mockResolvedValue([{ id: "t1", slug: "acme", name: "Acme" }])
    mockDb.tenantMember = { findMany: vi.fn().mockResolvedValue([{ user: { email: "owner@example.com" } }]) }
  })

  it("reminds once before a storage add-on ends", async () => {
    const addon = { id: "a1", tenantId: "t1", expiresAt: new Date("2026-09-18T00:00:00Z"), reminder7dSentAt: null }
    mockDb.storageAddon = {
      findMany: vi.fn()
        .mockResolvedValueOnce([addon]) // 1-day window
        .mockResolvedValueOnce([]) // renewals of those
        .mockResolvedValueOnce([]) // 7-day window
        .mockResolvedValueOnce([]),
      update: vi.fn(),
    }

    const result = await runBillingReminders(now)

    expect(result).toEqual({ storageReminders: 1 })
    expect(mockDb.storageAddon.update.mock.calls[0][0].data).toMatchObject({ reminder1dSentAt: now, reminder7dSentAt: now })
    expect(sendBillingNoticeEmail).toHaveBeenCalledTimes(1)
  })
})
