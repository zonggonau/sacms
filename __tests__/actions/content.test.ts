import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/database"
import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { enforcePlanLimit } from "@/lib/plan-enforcement"
import { validateDynamicContent } from "@/lib/validations/dynamic-validator"
import { getEntriesAction, createEntryAction } from "@/actions/content"
import { checkPermission } from "@/lib/rbac"

// Mock RBAC
vi.mock("@/lib/rbac", () => ({
  checkPermission: vi.fn(),
  PERMISSIONS: {
    CONTENT_READ: "content.read",
    CONTENT_CREATE: "content.create"
  }
}))

// Mock Next Cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

// Mock Tenant Access
vi.mock("@/lib/tenant-access", () => ({
  getTenantAccess: vi.fn(),
}))

// Mock Plan Enforcement
vi.mock("@/lib/plan-enforcement", () => ({
  enforcePlanLimit: vi.fn(),
}))

// Mock Dynamic Validator
vi.mock("@/lib/validations/dynamic-validator", () => ({
  validateDynamicContent: vi.fn(),
}))

describe("Tenant Content Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkPermission).mockResolvedValue({ allowed: true } as any)
  })

  describe("getEntriesAction", () => {
    it("should return error if user is not authenticated", async () => {
      vi.mocked(getServerSession).mockResolvedValue(null)

      const response = await getEntriesAction("tenant-1", "articles", {})
      expect(response.error).toBe("Unauthorized")
    })

    it("should return error if user has no access to the tenant", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "user-1", role: "user" },
      } as any)
      vi.mocked(getTenantAccess).mockResolvedValue(null)

      const response = await getEntriesAction("tenant-1", "articles", {})
      expect(response.error).toBe("Forbidden")
    })

    it("should return error if content type is not found", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "user-1", role: "user" },
      } as any)
      vi.mocked(getTenantAccess).mockResolvedValue({
        tenantId: "tenant-1",
        userId: "user-1",
        role: "admin",
        tenant: { id: "tenant-1", name: "Tenant 1", slug: "tenant-1", plan: "free" },
      })

      vi.mocked(db.contentType.findFirst).mockResolvedValue(null)

      const response = await getEntriesAction("tenant-1", "articles", {})
      expect(response.error).toBe("Content type not found")
    })

    it("should return list of entries for a valid content type", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "user-1", role: "user" },
      } as any)
      vi.mocked(getTenantAccess).mockResolvedValue({
        tenantId: "tenant-1",
        userId: "user-1",
        role: "admin",
        tenant: { id: "tenant-1", name: "Tenant 1", slug: "tenant-1", plan: "free" },
      })


      // Content Type mock (assigned to this tenant)
      vi.mocked(db.contentType.findFirst).mockResolvedValue({
        id: "type-articles",
        slug: "articles",
        tenantId: "tenant-1",
        schemaFields: [],
        tenants: [{ tenantId: "tenant-1", enabled: true }],
      } as any)

      // Content Entries mock
      const mockEntries = [
        { id: "entry-1", data: { title: "Entry 1" }, status: "DRAFT" },
      ]
      vi.mocked(db.contentEntry.findMany).mockResolvedValue(mockEntries as any)
      vi.mocked(db.contentEntry.count).mockResolvedValue(1)

      const response = await getEntriesAction("tenant-1", "articles", {})
      expect(response.entries).toHaveLength(1)
      expect(response.entries?.[0].id).toBe("entry-1")
    })
  })

  describe("createEntryAction", () => {
    it("should return error if plan limit is reached", async () => {
      vi.mocked(checkPermission).mockResolvedValue({ allowed: true } as any)
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "user-1", role: "user" },
      } as any)
      vi.mocked(getTenantAccess).mockResolvedValue({
        tenantId: "tenant-1",
        userId: "user-1",
        role: "admin",
        tenant: { id: "tenant-1", name: "Tenant 1", slug: "tenant-1", plan: "free" },
      })

      vi.mocked(db.contentType.findFirst).mockResolvedValue({
        id: "type-articles",
        slug: "articles",
        tenantId: "tenant-1",
        schemaFields: [],
        tenants: [{ tenantId: "tenant-1", enabled: true }],
      } as any)

      // Mock plan limit enforcement: Denied!
      vi.mocked(enforcePlanLimit).mockResolvedValue({
        allowed: false,
        current: 10,
        max: 10,
        planSlug: "free",
        message: "Plan limit reached.",
      })

      const response = await createEntryAction("tenant-1", "articles", {
        data: { title: "New Entry" },
        status: "DRAFT",
        locale: "en",
      })
      
      expect(response.error).toBe("Plan limit reached.")
    })

    it("should return validation error if dynamic content validation fails", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "user-1", role: "user" },
      } as any)
      vi.mocked(getTenantAccess).mockResolvedValue({
        tenantId: "tenant-1",
        userId: "user-1",
        role: "admin",
        tenant: { id: "tenant-1", name: "Tenant 1", slug: "tenant-1", plan: "free" },
      })

      vi.mocked(db.contentType.findFirst).mockResolvedValue({
        id: "type-articles",
        slug: "articles",
        tenantId: "tenant-1",
        schemaFields: [],
        tenants: [{ tenantId: "tenant-1", enabled: true }],
      } as any)

      vi.mocked(enforcePlanLimit).mockResolvedValue({
        allowed: true,
        current: 5,
        max: 10,
        planSlug: "free",
        message: "OK",
      })

      // Mock dynamic validation: Failed!
      vi.mocked(validateDynamicContent).mockResolvedValue({
        success: false,
        errors: { title: "Title is required" },
      })

      const response = await createEntryAction("tenant-1", "articles", {
        data: {},
        status: "DRAFT",
        locale: "en",
      })
      
      expect(response.error).toBe("Validation failed")
      expect(response.details?.title).toBe("Title is required")
    })

    it("should create content entry successfully", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "user-1", role: "user" },
      } as any)
      vi.mocked(getTenantAccess).mockResolvedValue({
        tenantId: "tenant-1",
        userId: "user-1",
        role: "admin",
        tenant: { id: "tenant-1", name: "Tenant 1", slug: "tenant-1", plan: "free" },
      })

      vi.mocked(db.contentType.findFirst).mockResolvedValue({
        id: "type-articles",
        slug: "articles",
        tenantId: "tenant-1",
        schemaFields: [{ id: "f1", name: "Title", slug: "title", type: "text", validations: { required: true } }],
        tenants: [{ tenantId: "tenant-1", enabled: true }],
      } as any)

      vi.mocked(enforcePlanLimit).mockResolvedValue({
        allowed: true,
        current: 5,
        max: 10,
        planSlug: "free",
        message: "OK",
      })

      vi.mocked(validateDynamicContent).mockResolvedValue({
        success: true,
        errors: {},
      })
      
      vi.mocked(db.webhook.findMany).mockResolvedValue([])

      // Mock transaction writes
      const mockCreatedEntry = { id: "new-entry-1", data: { title: "My Entry" } }
      vi.mocked(db.$transaction).mockImplementation(async (txCallback: any) => {
        const mockTx = {
          contentEntry: {
            create: vi.fn().mockResolvedValue({ id: "new-entry-1", contentTypeId: "type-articles", tenantId: "tenant-1", data: { title: "My Entry" } }),
            update: vi.fn().mockResolvedValue(mockCreatedEntry),
          },
          contentVersion: {
            create: vi.fn().mockResolvedValue({}),
          },
        }
        return txCallback(mockTx)
      })

      const response = await createEntryAction("tenant-1", "articles", {
        data: { title: "My Entry" },
        status: "DRAFT",
        locale: "en",
      })
      
      expect(response.entry?.id).toBe("new-entry-1")
    })
  })
})
