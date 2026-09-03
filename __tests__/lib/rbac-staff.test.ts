import { describe, it, expect } from "vitest"
import {
  STAFF_ROLES,
  roleMeets,
  isWorkspaceAdmin,
  roleHasPermission,
  PERMISSIONS,
} from "@/lib/rbac/staff"

describe("rbac/staff", () => {
  describe("roleMeets", () => {
    it("orders roles viewer < … < owner", () => {
      expect(roleMeets("owner", "admin")).toBe(true)
      expect(roleMeets("admin", "admin")).toBe(true)
      expect(roleMeets("editor", "admin")).toBe(false)
      expect(roleMeets("viewer", "viewer")).toBe(true)
      expect(roleMeets("contributor", "editor")).toBe(false)
    })
    it("rejects unknown roles", () => {
      expect(roleMeets("wizard", "viewer")).toBe(false)
      expect(roleMeets("", "viewer")).toBe(false)
    })
    it("covers every declared role", () => {
      for (const r of STAFF_ROLES) expect(roleMeets(r, "viewer")).toBe(true)
    })
  })

  describe("isWorkspaceAdmin", () => {
    it("is true only for owner and admin", () => {
      expect(isWorkspaceAdmin("owner")).toBe(true)
      expect(isWorkspaceAdmin("admin")).toBe(true)
      expect(isWorkspaceAdmin("editor")).toBe(false)
    })
  })

  describe("roleHasPermission", () => {
    it("owner/admin bypass the map", () => {
      expect(roleHasPermission("owner", PERMISSIONS.CONTENT_TYPE_DELETE)).toBe(true)
      expect(roleHasPermission("admin", "anything.at.all")).toBe(true)
    })
    it("editor can delete any content, author only their own", () => {
      expect(roleHasPermission("editor", PERMISSIONS.CONTENT_DELETE)).toBe(true)
      expect(roleHasPermission("author", PERMISSIONS.CONTENT_DELETE)).toBe(false)
      expect(roleHasPermission("author", PERMISSIONS.CONTENT_DELETE, true)).toBe(true)
    })
    it("author cannot update content they do not own", () => {
      expect(roleHasPermission("author", PERMISSIONS.CONTENT_UPDATE)).toBe(false)
      expect(roleHasPermission("author", PERMISSIONS.CONTENT_UPDATE, true)).toBe(true)
    })
    it("viewer / subscriber are read-only", () => {
      expect(roleHasPermission("viewer", PERMISSIONS.CONTENT_READ)).toBe(true)
      expect(roleHasPermission("viewer", PERMISSIONS.CONTENT_CREATE)).toBe(false)
      expect(roleHasPermission("subscriber", PERMISSIONS.MEDIA_UPLOAD)).toBe(false)
    })
    it("unknown role has nothing", () => {
      expect(roleHasPermission("ghost", PERMISSIONS.CONTENT_READ)).toBe(false)
    })
  })
})
