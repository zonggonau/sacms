/**
 * Tenant-scoped Enterprise page
 */
import { redirect } from "next/navigation"

export default function TenantEnterprisePage() {
  redirect("/admin/enterprise/licenses")
}
