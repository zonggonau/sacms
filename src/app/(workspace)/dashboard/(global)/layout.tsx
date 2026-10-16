import { GlobalSidebar } from "@/components/dashboard/global-sidebar"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Metadata } from "next"
import { db } from "@/lib/database"
import { isEnterpriseTenant } from "@/lib/license"
import { getGlobalWorkspaceId } from "@/lib/settings"

export const metadata: Metadata = {
  title: "Dashboard | SaCMS",
  description: "Global Dashboard",
}

export default async function GlobalDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/login")
  }

  // Fetch brand name from footer content entry
  let brandName = ""
  try {
    const footerEntry = await db.contentEntry.findFirst({
      where: { contentType: { slug: "sacms-footer" }, status: "PUBLISHED" },
      select: { data: true }
    })
    if (footerEntry?.data) {
      const data = typeof footerEntry.data === 'string' ? JSON.parse(footerEntry.data) : footerEntry.data
      brandName = data.brand_name || ""
    }
  } catch (e) {
    console.error("Failed to fetch brand name", e)
  }

  // "Database & Storage" nav item only shows once the account-level BYODB/
  // BYOS page actually has something to offer — same gate the page/API
  // route itself enforces (isEnterpriseTenant, plus the legacy plan ===
  // "enterprise" tier for backward compat) — see getOwnerMasterInfra() in
  // src/lib/database.ts.
  let hasEnterpriseLicense = session.user.plan === "enterprise"
  if (!hasEnterpriseLicense) {
    try {
      const globalId = await getGlobalWorkspaceId()
      hasEnterpriseLicense = await isEnterpriseTenant(globalId, session.user.id)
    } catch (e) {
      console.error("Failed to check enterprise license", e)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <GlobalSidebar session={session} brandName={brandName} hasEnterpriseLicense={hasEnterpriseLicense} />
      <div className="flex-1 overflow-y-auto flex flex-col bg-background text-foreground relative">
        <main className="flex-1 p-4 pt-16 md:p-10 w-full">
          {children}
        </main>
      </div>
    </div>
  )
}

