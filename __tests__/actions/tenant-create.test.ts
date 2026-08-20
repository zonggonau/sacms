import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/database"
import { getServerSession } from "next-auth"
import { createTenantAction } from "@/actions/tenant"

// Mock Database
vi.mock("@/lib/database", () => {
  const mockDb = {
    tenant: { findUnique: vi.fn(), create: vi.fn() },
    tenantMember: { create: vi.fn() },
    subscription: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn((cb) => cb(mockDb)),
  }
  return {
    db: mockDb,
    getTenantDb: vi.fn().mockResolvedValue(mockDb),
  }
})

// Mock Next Cache & Auth
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

// Mock Plan Enforcement
vi.mock("@/lib/plan-enforcement", () => ({
  enforceUserPlanLimit: vi.fn().mockResolvedValue({ allowed: true, planSlug: "pro" }),
  validateWorkspacePlanBinding: vi.fn().mockReturnValue({ allowed: true }),
}))

// Mock Tenant Plan
vi.mock("@/lib/tenant-plan", () => ({
  getUserPlanConfig: vi.fn().mockResolvedValue({ plan_slug: "pro", max_workspaces: 10 }),
}))

// Mock Tenant Provisioning & Audit
vi.mock("@/lib/tenant-provisioning", () => ({
  provisionTenant: vi.fn().mockResolvedValue({}),
}))
vi.mock("@/lib/audit-log", () => ({
  logAudit: vi.fn().mockResolvedValue({}),
  AuditAction: { TENANT_CREATED: "TENANT_CREATED" },
}))

describe("Tenant Creation Action with Addons", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-123", email: "user@example.com", role: "admin" }
    } as any)
  })

  it("should successfully create tenant and add-on subscriptions when addons are provided", async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue(null)
    vi.mocked(db.tenant.create).mockResolvedValue({
      id: "tenant-new-123",
      name: "My Pro Workspace",
      slug: "my-pro-workspace",
      plan: "pro",
      status: "provisioning",
    } as any)

    const result = await createTenantAction({
      name: "My Pro Workspace",
      description: "A test workspace with AI Writer addon",
      plan: "pro",
      addons: ["ai_writer", "adv_audit"]
    })

    expect(result.success).toBe(true)
    expect(result.tenantId).toBe("tenant-new-123")

    // Check base subscription
    expect(db.subscription.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: "tenant-new-123",
        plan: "pro",
        status: "trialing",
      })
    }))

    // Check add-on subscriptions
    expect(db.subscription.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: "tenant-new-123",
        plan: "ai_writer",
        status: "active",
      })
    }))
    expect(db.subscription.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: "tenant-new-123",
        plan: "adv_audit",
        status: "active",
      })
    }))
  })
})
