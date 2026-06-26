import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { redirect } from "next/navigation"
import { WorkspaceManager } from "@/components/dashboard/workspace-manager"
import { getUserPlanConfig } from "@/lib/tenant-plan"
import { isEnterpriseTenant } from "@/lib/license"
const SYSTEM_SLUGS = ["sacms-global"]

export default async function WorkspaceSelectionPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const tenants = await db.tenant.findMany({
    where: {
      members: { some: { userId: session.user.id } },
      slug: { notIn: SYSTEM_SLUGS },
    },
    include: {
      members: {
        where: { userId: session.user.id },
        select: { role: true }
      },
      subscriptions: {
        where: { status: { in: ["active", "trialing"] } },
        orderBy: { currentPeriodEnd: "desc" },
        take: 1
      }
    },
    orderBy: { createdAt: "desc" }
  })

  let isGlobalEnterprise = await isEnterpriseTenant("sacms-global")
  if (!isGlobalEnterprise) {
    isGlobalEnterprise = await isEnterpriseTenant(session.user.id)
  }

  // Redirect to billing if all workspaces are suspended, unless enterprise mode is active
  if (!isGlobalEnterprise && tenants.length > 0 && tenants.every(t => t.status === "suspended")) {
    redirect("/dashboard/billing")
  }


  const formattedTenants = tenants.map(t => {
    const sub = t.subscriptions[0]
    let daysRemaining = null
    
    if (sub?.currentPeriodEnd) {
      const diff = new Date(sub.currentPeriodEnd).getTime() - Date.now()
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
    }

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: (isGlobalEnterprise && t.status === "suspended") ? "active" : t.status,
      plan: t.plan,
      createdAt: t.createdAt.toISOString(),
      role: t.members[0]?.role || 'member',
      daysRemaining,
      subscriptionStatus: sub?.status || null
    }
  })

  // Fetch global dependencies for the creation dialog
  let dbTemplates: any[] = []
  let workspacePlans: any[] = []
  let addonPlans: any[] = []
  let usage = null

  try {
    console.log("[Dashboard] Fetching platform data...");
    const [templates, wPlans, aPlans] = await Promise.all([
      db.contentEntry.findMany({
        where: { contentType: { slug: "templates" }, status: "PUBLISHED" },
        select: { id: true, data: true }
      }),
      db.contentEntry.findMany({
        where: { contentType: { slug: "sacms-workspace-pricing" }, status: "PUBLISHED" },
        select: { id: true, data: true }
      }),
      db.contentEntry.findMany({
        where: { contentType: { slug: "sacms-addons" }, status: "PUBLISHED" },
        select: { id: true, data: true }
      })
    ])

    console.log(`[Dashboard] Found: ${templates.length} templates, ${wPlans.length} plans, ${aPlans.length} addons.`);

    const cleanPrice = (val: any) => {
      if (typeof val === 'number') return val
      if (typeof val === 'string') return parseInt(val.replace(/[^\d]/g, ''), 10) || 0
      return 0
    }

    dbTemplates = templates.map(t => {
      const d = typeof t.data === 'string' ? JSON.parse(t.data) : t.data
      return { ...d, id: t.id }
    })
    workspacePlans = wPlans.map(t => {
      const d = t.data as any
      const price = cleanPrice(d.price)
      const yearlyPrice = d.yearly_price !== undefined ? cleanPrice(d.yearly_price) : price * 10

      return {
        id: d.plan_slug || t.id,
        name: d.name || "Standard Plan",
        desc: d.description || d.desc || "",
        priceAmount: price,
        yearlyPrice: yearlyPrice,
        features: d.features || []
      }
    }).sort((a, b) => (a.priceAmount || 0) - (b.priceAmount || 0))

    addonPlans = aPlans.map(t => {
      const d = t.data as any
      return {
        id: t.id || d.name?.toLowerCase().replace(/ /g, '-'),
        name: d.name || "Add-on",
        priceAmount: cleanPrice(d.price)
      }
    })

    // Check user plan limits using centralized enforcement (handles enterprise/admin bypasses)
    const { enforceUserPlanLimit } = await import("@/lib/plan-enforcement")
    const limitResult = await enforceUserPlanLimit(session.user.id, "workspaces")
    usage = {
      current: tenants.length, // Ensure it matches the list we fetched
      max: limitResult.max,
      allowed: limitResult.max === null || limitResult.max > 9000 || tenants.length < limitResult.max,
      plan: limitResult.planSlug
    }
  } catch (e) {
    console.error("Failed to fetch global dependencies in RSC:", e);
  }

  return (
    <WorkspaceManager 
      initialTenants={formattedTenants}
      usage={usage}
      dbTemplates={dbTemplates}
      workspacePlans={workspacePlans}
      addonPlans={addonPlans}
      isSuperAdmin={session.user.role === "super_admin"}
    />
  )
}
