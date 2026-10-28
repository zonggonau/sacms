import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isOwnerEligibleForByoInfra } from "@/lib/database"

/**
 * Server-side gate for /dashboard/infrastructure — hiding the sidebar nav
 * item (see global-sidebar.tsx's canUseByoInfra) isn't enough on its own,
 * since a regular user without an Enterprise/Agency plan could still open
 * the URL directly. Redirect before the client page ever renders, rather
 * than rendering it and relying on a client-side check.
 */
export default async function InfrastructureLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/login")
  }

  const eligible = await isOwnerEligibleForByoInfra(session.user.id).catch(() => false)
  if (!eligible) {
    redirect("/dashboard")
  }

  return <>{children}</>
}
