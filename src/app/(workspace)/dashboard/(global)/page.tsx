import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { redirect } from "next/navigation"
import { WorkspaceManager } from "@/components/dashboard/workspace-manager"
import { getUserPlanConfig } from "@/lib/tenant-plan"
import { isEnterpriseTenant } from "@/lib/license"
import { getGlobalWorkspaceId } from "@/lib/settings"
import { isPlatformStaff } from "@/lib/platform-roles"

export default async function WorkspaceSelectionPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const isSuperAdmin = session.user.role === "super_admin"
  // Platform staff (super_admin + developer) see every workspace here
  // without needing a membership row — strictly narrower than isSuperAdmin
  // is used for the /admin nav link below, which stays super_admin-only.
  const isStaffAccess = isPlatformStaff(session.user.role)

  // Resolved per-request rather than once at module load — the previous
  // top-level `await` cached this for the process lifetime, so a DB hiccup
  // at cold start (or the setting changing later) would silently wedge
  // every request on a stale/empty value.
  const globalId = await getGlobalWorkspaceId()
  const SYSTEM_SLUGS = [globalId, "sacms-global", "sacms"]

  const whereClause: any = {
    slug: { notIn: SYSTEM_SLUGS },
    id: { not: globalId }
  }

  if (!isStaffAccess) {
    whereClause.members = { some: { userId: session.user.id } }
  }

  const [tenants, globalTenant] = await Promise.all([
    db.tenant.findMany({
      where: whereClause,
      include: {
        members: {
          where: { userId: session.user.id },
          select: { role: true }
        },
        subscriptions: {
          orderBy: { currentPeriodEnd: "desc" },
          take: 1
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    // The SaCMS Global workspace itself — shown separately from the normal
    // tenant list (never matched by `whereClause` above) so IT support staff
    // who are members of it (or any super_admin) can still reach it from
    // here, without it being deletable/manageable like a regular workspace.
    db.tenant.findFirst({
      where: {
        // Matches the same id-or-slug fallback as SYSTEM_SLUGS above —
        // globalId may be the real cuid, or just the "sacms-global" slug
        // fallback when no setting is configured yet.
        OR: [{ id: globalId }, { slug: globalId }, { slug: "sacms-global" }],
        ...(isStaffAccess ? {} : { members: { some: { userId: session.user.id } } })
      },
      include: {
        members: {
          where: { userId: session.user.id },
          select: { role: true }
        },
        subscriptions: {
          orderBy: { currentPeriodEnd: "desc" },
          take: 1
        }
      }
    })
  ])

  let isGlobalEnterprise = await isEnterpriseTenant(globalId)
  if (!isGlobalEnterprise) {
    isGlobalEnterprise = await isEnterpriseTenant(session.user.id)
  }

  // Redirect to billing if all workspaces are suspended, unless enterprise mode is active
  if (!isGlobalEnterprise && tenants.length > 0 && tenants.every(t => t.status === "suspended")) {
    redirect("/dashboard/billing")
  }

  // If non-admin / non-owner team member belongs to a single workspace, forward directly to its CMS studio
  const isOwnerOrAdmin = session.user.role === "admin" || isStaffAccess || session.user.role === "owner" || tenants.some(t => t.members[0]?.role === "owner" || t.members[0]?.role === "admin")
  if (!isOwnerOrAdmin && tenants.length === 1) {
    redirect(`/dashboard/${tenants[0].slug || tenants[0].id}/cms`)
  }

  const formatTenant = async (t: typeof tenants[number], isGlobalWorkspace = false) => {
    const sub = t.subscriptions[0]
    let daysRemaining: number | null = null
    let isExpired = false

    const enterprise = isGlobalEnterprise || await isEnterpriseTenant(t.id, session.user.id)

    if (!enterprise) {
      if (t.status === "suspended") {
        isExpired = true
      } else if (sub?.currentPeriodEnd) {
        const diff = new Date(sub.currentPeriodEnd).getTime() - Date.now()
        daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
        if (new Date() > new Date(sub.currentPeriodEnd)) {
          isExpired = true
        }
      }
    }

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: (enterprise && t.status === "suspended") ? "active" : t.status,
      plan: t.plan,
      createdAt: t.createdAt.toISOString(),
      role: t.members[0]?.role || (isStaffAccess ? 'owner' : 'member'),
      daysRemaining,
      isExpired,
      isEnterprise: enterprise,
      subscriptionStatus: sub?.status || null,
      expiresAt: sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toISOString() : null,
      isGlobalWorkspace,
    }
  }

  const formattedTenants = await Promise.all(tenants.map((t) => formatTenant(t)))

  // Surface SaCMS Global first in the list — never deletable/manageable like
  // a regular workspace (see isGlobalWorkspace in WorkspaceManager), just a
  // way in for whoever's allowed to see it.
  if (globalTenant) {
    formattedTenants.unshift(await formatTenant(globalTenant, true))
  }

  // Fetch global dependencies for the creation dialog
  let dbTemplates: any[] = []
  let workspacePlans: any[] = []
  let addonPlans: any[] = []
  let usage: any = null

  try {
    const { getWorkspacePlans, getAddons } = await import("@/lib/pricing")
    const [wPlans, aPlans] = await Promise.all([
      getWorkspacePlans(),
      getAddons(),
    ])

    workspacePlans = wPlans.map(p => ({
      id: p.slug,
      plan_slug: p.slug || "free",
      name: p.name || "Workspace Plan",
      desc: p.description || "",
      priceAmount: p.price,
      yearlyPrice: p.yearlyPrice ?? p.price * 10,
      max_content_types: p.maxContentTypes,
      max_content_entries: p.maxContentEntries,
      max_storage: p.maxStorageMb,
      max_team_members: p.maxTeamMembers,
      max_locales: p.maxLocales,
      max_api_calls: p.maxApiCalls,
      features: Array.isArray(p.features) ? p.features : []
    })).sort((a, b) => (a.priceAmount || 0) - (b.priceAmount || 0))

    addonPlans = aPlans.map(a => ({
      id: a.slug,
      name: a.name || "Add-on",
      desc: a.description || "",
      priceLabel: a.priceLabel || "",
      priceAmount: a.price ?? 0,
      icon: a.icon || "Sparkles"
    }))

    // Check user plan limits using centralized enforcement (handles enterprise/admin bypasses)
    const { enforceUserPlanLimit } = await import("@/lib/plan-enforcement")
    const limitResult = await enforceUserPlanLimit(session.user.id, "workspaces")
    usage = {
      current: tenants.length, // Ensure it matches the list we fetched
      max: limitResult.max,
      allowed: limitResult.max === null || limitResult.max > 9000 || tenants.length < limitResult.max,
      plan: limitResult.planSlug
    }

    if (isGlobalEnterprise) {
      // One single option, not a tier pick — every new workspace this
      // account creates is simply covered by its account-level Enterprise
      // License (unlimited content/team/API, pooled storage shared across
      // every workspace the owner has — see EnterpriseLicenseBanner /
      // getOwnerStorageLicense() in plan-enforcement.ts). No per-workspace
      // storage addons either: storage isn't metered per workspace under
      // this license, so offering a storage top-up here would be
      // meaningless — addonPlans is cleared below for the same reason.
      workspacePlans = [
        {
          id: "enterprise-license",
          plan_slug: "enterprise",
          name: "Enterprise (Lisensi Anda)",
          desc: "Workspace ini otomatis tercakup oleh Lisensi Enterprise akun Anda — tanpa batas konten, tim, dan API.",
          priceAmount: 0,
          yearlyPrice: 0,
          max_content_entries: 999999999,
          max_team_members: 999999999,
          max_api_calls: 999999999,
          features: [
            "Konten & Anggota Tim Tanpa Batas",
            "API Requests Tanpa Batas",
            "Storage dari Pool Lisensi Enterprise Anda",
            "RBAC & Audit Log Penuh",
          ],
        },
      ]
      addonPlans = []
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
      isSuperAdmin={isSuperAdmin}
      isAccountEnterpriseLicensed={isGlobalEnterprise}
    />
  )
}
