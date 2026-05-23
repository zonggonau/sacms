import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/database"
import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { enforcePlanLimit } from "@/lib/plan-enforcement"
import { validateDynamicContent } from "@/lib/validations/dynamic-validator"
import { GET, POST } from "../../src/app/api/tenant/[tenant]/content/[contentSlug]/route"
import { NextRequest } from "next/server"

// Mock Next Auth
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

describe("Tenant Content CRUD API Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("GET /api/tenant/[tenant]/content/[contentSlug]", () => {
    it("should return 401 if user is not authenticated", async () => {
      vi.mocked(getServerSession).mockResolvedValue(null)

      const request = new NextRequest("http://localhost:3000/api/tenant/tenant-1/content/articles")
      const params = Promise.resolve({ tenant: "tenant-1", contentSlug: "articles" })

      const response = await GET(request, { params })
      expect(response.status).toBe(401)
      
      const body = await response.json()
      expect(body.error).toBe("Unauthorized")
    })

    it("should return 403 if user has no access to the tenant", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "user-1", role: "user" },
      } as any)
      vi.mocked(getTenantAccess).mockResolvedValue(null)

      const request = new NextRequest("http://localhost:3000/api/tenant/tenant-1/content/articles")
      const params = Promise.resolve({ tenant: "tenant-1", contentSlug: "articles" })

      const response = await GET(request, { params })
      expect(response.status).toBe(403)
      
      const body = await response.json()
      expect(body.error).toContain("Forbidden or Tenant not found")
    })

    it("should return 404 if content type is not found", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "user-1", role: "user" },
      } as any)
      vi.mocked(getTenantAccess).mockResolvedValue({
        tenantId: "tenant-1",
        role: "owner",
        tenant: { id: "tenant-1", name: "Tenant 1", slug: "tenant-1", plan: "free" },
      })
      vi.mocked(db.contentType.findFirst).mockResolvedValue(null)

      const request = new NextRequest("http://localhost:3000/api/tenant/tenant-1/content/articles")
      const params = Promise.resolve({ tenant: "tenant-1", contentSlug: "articles" })

      const response = await GET(request, { params })
      expect(response.status).toBe(404)
      
      const body = await response.json()
      expect(body.error).toBe("Content type not found")
    })

    it("should return list of entries for a valid content type", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "user-1", role: "user" },
      } as any)
      vi.mocked(getTenantAccess).mockResolvedValue({
        tenantId: "tenant-1",
        role: "owner",
        tenant: { id: "tenant-1", name: "Tenant 1", slug: "tenant-1", plan: "free" },
      })

      // Content Type mock (assigned to this tenant)
      vi.mocked(db.contentType.findFirst).mockResolvedValue({
        id: "type-articles",
        slug: "articles",
        tenantId: "tenant-1",
        tenants: [{ tenantId: "tenant-1", enabled: true }],
      } as any)

      // Content Entries mock
      const mockEntries = [
        { id: "entry-1", data: { title: "Entry 1" }, status: "DRAFT" },
      ]
      vi.mocked(db.contentEntry.findMany).mockResolvedValue(mockEntries as any)

      const request = new NextRequest("http://localhost:3000/api/tenant/tenant-1/content/articles")
      const params = Promise.resolve({ tenant: "tenant-1", contentSlug: "articles" })

      const response = await GET(request, { params })
      expect(response.status).toBe(200)

      const body = await response.json()
      expect(body.entries).toHaveLength(1)
      expect(body.entries[0].id).toBe("entry-1")
      expect(body.contentType.id).toBe("type-articles")
    })
  })

  describe("POST /api/tenant/[tenant]/content/[contentSlug]", () => {
    it("should return 403 if plan limit is reached", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "user-1", role: "user" },
      } as any)
      vi.mocked(getTenantAccess).mockResolvedValue({
        tenantId: "tenant-1",
        role: "owner",
        tenant: { id: "tenant-1", name: "Tenant 1", slug: "tenant-1", plan: "free" },
      })
      vi.mocked(db.contentType.findFirst).mockResolvedValue({
        id: "type-articles",
        slug: "articles",
        tenantId: "tenant-1",
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

      const request = new NextRequest("http://localhost:3000/api/tenant/tenant-1/content/articles", {
        method: "POST",
        body: JSON.stringify({
          data: { title: "New Entry" },
          publish: false,
        }),
      })
      const params = Promise.resolve({ tenant: "tenant-1", contentSlug: "articles" })

      const response = await POST(request, { params })
      expect(response.status).toBe(403)
      
      const body = await response.json()
      expect(body.error).toBe("Plan limit reached.")
    })

    it("should return 400 if dynamic content validation fails", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "user-1", role: "user" },
      } as any)
      vi.mocked(getTenantAccess).mockResolvedValue({
        tenantId: "tenant-1",
        role: "owner",
        tenant: { id: "tenant-1", name: "Tenant 1", slug: "tenant-1", plan: "free" },
      })
      vi.mocked(db.contentType.findFirst).mockResolvedValue({
        id: "type-articles",
        slug: "articles",
        tenantId: "tenant-1",
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
        errors: [{ path: "title", message: "Title is required" }],
      })

      const request = new NextRequest("http://localhost:3000/api/tenant/tenant-1/content/articles", {
        method: "POST",
        body: JSON.stringify({
          data: {},
          publish: false,
        }),
      })
      const params = Promise.resolve({ tenant: "tenant-1", contentSlug: "articles" })

      const response = await POST(request, { params })
      expect(response.status).toBe(400)
      
      const body = await response.json()
      expect(body.error).toBe("Validation failed")
      expect(body.details[0].message).toBe("Title is required")
    })

    it("should create content entry successfully", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "user-1", role: "user" },
      } as any)
      vi.mocked(getTenantAccess).mockResolvedValue({
        tenantId: "tenant-1",
        role: "owner",
        tenant: { id: "tenant-1", name: "Tenant 1", slug: "tenant-1", plan: "free" },
      })
      vi.mocked(db.contentType.findFirst).mockResolvedValue({
        id: "type-articles",
        slug: "articles",
        tenantId: "tenant-1",
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
        errors: [],
      })

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

      const request = new NextRequest("http://localhost:3000/api/tenant/tenant-1/content/articles", {
        method: "POST",
        body: JSON.stringify({
          data: { title: "My Entry" },
          publish: false,
          locale: "en",
        }),
      })
      const params = Promise.resolve({ tenant: "tenant-1", contentSlug: "articles" })

      const response = await POST(request, { params })
      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.entry.id).toBe("new-entry-1")
    })
  })
})
