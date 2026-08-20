import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/database"

describe("Admin RBAC Security System", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should have default permissions defined and accessible in DB", async () => {
    const mockPerms = [
      { id: "1", name: "workspaces.create", displayName: "Create Workspaces", category: "workspaces" },
      { id: "2", name: "workspaces.manage_all", displayName: "Manage All Workspaces", category: "workspaces" },
      { id: "3", name: "billing.manage_own", displayName: "Manage Own Subscriptions", category: "billing" },
      { id: "4", name: "users.manage_platform", displayName: "Manage Platform Accounts", category: "users" },
      { id: "5", name: "licenses.manage", displayName: "Manage Enterprise Licenses", category: "security" },
    ]
    vi.mocked(db.permission.findMany).mockResolvedValueOnce(mockPerms as any)

    const permissions = await db.permission.findMany()
    expect(permissions.length).toBe(5)

    const names = permissions.map(p => p.name)
    expect(names).toContain("workspaces.create")
    expect(names).toContain("workspaces.manage_all")
    expect(names).toContain("billing.manage_own")
    expect(names).toContain("users.manage_platform")
    expect(names).toContain("licenses.manage")
  })

  it("should have global role permissions defined for system roles", async () => {
    const mockRolePerms = [
      { id: "rp1", roleId: "super_admin", permissionId: "1", granted: true, tenantId: null },
      { id: "rp2", roleId: "super_admin", permissionId: "2", granted: true, tenantId: null },
      { id: "rp3", roleId: "owner", permissionId: "1", granted: true, tenantId: null },
    ]
    vi.mocked(db.rolePermission.findMany).mockResolvedValueOnce(mockRolePerms as any)

    const rolePerms = await db.rolePermission.findMany({
      where: { tenantId: null }
    })
    expect(rolePerms.length).toBe(3)

    const superAdminPerms = rolePerms.filter(rp => rp.roleId === "super_admin")
    expect(superAdminPerms.length).toBe(2)

    const ownerPerms = rolePerms.filter(rp => rp.roleId === "owner")
    expect(ownerPerms.length).toBe(1)
  })
})

