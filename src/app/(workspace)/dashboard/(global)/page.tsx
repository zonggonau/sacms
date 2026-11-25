import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { redirect } from "next/navigation"
import { WorkspaceManager } from "@/components/dashboard/workspace-manager"
import type { WorkspacePlan, AddonPlan } from "@/components/dashboard/workspace-creation-dialog"
import { getUserPlanConfig } from "@/lib/tenant-plan"
import { INSTANCE_LICENSE_ID, isEnterpriseTenant } from "@/lib/license"
import { getGlobalWorkspaceId } from "@/lib/settings"
import { isPlatformStaff } from "@/lib/platform-roles"
import { enforceUserPlanLimit, getStorageQuota, validateWorkspacePlanBinding } from "@/lib/plan-enforcement"

const PAGE_SIZE = 20
const DAY_MS = 1000 * 60 * 60 * 24

type LifecycleRow = { status: string; plan: string; subscriptions: { currentPeriodEnd: Date | null }[] }

/**
 * Trial/expiry state of one workspace. `enterprise` is passed in so callers
 * decide whether to trust the exact per-tenant license check (page rows) or the
 * cheaper instance-level signal (the summary counts).
 */
function lifecycleOf(t: LifecycleRow, enterprise: boolean) {
  let daysRemaining: number | null = null
  let isExpired = false
  if (!enterprise && t.plan !== "enterprise") {
    if (t.status === "suspended") {
      isExpired = true
    } else if (t.subscriptions[0]?.currentPeriodEnd) {
      const end = new Date(t.subscriptions[0].currentPeriodEnd)
      daysRemaining = Math.max(0, Math.ceil((end.getTime() - Date.now()) / DAY_MS))
      if (new Date() > end) isExpired = true
    }
  }
  const status = enterprise && t.status === "suspended" ? "active" : t.status
  return { status, daysRemaining, isExpired }
}

export default async function WorkspaceSelectionPage({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { page: pageParam, q: qParam } = await searchParams
  const q = (qParam ?? "").trim().slice(0, 100)
  const requestedPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)

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

  // Every workspace this account can see (the paginated list and the summary
  // counts are both drawn from this set).
  const baseWhere: any = {
    slug: { notIn: SYSTEM_SLUGS },
    id: { not: globalId },
  }
  if (!isStaffAccess) {
    baseWhere.members = { some: { userId: session.user.id } }
  }
  const listWhere = q
    ? { AND: [baseWhere, { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] }] }
    : baseWhere

  const isGlobalEnterpriseFast = await isEnterpriseTenant(INSTANCE_LICENSE_ID)
  const isGlobalEnterprise = isGlobalEnterpriseFast || (await isEnterpriseTenant(session.user.id))

  const [total, summaryRows, globalTenant, adminMemberships] = await Promise.all([
    db.tenant.count({ where: listWhere }),
    // Lightweight rows for every workspace: feeds the summary counts, and the
    // "every workspace suspended" / "only one workspace" redirects below.
    db.tenant.findMany({
      where: baseWhere,
      select: {
        id: true,
        slug: true,
        status: true,
        plan: true,
        subscriptions: { orderBy: { currentPeriodEnd: "desc" }, take: 1, select: { currentPeriodEnd: true } },
      },
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
    }),
    // Owner/admin membership of any non-system workspace, for the "owner or admin"
    // check below. Staff already pass that check unconditionally.
    isStaffAccess ? Promise.resolve(0) : db.tenantMember.count({
      where: {
        userId: session.user.id,
        role: { in: ["owner", "admin"] },
        tenant: { slug: { notIn: SYSTEM_SLUGS }, id: { not: globalId } },
      },
    }),
  ])

  // Redirect to billing if all workspaces are suspended, unless enterprise mode is active
  if (!isGlobalEnterprise && summaryRows.length > 0 && summaryRows.every(t => t.status === "suspended")) {
    redirect("/dashboard/billing")
  }

  // If non-admin / non-owner team member belongs to a single workspace, forward directly to its CMS studio
  const isOwnerOrAdmin = session.user.role === "admin" || isStaffAccess || session.user.role === "owner" || adminMemberships > 0
  if (!isOwnerOrAdmin && total === 1 && summaryRows.length === 1) {
    redirect(`/dashboard/${summaryRows[0].slug || summaryRows[0].id}/cms`)
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(requestedPage, pageCount)
  const pageRows = total === 0 ? [] : await db.tenant.findMany({
    where: listWhere,
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
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  })

  const formatTenant = async (t: typeof pageRows[number], isGlobalWorkspace = false) => {
    const sub = t.subscriptions[0]
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

    // An enterprise-plan tenant is never gated by a regular subscription's
    // trial period, even when the license check above came back false (see
    // lifecycleOf). Without this, a leftover trial row showed "Masa Percobaan
    // Berakhir" next to the ENTERPRISE badge.
    const life = lifecycleOf(t, enterprise)

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: life.status,
      plan: t.plan,
      createdAt: t.createdAt.toISOString(),
      role: t.members[0]?.role || (isStaffAccess ? 'owner' : 'member'),
      daysRemaining: life.daysRemaining,
      isExpired: life.isExpired,
      isEnterprise: enterprise,
      subscriptionStatus: sub?.status || null,
      expiresAt: sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toISOString() : null,
      isGlobalWorkspace,
      storageUsedBytes,
      storageLimitBytes,
    }
  }

  const formattedTenants = await Promise.all(pageRows.map((t) => formatTenant(t)))

  // Surface SaCMS Global first in the list — never deletable/manageable like
  // a regular workspace (see isGlobalWorkspace in WorkspaceManager), just a
  // way in for whoever's allowed to see it. It sits outside the pagination,
  // so it appears only on the first page, and only when it matches the search.
  const globalMatches = !!globalTenant && (!q || `${globalTenant.name} ${globalTenant.slug}`.toLowerCase().includes(q.toLowerCase()))
  if (globalTenant && globalMatches && page === 1) {
    formattedTenants.unshift(await formatTenant(globalTenant, true))
  }

  // Summary counts over every workspace, not just this page. Enterprise is taken
  // from the instance license or the plan column; a workspace with only its own
  // per-tenant license on a non-enterprise plan may count differently here than
  // in its row badge.
  const summarize = (rows: LifecycleRow[], globalRow?: LifecycleRow | null) => {
    const all = globalRow ? [...rows, globalRow] : rows
    let expired = 0, expiringSoon = 0, active = 0
    for (const t of all) {
      const life = lifecycleOf(t, isGlobalEnterprise || t.plan === "enterprise")
      if (life.isExpired || (life.daysRemaining !== null && life.daysRemaining <= 0 && life.status !== "active")) expired++
      if (!life.isExpired && life.daysRemaining !== null && life.daysRemaining <= 3 && life.daysRemaining > 0) expiringSoon++
      if (!life.isExpired && life.status === "active" && (life.daysRemaining === null || life.daysRemaining > 0)) active++
    }
    return { total: all.length, expired, expiringSoon, active, suspended: all.length - active }
  }
  const summary = summarize(summaryRows, globalTenant)

  // Fetch global dependencies for the creation dialog
  let dbTemplates: any[] = []
  let workspacePlans: WorkspacePlan[] = []
  let addonPlans: AddonPlan[] = []
  let freePlanUnavailableReason: string | null = "Kelayakan paket Gratis belum dapat diperiksa."
  let usage: any = null

  try {
    const { getWorkspacePlans, getAddons } = await import("@/lib/pricing")
    const [wPlans, aPlans, freeBinding, limitResult] = await Promise.all([
      getWorkspacePlans(),
      getAddons(),
      validateWorkspacePlanBinding(session.user.id, "free"),
      enforceUserPlanLimit(session.user.id, "workspaces"),
    ])
    freePlanUnavailableReason = freeBinding.allowed ? null : freeBinding.message

    workspacePlans = wPlans.map(p => ({
      id: p.slug,
      plan_slug: p.slug || "free",
      name: p.name || "Workspace Plan",
      desc: p.description || "",
      priceAmount: p.price,
      yearlyPrice: p.yearlyPrice,
      max_content_types: p.maxContentTypes,
      max_content_entries: p.maxContentEntries,
      max_storage: p.maxStorageMb,
      max_team_members: p.maxTeamMembers,
      max_locales: p.maxLocales,
      max_api_calls: p.maxApiCalls,
      features: Array.isArray(p.features) ? p.features.filter(value => typeof value === "string") : []
    })).sort((a, b) => (a.priceAmount || 0) - (b.priceAmount || 0))

    addonPlans = aPlans.map(a => ({
      id: a.slug,
      name: a.name || "Add-on",
      desc: a.description || "",
      priceLabel: a.priceLabel || "",
      priceAmount: a.price ?? 0,
      yearlyPrice: a.yearlyPrice,
      isTopup: a.isTopup,
      icon: a.icon || "Sparkles"
    }))

    // Check user plan limits using centralized enforcement (handles enterprise/admin bypasses)
    usage = {
      current: total, // Every workspace this account has, not just this page
      max: limitResult.max,
      allowed: limitResult.max === null || limitResult.max > 9000 || total < limitResult.max,
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
      summary={summary}
      pagination={{ page, pageCount, total, pageSize: PAGE_SIZE, q }}
      usage={usage}
      dbTemplates={dbTemplates}
      workspacePlans={workspacePlans}
      addonPlans={addonPlans}
      freePlanUnavailableReason={freePlanUnavailableReason}
      isSuperAdmin={isSuperAdmin}
      isAccountEnterpriseLicensed={isGlobalEnterprise}
    />
  )
}
