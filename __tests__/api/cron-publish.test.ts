import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { db } from "@/lib/database"
import { triggerWebhooks } from "@/lib/webhooks"
import { GET } from "../../src/app/api/cron/publish/route"



// Mock webhooks
vi.mock("@/lib/webhooks", () => ({
  triggerWebhooks: vi.fn(),
  WebhookEvents: {
    CONTENT_PUBLISHED: "content.published",
  },
}))

describe("Scheduled Publishing Cron API", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv, CRON_SECRET: "my_cron_secret" }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("should return 401 if cron secret in authorization header is wrong", async () => {
    const request = new Request("http://localhost:3000/api/cron/publish", {
      headers: {
        authorization: "Bearer wrong_secret",
      },
    })

    const response = await GET(request)
    expect(response.status).toBe(401)
    
    const body = await response.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("should return 401 if authorization header is missing when CRON_SECRET is set", async () => {
    const request = new Request("http://localhost:3000/api/cron/publish")

    const response = await GET(request)
    expect(response.status).toBe(401)
  })

  it("should return published: 0 if no scheduled entries exist", async () => {
    const request = new Request("http://localhost:3000/api/cron/publish", {
      headers: {
        authorization: "Bearer my_cron_secret",
      },
    })

    // Mock db.tenant.findMany to return a mock tenant
    ;(db.tenant.findMany as any).mockResolvedValue([{ id: "tenant-1", slug: "tenant-1", databaseUrl: "" }])

    // Mock db.contentEntry.findMany to return empty array
    ;(db.contentEntry.findMany as any).mockResolvedValue([])

    const response = await GET(request)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.published).toBe(0)
  })

  it("should publish scheduled entries, create version records, and trigger webhooks", async () => {
    const request = new Request("http://localhost:3000/api/cron/publish", {
      headers: {
        authorization: "Bearer my_cron_secret",
      },
    })

    const mockScheduledEntries = [
      {
        id: "entry-scheduled-1",
        tenantId: "tenant-1",
        data: { title: "Scheduled Post" },
        status: "SCHEDULED",
        scheduledAt: new Date(Date.now() - 60000), // Scheduled in the past
        contentType: { slug: "articles" },
      },
    ]

    // Mock finding scheduled entries
    ;(db.contentEntry.findMany as any).mockResolvedValue(mockScheduledEntries)

    // Mock finding tenants
    ;(db.tenant.findMany as any).mockResolvedValue([{ id: "tenant-1", slug: "tenant-1", databaseUrl: "" }])
    
    // Mock contentType
    ;(db.contentType.findUnique as any).mockResolvedValue({ slug: "articles" })

    // Mock updating entries
    ;(db.contentEntry.update as any).mockResolvedValue({})

    // Mock contentVersion query and creation
    const mockVersion = { version: 2 }
    // Since contentVersion is not in the db mock in setup.ts, we mock db.$transaction or let's check if setup.ts has contentVersion mock
    // Wait, let's look at setup.ts db mock:
    // It mocks db.contentEntry, db.tenant, db.user, db.webhookLog etc.
    // Let's check if contentVersion is in the db mock in setup.ts!
    // Ah, it is NOT in setup.ts! But let's check what contentVersion methods are called in route.ts:
    // db.contentVersion.findFirst and db.contentVersion.create.
    // If they are not in setup.ts db mock, calling them will throw a TypeError!
    // So we must mock db.contentVersion inside our test file, or add it to setup.ts!
    // Adding contentVersion to the setup.ts mock globally is safer and cleaner.
    // But since db is a mocked object, we can also mock it inside our test!
    // Let's add contentVersion mock to setup.ts or to db in this test.
    // In this test we can do: db.contentVersion = { findFirst: vi.fn(), create: vi.fn() } as any;
    // That's extremely easy and local!
    db.contentVersion = {
      findFirst: vi.fn().mockResolvedValue(mockVersion),
      create: vi.fn().mockResolvedValue({}),
    } as any

    const response = await GET(request)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.published).toBe(1)

    // Verify db updates were called correctly
    expect(db.contentEntry.update).toHaveBeenCalledWith({
      where: { id: "entry-scheduled-1" },
      data: expect.objectContaining({
        status: "PUBLISHED",
        scheduledAt: null,
      }),
    })

    // Verify version creation
    expect(db.contentVersion.findFirst).toHaveBeenCalledWith({
      where: { contentEntryId: "entry-scheduled-1" },
      orderBy: { version: "desc" },
    })

    expect(db.contentVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contentEntryId: "entry-scheduled-1",
        version: 3,
        changeType: "published",
        changedBy: "system",
      }),
    })

    // Verify webhook triggering
    expect(triggerWebhooks).toHaveBeenCalledWith(
      "tenant-1",
      "content.published",
      expect.objectContaining({
        entry: expect.objectContaining({
          id: "entry-scheduled-1",
          contentType: "articles",
          status: "PUBLISHED",
          scheduledPublish: true,
        }),
      })
    )
  })
})
