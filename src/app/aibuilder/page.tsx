import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getGlobalWorkspaceId } from "@/lib/settings"
import { WorkspaceOption } from "@/components/ai-builder/v0-top-navbar"
import { AiBuilderShell } from "@/components/ai-builder/aibuilder-shell"
import { AiProjectItem } from "@/components/ai-builder/aibuilder-sidebar"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "AI Website Builder | SaCMS v0 Studio",
  description: "Rancang dan bangun website Next.js full-stack bertenaga AI dengan database PostgreSQL 17 terisolasi secara otomatis.",
}

interface PageProps {
  searchParams: Promise<{
    workspace?: string
    prompt?: string
  }>
}

export default async function AiBuilderModePage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect("/auth/login?redirect_to=/aibuilder")
  }

  // The session's JWT is never re-checked against the DB after login — if
  // this user's row was deleted (or a local dev DB got reset while a
  // browser still held an old signed cookie), session.user.id stops
  // pointing at a real row. Every query below that uses it as a foreign
  // key — most importantly Tenant.ownerId when auto-provisioning a
  // workspace further down — would otherwise crash with a raw
  // `tenants_ownerId_fkey` violation instead of asking for a fresh sign-in.
  const currentUserExists = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true } })
  if (!currentUserExists) {
    redirect(`/api/auth/force-relogin?redirect_to=${encodeURIComponent("/aibuilder")}`)
  }

  const { workspace: requestedWorkspace, prompt: initialPromptParam } = await searchParams
  const isSuperAdmin = session.user.role === "super_admin"

  const globalId = await getGlobalWorkspaceId()
  const SYSTEM_SLUGS = [globalId, "sacms-global", "sacms"]

  const whereClause: any = {
    slug: { notIn: SYSTEM_SLUGS },
    id: { not: globalId },
  }

  if (!isSuperAdmin) {
    whereClause.members = { some: { userId: session.user.id } }
  }

  let tenants = await db.tenant.findMany({
    where: whereClause,
    include: {
      members: {
        where: { userId: session.user.id },
        select: { role: true },
      },
      subscriptions: {
        orderBy: { currentPeriodEnd: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  })

  // If user has no workspace yet, auto-create a starter workspace
  if (tenants.length === 0) {
    const rawName = session.user.name || "Workspace"
    const safeSlug =
      (rawName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-") || "app") +
      "-" +
      Math.random().toString(36).substring(2, 6)
    
    const isUserBiasa = session.user.role === "user"
    // The registering user is always the real owner of their own workspace —
    // "user biasa" included. This used to hand ownership to a super_admin
    // service account instead (a leftover of the since-cancelled plan to
    // treat regular users like the separate nocode product's synthetic,
    // account-less users); that's not this app's model — every /aibuilder
    // user logs in with a real SaCMS account and should own what they build.
    const ownerId = session.user.id

    const membersToCreate: any[] = [
      {
        userId: session.user.id,
        role: "owner",
      },
    ]

    // Still give platform support visibility into a fresh "user biasa"
    // workspace, just not ownership of it.
    if (isUserBiasa) {
      const superAdminUser = await db.user.findFirst({
        where: { role: "super_admin" },
        orderBy: { createdAt: "asc" },
      })
      if (superAdminUser && superAdminUser.id !== session.user.id) {
        membersToCreate.push({
          userId: superAdminUser.id,
          role: "admin",
        })
      }
    }

    const newTenant = await db.tenant.create({
      data: {
        name: `${rawName} Studio`,
        slug: safeSlug,
        plan: "free",
        status: "active",
        ownerId,
        members: {
          create: membersToCreate,
        },
      },
      include: {
        members: {
          where: { userId: session.user.id },
          select: { role: true },
        },
        subscriptions: true,
      },
    })
    tenants = [newTenant as any]
  }

  // Resolve target workspace
  let activeTenant = tenants[0]
  if (requestedWorkspace) {
    const matched = tenants.find(
      (t) => t.slug === requestedWorkspace || t.id === requestedWorkspace
    )
    if (matched) {
      activeTenant = matched
    }
  }

  const tenantSlug = activeTenant.slug || activeTenant.id

  // Fetch project details for all workspaces in a single batch
  const allTenantIds = tenants.map((t) => t.id)
  const allSettings = await db.setting.findMany({
    where: {
      tenantId: { in: allTenantIds },
    },
  })

  const isRealHostedPreviewUrl = (url: string | null) =>
    Boolean(url && (url.includes(".vercel.app") || url.includes(".v0.build")))

  // Construct comprehensive list of all projects
  const allProjects: AiProjectItem[] = tenants.map((t) => {
    const tSettings = allSettings.filter((s) => s.tenantId === t.id)
    const chat = tSettings.find((s) => s.key === `${t.id}_v0ChatId`)?.value || null
    let prev = tSettings.find((s) => s.key === `${t.id}_v0PreviewUrl`)?.value || null
    if (chat && !prev?.startsWith("/") && !isRealHostedPreviewUrl(prev)) {
      prev = `/api/tenant/${t.slug || t.id}/ai-builder/preview/${chat}`
    }
    const prompt = tSettings.find((s) => s.key === `${t.id}_v0FrontendPrompt`)?.value || t.description || null
    const rawSt = tSettings.find((s) => s.key === `${t.id}_v0Status`)?.value || null
    const status = rawSt === "project" || isRealHostedPreviewUrl(prev) ? "project" : "draft"
    const model = tSettings.find((s) => s.key === `${t.id}_v0Model`)?.value || "v0-pro"

    return {
      id: t.id,
      tenantId: t.id,
      name: t.name,
      slug: t.slug,
      plan: t.plan,
      status,
      prompt,
      previewUrl: prev,
      v0ChatId: chat,
      model,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }
  })

  // Settings for the active workspace
  const activeSettings = allSettings.filter((s) => s.tenantId === activeTenant.id)
  const v0ChatId = activeSettings.find((s) => s.key === `${activeTenant.id}_v0ChatId`)?.value || null
  let previewUrl = activeSettings.find((s) => s.key === `${activeTenant.id}_v0PreviewUrl`)?.value || null
  const savedFrontendPrompt =
    activeSettings.find((s) => s.key === `${activeTenant.id}_v0FrontendPrompt`)?.value || null
  const rawStatus = activeSettings.find((s) => s.key === `${activeTenant.id}_v0Status`)?.value || null
  const savedModel = activeSettings.find((s) => s.key === `${activeTenant.id}_v0Model`)?.value || "v0-pro"

  const projectStatus: "draft" | "project" =
    rawStatus === "project" || isRealHostedPreviewUrl(previewUrl) ? "project" : "draft"

  if (v0ChatId && !previewUrl?.startsWith("/") && !isRealHostedPreviewUrl(previewUrl)) {
    previewUrl = `/api/tenant/${tenantSlug}/ai-builder/preview/${v0ChatId}`
  }

  const hasUpgradedPlan =
    activeTenant.plan === "pro" ||
    activeTenant.plan === "ai_max" ||
    activeTenant.plan === "custom" ||
    activeTenant.plan === "enterprise"

  // Check if tenant has schema
  const tenantDb = await getTenantDb(activeTenant.id)
  const ctCount = await tenantDb.contentType.count({ where: { tenantId: activeTenant.id } })
  const stCount = await tenantDb.singleType.count({ where: { tenantId: activeTenant.id } })
  const hasSchema = ctCount > 0 || stCount > 0

  // Hydrate Code tab files
  let initialFiles: { name: string; content: string }[] | null = null
  if (v0ChatId) {
    try {
      const site = await db.site.findFirst({
        where: { tenantId: activeTenant.id },
        orderBy: { updatedAt: "desc" },
        include: { files: { orderBy: { path: "asc" } } },
      })
      if (site && site.files.length > 0) {
        initialFiles = site.files.map((f) => ({ name: f.path, content: f.content }))
      }
    } catch {
      // Fallback
    }
  }

  // Check user AI credit balance
  const { enforceUserAiCredits } = await import("@/lib/plan-enforcement")
  const creditStatus = await enforceUserAiCredits(session.user.id, 0)
  const initialAiCredits = {
    remaining: creditStatus.remaining,
    total: creditStatus.max,
    isUnlimited: creditStatus.max >= 900000,
  }

  const workspaceOptions: WorkspaceOption[] = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    plan: t.plan,
  }))

  const finalPrompt = initialPromptParam?.trim() || savedFrontendPrompt

  return (
    <AiBuilderShell
      workspaces={workspaceOptions}
      projects={allProjects}
      activeTenant={{
        id: activeTenant.id,
        name: activeTenant.name,
        slug: tenantSlug,
        plan: activeTenant.plan,
      }}
      credits={initialAiCredits}
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        role: session.user.role,
      }}
      studioProps={{
        tenantId: activeTenant.id,
        tenantSlug,
        hasUpgradedPlan,
        hasSchema,
        initialProject: v0ChatId
          ? {
              v0ChatId,
              previewUrl,
              frontendPrompt: finalPrompt,
              status: projectStatus,
              model: savedModel,
              files: initialFiles,
            }
          : finalPrompt
          ? {
              v0ChatId: null,
              previewUrl: null,
              frontendPrompt: finalPrompt,
              status: "draft",
              model: savedModel,
              files: null,
            }
          : null,
      }}
    />
  )
}
