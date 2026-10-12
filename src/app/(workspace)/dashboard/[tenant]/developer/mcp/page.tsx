import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { MCPDashboardClient } from "./mcp-client"

export default async function MCPPage({ params }: { params: Promise<{ tenant: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant: tenantSlug } = await params
  const access = await getTenantAccess(session, tenantSlug)
  if (!access) redirect("/dashboard")

  const tenantSummary = access.tenant

  // MCP token creation/regeneration/deletion now happens at /developer/
  // api-keys' "MCP Token" tab — this page only needs tenant/subscription
  // status to render the config/setup guides.
  const [tenant, subscription] = await Promise.all([
    db.tenant.findUnique({
      where: { id: tenantSummary.id },
      select: { id: true, name: true, slug: true, plan: true, status: true, hostingStatus: true },
    }),
    db.subscription.findFirst({
      where: { tenantId: tenantSummary.id },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const currentStatus = tenant?.status ?? "active"
  const currentHostingStatus = tenant?.hostingStatus ?? null
  const currentPlan = tenant?.plan ?? tenantSummary.plan

  // Determine Paid & Hosting Plan status
  const isPaid = (currentStatus === "active" && (subscription?.status === "active" || subscription?.status === "paid" || subscription?.status === "trialing")) || currentHostingStatus === "active"

  return (
    <MCPDashboardClient
      tenantSlug={tenantSlug}
      tenantId={tenantSummary.id}
      plan={currentPlan}
      isPaid={isPaid}
      subscriptionStatus={subscription?.status || "inactive"}
    />
  )
}
