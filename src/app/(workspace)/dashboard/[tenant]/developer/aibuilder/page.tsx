import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { WebsiteBuilderClient } from "./website-builder-client"
import { v0 } from "v0"
import { toV0UIMessages } from "@v0-sdk/react"

export default async function WebsiteBuilderPage({ params }: { params: Promise<{ tenant: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant: tenantSlug } = await params

  const access = await getTenantAccess(session, tenantSlug)
  if (!access) redirect("/dashboard")

  const tenant = access.tenant

  // Fetch project details from settings
  const settings = await db.setting.findMany({
    where: {
      tenantId: tenant.id,
      key: { in: [`${tenant.id}_v0ChatId`, `${tenant.id}_v0PreviewUrl`, `${tenant.id}_v0FrontendPrompt`, `${tenant.id}_v0Status`, `${tenant.id}_v0Model`] }
    }
  })

  const v0ChatId = settings.find(s => s.key === `${tenant.id}_v0ChatId`)?.value || null
  let previewUrl = settings.find(s => s.key === `${tenant.id}_v0PreviewUrl`)?.value || null
  const frontendPrompt = settings.find(s => s.key === `${tenant.id}_v0FrontendPrompt`)?.value || null
  const rawStatus = settings.find(s => s.key === `${tenant.id}_v0Status`)?.value || null
  const savedModel = settings.find(s => s.key === `${tenant.id}_v0Model`)?.value || "v0-pro"
  const projectStatus: "draft" | "project" = rawStatus === "project" || (previewUrl?.includes("vercel.app") ?? false) ? "project" : "draft"

  // Overwrite legacy URLs or missing URLs with our local proxy route
  if (v0ChatId && (!previewUrl || (!previewUrl.startsWith('/') && !previewUrl.includes('vercel.app')))) {
    previewUrl = `/api/tenant/${tenantSlug}/ai-builder/preview/${v0ChatId}`
  }

  // Fetch existing chat messages so the full conversation history is restored
  let initialV0Messages: any[] = []
  if (v0ChatId && !v0ChatId.startsWith("sacms_claude_") && !v0ChatId.startsWith("sacms_gen_")) {
    try {
      const msgsRes = await v0.messages.list({ chatId: v0ChatId, limit: 50 })
      if (msgsRes?.data?.messages && Array.isArray(msgsRes.data.messages)) {
        initialV0Messages = toV0UIMessages(msgsRes.data.messages)
      }
    } catch (e: any) {
      console.warn("[WebsiteBuilderPage] Could not fetch v0 chat messages:", e?.message)
    }
  }

  // Determine if the user has an upgraded plan to access advanced AI models
  const hasUpgradedPlan = tenant.plan === "pro" || tenant.plan === "ai_max" || tenant.plan === "custom" || tenant.plan === "enterprise"

  // Check if tenant has any published schemas with fallback
  let ctCount = 0
  let stCount = 0
  let hasSchema = false
  let existingContentTypes: any[] = []
  let existingSingleTypes: any[] = []

  try {
    const tenantDb = await getTenantDb(tenant.id)
    ctCount = await tenantDb.contentType.count({ where: { tenantId: tenant.id } }).catch(() => 0)
    stCount = await tenantDb.singleType.count({ where: { tenantId: tenant.id } }).catch(() => 0)
    hasSchema = ctCount > 0 || stCount > 0

    // Lightweight existing-schema summary (names + field counts) for the Schema step.
    const [cts, sts] = hasSchema
      ? await Promise.all([
          tenantDb.contentType.findMany({
            where: { tenantId: tenant.id },
            select: { name: true, slug: true, _count: { select: { schemaFields: true } } },
            orderBy: { updatedAt: "desc" },
          }).catch(() => []),
          tenantDb.singleType.findMany({
            where: { tenantId: tenant.id },
            select: { name: true, slug: true, _count: { select: { schemaFields: true } } },
            orderBy: { updatedAt: "desc" },
          }).catch(() => []),
        ])
      : [[], []]
    existingContentTypes = cts
    existingSingleTypes = sts
  } catch (err) {
    console.warn("[AI Builder] Failed to load schema from tenantDb, falling back to master db:", err)
    ctCount = await db.contentType.count({ where: { tenantId: tenant.id } }).catch(() => 0)
    stCount = await db.singleType.count({ where: { tenantId: tenant.id } }).catch(() => 0)
    hasSchema = ctCount > 0 || stCount > 0
    if (hasSchema) {
      const [cts, sts] = await Promise.all([
        db.contentType.findMany({
          where: { tenantId: tenant.id },
          select: { name: true, slug: true, _count: { select: { schemaFields: true } } },
          orderBy: { updatedAt: "desc" },
        }).catch(() => []),
        db.singleType.findMany({
          where: { tenantId: tenant.id },
          select: { name: true, slug: true, _count: { select: { schemaFields: true } } },
          orderBy: { updatedAt: "desc" },
        }).catch(() => []),
      ])
      existingContentTypes = cts
      existingSingleTypes = sts
    }
  }

  const existingSchemaSummary = {
    contentTypes: existingContentTypes.map((ct: any) => ({ name: ct.name, slug: ct.slug, fieldCount: ct._count?.schemaFields ?? 0 })),
    singleTypes: existingSingleTypes.map((st: any) => ({ name: st.name, slug: st.slug, fieldCount: st._count?.schemaFields ?? 0 })),
  }

  // Hydrate the Code tab from the last-generated site's actual files, instead
  // of always falling back to the hardcoded demo files on every page load.
  let initialFiles: { name: string; content: string }[] | null = null
  if (v0ChatId) {
    try {
      const site = await db.site.findFirst({
        where: { tenantId: tenant.id },
        orderBy: { updatedAt: "desc" },
        include: { files: { orderBy: { path: "asc" } } },
      })
      if (site && site.files.length > 0) {
        initialFiles = site.files.map((f) => ({ name: f.path, content: f.content }))
      }
    } catch {
      // Non-critical — the client falls back to its built-in demo files.
    }
  }

  // Check user AI credit balance
  const { enforceUserAiCredits } = await import("@/lib/plan-enforcement")
  const creditStatus = await enforceUserAiCredits(session.user.id, 0)
  const initialAiCredits = {
    remaining: creditStatus.remaining,
    total: creditStatus.max,
    isUnlimited: creditStatus.max >= 900000
  }

  return (
    <div className="flex h-screen max-h-screen flex-col p-3 md:p-4 overflow-hidden w-full max-w-full">
      <WebsiteBuilderClient
        tenantId={tenant.id}
        tenantSlug={tenantSlug}
        hasUpgradedPlan={hasUpgradedPlan}
        hasSchema={hasSchema}
        existingSchemaSummary={existingSchemaSummary}
        initialFrontendPromptSeed={frontendPrompt}
        initialAiCredits={initialAiCredits}
        initialProject={v0ChatId ? {
          v0ChatId,
          previewUrl,
          frontendPrompt,
          status: projectStatus,
          model: savedModel,
          files: initialFiles,
          messages: initialV0Messages,
        } : null}
      />
    </div>
  )
}
