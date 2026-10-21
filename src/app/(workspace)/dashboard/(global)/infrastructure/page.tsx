import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isPlatformStaff } from "@/lib/platform-roles"
import { AccountInfrastructureView } from "./account-infrastructure-view"

export default async function AccountInfrastructurePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/login")
  }

  // Platform staff (super_admin + developer) configure/own no personal
  // BYODB/BYOS workspaces here — same restriction global-sidebar.tsx
  // already applies to this page's own nav link, enforced again here so
  // a direct URL visit can't bypass it.
  if (isPlatformStaff(session.user.role)) {
    redirect("/dashboard")
  }

  return <AccountInfrastructureView />
}
