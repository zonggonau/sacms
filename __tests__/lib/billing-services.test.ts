import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@/lib/mail", () => ({
  getBaseUrl: vi.fn().mockResolvedValue("https://developer.sacms.cloud"),
  sendBillingNoticeEmail: vi.fn().mockResolvedValue(undefined),
}))

import { db } from "@/lib/database"
import { sendBillingNoticeEmail } from "@/lib/mail"
import { grantStorageAddon, storageAddonRenewalRefusal } from "@/lib/billing/storage-addon"
import {
  MANAGED_INFRA_MONTHLY_ID,
  MANAGED_INFRA_SETUP_ID,
  activateManagedInfraIfConnected,
  fulfillManagedInfraOrder,
  managedInfraOrderRefusal,
} from "@/lib/billing/managed-infra"
import { fulfillAddonOrder, mergeProviderResponse } from "@/lib/billing/addon-fulfillment"
import { runBillingReminders } from "@/lib/billing/reminders"

const mockDb = db as any
const now = new Date("2026-09-17T10:00:00Z")

function managedDb(existing: any, tenant: any = { databaseUrl: null, storageConfig: null }) {
  const tx = {
    managedInfraService: {
      findUnique: vi.fn().mockResolvedValue(existing),
      upsert: vi.fn(async ({ create }: any) => ({ id: "svc1", ...create })),
      update: vi.fn().mockResolvedValue({}),
    },
    managedInfraPayment: { create: vi.fn().mockResolvedValue({}) },
    tenant: { findUnique: vi.fn().mockResolvedValue(tenant) },
  }
  mockDb.$transaction = vi.fn(async (fn: any) => fn(tx))
  mockDb.managedInfraService = { findUnique: vi.fn().mockResolvedValue(existing), update: vi.fn(), updateMany: vi.fn() }
  mockDb.tenant.findUnique = vi.fn().mockResolvedValue({ name: "Acme", slug: "acme" })
  mockDb.supportTicket = { create: vi.fn().mockResolvedValue({ id: "ticket1" }) }
  return tx
}

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

    const created = await grantStorageAddon("t1", "ADD-2", { renewsAddonId: "a1", now })

    expect(created.startsAt).toEqual(expiresAt)
    expect(created.expiresAt.toISOString()).toBe("2026-10-30T00:00:00.000Z")
    expect(created.renewsAddonId).toBe("a1")
  })

  it("starts now when renewing an add-on that already expired", async () => {
    mockDb.storageAddon = {
      findFirst: vi.fn().mockResolvedValue({ id: "a1", tenantId: "t1", expiresAt: new Date("2026-09-01T00:00:00Z") }),
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(async ({ create }: any) => create),
    }

    const created = await grantStorageAddon("t1", "ADD-2", { renewsAddonId: "a1", now })

    expect(created.startsAt).toEqual(now)
  })

  it("grants a plain add-on when the renewal target was already renewed", async () => {
    mockDb.storageAddon = {
      findFirst: vi.fn().mockResolvedValue({ id: "a1", tenantId: "t1", expiresAt: new Date("2026-09-30T00:00:00Z") }),
      findUnique: vi.fn().mockResolvedValue({ id: "a2" }),
      upsert: vi.fn(async ({ create }: any) => create),
    }

    const created = await grantStorageAddon("t1", "ADD-3", { renewsAddonId: "a1", now })

    expect(created.startsAt).toEqual(now)
    expect(created.renewsAddonId).toBeUndefined()
  })

  it("refuses to renew another workspace's add-on", async () => {
    mockDb.storageAddon = { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn() }
    expect(await storageAddonRenewalRefusal("t1", "other")).toMatch(/tidak ditemukan/)
  })
})

describe("managed database/storage service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("setup payment opens the service for one month and a ticket for IT", async () => {
    const tx = managedDb(null)

    const result = await fulfillManagedInfraOrder({ tenantId: "t1", orderId: "ADD-1", productId: MANAGED_INFRA_SETUP_ID, userId: "u1", now })

    expect(result.applied).toBe(true)
    expect(tx.managedInfraService.upsert.mock.calls[0][0].create).toMatchObject({ tenantId: "t1", status: "awaiting_setup" })
    expect(tx.managedInfraPayment.create.mock.calls[0][0].data).toMatchObject({ orderId: "ADD-1", kind: "setup", amount: 3_500_000 })
    expect(mockDb.supportTicket.create.mock.calls[0][0].data).toMatchObject({ tenantId: "t1", category: "infrastructure", priority: "high" })
    expect(mockDb.managedInfraService.update).toHaveBeenCalledWith({ where: { id: "svc1" }, data: { ticketId: "ticket1" } })
  })

  it("monthly payment extends from the end of the paid period", async () => {
    const tx = managedDb({ id: "svc1", status: "active", paidUntil: new Date("2026-09-20T00:00:00Z") })

    await fulfillManagedInfraOrder({ tenantId: "t1", orderId: "ADD-2", productId: MANAGED_INFRA_MONTHLY_ID, now })

    expect(tx.managedInfraPayment.create.mock.calls[0][0].data).toMatchObject({ kind: "monthly", amount: 1_000_000 })
    expect(tx.managedInfraService.update.mock.calls[0][0].data.paidUntil.toISOString()).toBe("2026-10-20T00:00:00.000Z")
  })

  it("monthly payment after expiry reactivates a still-connected workspace", async () => {
    const tx = managedDb({ id: "svc1", status: "expired", paidUntil: new Date("2026-09-01T00:00:00Z") }, { databaseUrl: "postgres://x", storageConfig: null })

    await fulfillManagedInfraOrder({ tenantId: "t1", orderId: "ADD-3", productId: MANAGED_INFRA_MONTHLY_ID, now })

    const data = tx.managedInfraService.update.mock.calls[0][0].data
    expect(data.status).toBe("active")
    expect(data.paidUntil.toISOString()).toBe("2026-10-17T10:00:00.000Z")
  })

  it("a second delivery of the same order changes nothing", async () => {
    managedDb({ id: "svc1", status: "active", paidUntil: now })
    mockDb.$transaction = vi.fn().mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }))

    const result = await fulfillManagedInfraOrder({ tenantId: "t1", orderId: "ADD-2", productId: MANAGED_INFRA_MONTHLY_ID, now })

    expect(result.applied).toBe(false)
    expect(mockDb.supportTicket.create).not.toHaveBeenCalled()
  })

  it("refuses a second setup and a renewal without a service", async () => {
    managedDb({ id: "svc1", status: "awaiting_setup" })
    expect(await managedInfraOrderRefusal("t1", MANAGED_INFRA_SETUP_ID)).toMatch(/sudah dipesan/)
    managedDb(null)
    expect(await managedInfraOrderRefusal("t1", MANAGED_INFRA_MONTHLY_ID)).toMatch(/terlebih dahulu/)
    expect(await managedInfraOrderRefusal("t1", MANAGED_INFRA_SETUP_ID)).toBeNull()
  })

  it("activates a waiting service when IT saves a connection", async () => {
    managedDb(null)
    await activateManagedInfraIfConnected("t1", false)
    expect(mockDb.managedInfraService.updateMany).not.toHaveBeenCalled()
    await activateManagedInfraIfConnected("t1", true)
    expect(mockDb.managedInfraService.updateMany.mock.calls[0][0].where).toEqual({ tenantId: "t1", status: "awaiting_setup" })
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
    mockDb.supportTicket = { create: vi.fn() }
  })

  it("reminds once before an add-on ends and expires unpaid services", async () => {
    const addon = { id: "a1", tenantId: "t1", expiresAt: new Date("2026-09-18T00:00:00Z"), reminder7dSentAt: null }
    mockDb.storageAddon = {
      findMany: vi.fn()
        .mockResolvedValueOnce([addon]) // 1-day window
        .mockResolvedValueOnce([]) // renewals of those
        .mockResolvedValueOnce([]) // 7-day window
        .mockResolvedValueOnce([]),
      update: vi.fn(),
    }
    const expired = { id: "svc1", tenantId: "t1", status: "active", paidUntil: new Date("2026-09-16T00:00:00Z"), requestedById: "u1" }
    mockDb.managedInfraService = {
      findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([expired]),
      update: vi.fn(),
    }

    const result = await runBillingReminders(now)

    expect(result).toEqual({ storageReminders: 1, managedReminders: 0, managedExpired: 1 })
    expect(mockDb.storageAddon.update.mock.calls[0][0].data).toMatchObject({ reminder1dSentAt: now, reminder7dSentAt: now })
    expect(mockDb.managedInfraService.update).toHaveBeenCalledWith({ where: { id: "svc1" }, data: { status: "expired", expiredAt: now } })
    expect(mockDb.supportTicket.create).toHaveBeenCalledTimes(1)
    expect(sendBillingNoticeEmail).toHaveBeenCalledTimes(2)
  })
})
