import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { redirect } from "next/navigation"
import { WorkspaceManager } from "@/components/dashboard/workspace-manager"
import { getUserPlanConfig } from "@/lib/tenant-plan"
import { isEnterpriseTenant } from "@/lib/license"
import { getGlobalWorkspaceId } from "@/lib/settings"
import { isPlatformStaff } from "@/lib/platform-roles"
import { getStorageQuota } from "@/lib/plan-enforcement"

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

    // Per-workspace storage figures, read-only here — only fetched for
    // enterprise-licensed tenants, where each workspace now has its own
    // slice of the owner's pooled grant (see getStorageQuota()'s enterprise
    // branch in plan-enforcement.ts). Regular tenants' usage is already
    // shown on their own subscriptions page, not surfaced in this list.
    let storageUsedBytes: number | null = null
    let storageLimitBytes: number | null = null
    if (enterprise && !isGlobalWorkspace) {
      const quota = await getStorageQuota(t.id)
      storageUsedBytes = quota.usedBytes
      storageLimitBytes = quota.limitBytes
    }

    // Also skip this for any tenant whose own `plan` column already says
    // "enterprise" — even if the deeper license check above came back
    // false (e.g. no LICENSE_KEY configured locally, an expired/revoked
    // license, or a tenant marked enterprise without ever being issued a
    // real license). Confirmed live: such a tenant still carries a leftover
    // regular-plan trial `Subscription` row from before it became
    // enterprise, whose long-past `currentPeriodEnd` made this branch mark
    // it `isExpired` — showing a contradictory "Masa Percobaan Berakhir"
    // badge right next to the "ENTERPRISE" plan badge. An enterprise-plan
    // tenant is never gated by a regular subscription's trial period, so
    // this card must never show that generic trial-expiry state regardless
    // of why the license check failed.
    if (!enterprise && t.plan !== "enterprise") {
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
      storageUsedBytes,
      storageLimitBytes,
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

    // Free workspace tier only when BOTH hold: the account's own plan is
    // itself "free" (a Starter/Pro/Business account never gets a free
    // workspace, full stop), AND it hasn't used its one free workspace
    // allowance yet (see User.freeWorkspaceUsed). Every workspace created
    // from this "new workspace" flow is brand new by definition, so
    // there's no "already on free, keep showing it" exception to make
    // here like the per-tenant subscriptions page has.
    const dbUser = await db.user.findUnique({ where: { id: session.user.id }, select: { plan: true, freeWorkspaceUsed: true } })
    if (dbUser && (dbUser.plan !== "free" || dbUser.freeWorkspaceUsed)) {
      workspacePlans = workspacePlans.filter(p => p.plan_slug !== "free")
    }

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
      // License (unlimited content/team/API; storage comes out of the
      // owner's pooled grant — see EnterpriseLicenseBanner's "Alokasi
      // Storage per Workspace" section / getOwnerStorageAllocationPlan() in
      // plan-enforcement.ts, where the owner can assign this brand-new
      // workspace its own GB slice once it exists). No storage add-on
      // picker at creation time either — a workspace with zero usage so far
      // has nothing to top up yet; that's handled later from its own
      // /subscriptions?tab=storage page, which already supports it —
      // addonPlans is cleared below just for this creation step.
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
