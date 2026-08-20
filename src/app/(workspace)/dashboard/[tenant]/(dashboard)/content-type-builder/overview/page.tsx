import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { WebsiteBuilderClient } from "./website-builder-client"

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

  // Determine if the user has an upgraded plan to access advanced AI models
  const hasUpgradedPlan = tenant.plan === "pro" || tenant.plan === "ai_max" || tenant.plan === "custom" || tenant.plan === "enterprise"

  // Check if tenant has any published schemas
  const tenantDb = await getTenantDb(tenant.id)
  const ctCount = await tenantDb.contentType.count({ where: { tenantId: tenant.id } })
  const stCount = await tenantDb.singleType.count({ where: { tenantId: tenant.id } })
  const hasSchema = ctCount > 0 || stCount > 0

  // Check user AI credit balance
  const { enforceUserAiCredits } = await import("@/lib/plan-enforcement")
  const creditStatus = await enforceUserAiCredits(session.user.id, 0)
  const initialAiCredits = {
    remaining: creditStatus.remaining,
    total: creditStatus.max,
    isUnlimited: creditStatus.max >= 900000
  }

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col p-4 md:p-6 lg:p-8">
      <WebsiteBuilderClient 
        tenantId={tenant.id}
        tenantSlug={tenantSlug}
        hasUpgradedPlan={hasUpgradedPlan}
        hasSchema={hasSchema}
        initialAiCredits={initialAiCredits}
        initialProject={v0ChatId ? {
          v0ChatId,
          previewUrl,
          frontendPrompt,
          status: projectStatus,
          model: savedModel,
        } : null}
      />
    </div>
  )
}
