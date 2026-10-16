import { isEnterpriseTenant } from "@/lib/license"
import { getGlobalWorkspaceId } from "@/lib/settings"

/** Gate for the account-level BYODB/BYOS master infra override — an active
 *  Enterprise License, or the legacy `plan === "enterprise"` tier kept for
 *  backward compat. Shared between the infra routes so the write gate, the
 *  read gate, and the sidebar nav item all agree on the same definition. */
export async function hasAccountLicense(userId: string, plan: string | undefined): Promise<boolean> {
  if (plan === "enterprise") return true
  const globalId = await getGlobalWorkspaceId()
  return isEnterpriseTenant(globalId, userId)
}
