/**
 * Platform-level staff roles — SaCMS team accounts, not tenant members.
 *
 * `super_admin`: full platform control, including /admin/* (billing, RBAC,
 * tenant overrides, user management).
 * `developer`: SaCMS team member who can enter any workspace (to help a
 * user, or build their own) exactly like a super_admin would from inside
 * that workspace — but has no access to /admin/* at all. That boundary is
 * enforced separately (ADMIN_PORTAL_ROLES in admin/layout.tsx and the
 * `allowed` set in withAdminAuth), not by this helper.
 */
export function isPlatformStaff(role: string | null | undefined): boolean {
  return role === "super_admin" || role === "developer"
}
