import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { executeSyncHooks, WebhookEvents } from "../../src/lib/webhooks"
import { db } from "../../src/lib/database"

vi.mock("../../src/lib/database", () => ({
  db: {
    webhook: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    tenant: {
      findUnique: vi.fn().mockResolvedValue({}),
    },
    webhookLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

// Mock fetch globally
const originalFetch = global.fetch
const mockFetch = vi.fn()

describe("Webhooks - executeSyncHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch
    
    vi.mocked(db.tenant.findUnique).mockResolvedValue({
      id: "tenant-1",
      slug: "tenant-1",
      name: "Tenant 1",
      createdAt: new Date(),
      updatedAt: new Date(),
      ownerId: "user-1",
      planId: "free",
      isActive: true,
      customDomain: null
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it("returns allowed immediately if no matching webhooks", async () => {
    vi.mocked(db.webhook.findMany).mockResolvedValue([])

    const result = await executeSyncHooks("tenant-1", WebhookEvents.BEFORE_CREATE, { title: "Test" })
    
    expect(result).toEqual({ allowed: true })
    expect(db.webhook.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        enabled: true,
        hookType: "sync",
        failureCount: { lt: 3 },
      },
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("executes webhook and returns modified data on success", async () => {
    const webhook = {
      id: "hook-1",
      tenantId: "tenant-1",
      name: "Test Hook",
      url: "https://example.com/hook",
      events: ["content.beforeCreate"],
      enabled: true,
      hookType: "sync",
      secret: null,
      headers: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTriggeredAt: null,
      failureCount: 0
    }
    
    // @ts-ignore - Prisma type mock
    vi.mocked(db.webhook.findMany).mockResolvedValue([webhook])
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({
        data: { title: "Modified Title", price: 100 }
      }))
    })

    const initialData = { title: "Test", price: 50 }
    const result = await executeSyncHooks("tenant-1", WebhookEvents.BEFORE_CREATE, initialData)
    
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith("https://example.com/hook", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "Content-Type": "application/json",
        "X-Webhook-Event": WebhookEvents.BEFORE_CREATE,
      })
    }))
    
    expect(result).toEqual({
      allowed: true,
      modifiedData: { title: "Modified Title", price: 100 }
    })
    
    // Check webhook logs
    expect(db.webhookLog.create).toHaveBeenCalled()
    expect(db.webhook.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "hook-1" },
        data: expect.objectContaining({ failureCount: 0 })
      })
    )
  })

  it("handles rejection from webhook", async () => {
    const webhook = {
      id: "hook-2",
      tenantId: "tenant-1",
      name: "Test Hook",
      url: "https://example.com/hook",
      events: ["*"],
      enabled: true,
      hookType: "sync",
      secret: "secret-key",
      headers: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTriggeredAt: null,
      failureCount: 0
    }
    
    // @ts-ignore - Prisma type mock
    vi.mocked(db.webhook.findMany).mockResolvedValue([webhook])
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({
        reject: true,
        message: "Title contains profanity"
      }))
    })

    const result = await executeSyncHooks("tenant-1", WebhookEvents.BEFORE_UPDATE, { title: "Bad Word" })
    
    expect(result).toEqual({
      allowed: false,
      rejectMessage: "Title contains profanity"
    })
    
    // Check signature header exists
    expect(mockFetch).toHaveBeenCalledWith("https://example.com/hook", expect.objectContaining({
      headers: expect.objectContaining({
        "X-Webhook-Signature": expect.stringMatching(/^sha256=[a-f0-9]{64}$/)
      })
    }))
  })

  it("handles network errors by ignoring and returning allowed", async () => {
    const webhook = {
      id: "hook-3",
      tenantId: "tenant-1",
      name: "Test Hook",
      url: "https://example.com/hook",
      events: ["*"],
      enabled: true,
      hookType: "sync",
      secret: null,
      headers: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastTriggeredAt: null,
      failureCount: 0
    }
    
    // @ts-ignore
    vi.mocked(db.webhook.findMany).mockResolvedValue([webhook])
    
    // Simulate network error
    mockFetch.mockRejectedValueOnce(new Error("Network Error"))

    const result = await executeSyncHooks("tenant-1", WebhookEvents.BEFORE_UPDATE, { title: "Test" })
    
    expect(result).toEqual({
      allowed: true,
      modifiedData: { title: "Test" }
    })
    
    // Check failure count increment
    expect(db.webhook.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "hook-3" },
        data: expect.objectContaining({ failureCount: { increment: 1 } })
      })
    )
  })
})
