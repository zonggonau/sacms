/**
 * Tenant-scoped Enterprise Licenses page (for admin sidebar compatibility)
 * Delegates to the root enterprise licenses page
 */
import { redirect } from "next/navigation"

export default function TenantEnterpriseLicensesPage() {
  redirect("/admin/enterprise/licenses")
}
