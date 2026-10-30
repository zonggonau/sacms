/**
 * Platform-level staff roles — SaCMS team accounts, not tenant members.
 *
 * `super_admin`: full platform control, including every /admin/* page
 * (billing, pricing, RBAC, domains, databases, webhooks, tenant overrides,
 * user management).
 * `developer`: SaCMS team member who can enter any workspace (to help a
 * user, or build their own) exactly like a super_admin would from inside
 * that workspace — but has no access to /admin/* at all. That boundary is
 * enforced separately (ADMIN_PORTAL_ROLES in admin/layout.tsx and the
 * `allowed` set in withAdminAuth), not by this helper.
 * `employee` ("Staf Internal"): narrow /admin/* access — Support tickets +
 * live chat, Pricing (read-only), and Proposals/Penawaran (full CRUD, its
 * main tool). No access to billing, users, RBAC, domains, databases, or
 * webhooks.
 * `finance` ("Bendahara"): narrow /admin/* access — Billing reports
 * (transactions, margin, laba-rugi, invoice generation) and Pricing (full
 * CRUD — the one role besides super_admin that can actually change what
 * customers are charged). No access to Support, users, RBAC, domains,
 * databases, or webhooks.
 *
 * The legacy `admin` and `karyawan` role values are retired — never assign
 * them to a new account. `isPlatformStaff()` below only recognizes
 * super_admin/developer; `employee`/`finance` are intentionally excluded
 * since they do NOT get the cross-tenant workspace bypass those two get.
 */
export function isPlatformStaff(role: string | null | undefined): boolean {
  return role === "super_admin" || role === "developer"
}
