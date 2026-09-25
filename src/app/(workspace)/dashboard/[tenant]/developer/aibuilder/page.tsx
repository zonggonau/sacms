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

  // Hydrate files and full chat history from the last-generated site in database
  let initialMessages: any[] = []
  let initialFiles: { name: string; content: string }[] | null = null

  if (v0ChatId) {
    try {
      const site = await db.site.findFirst({
        where: { tenantId: tenant.id },
        orderBy: { updatedAt: "desc" },
        include: {
          files: { orderBy: { path: "asc" } },
          conversations: {
            include: {
              messages: { orderBy: { createdAt: "asc" } },
            },
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
        },
      })
      if (site) {
        if (site.files.length > 0) {
          initialFiles = site.files.map((f) => ({ name: f.path, content: f.content }))
        }
        const activeConv = site.conversations[0]
        if (activeConv && activeConv.messages.length > 0) {
          initialMessages = activeConv.messages.map((m) => {
            const files = Array.isArray(m.toolCalls) ? (m.toolCalls as any[]) : []
            return {
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              createdAt: m.createdAt,
              parts: [
                ...(m.thought ? [{ type: "reasoning", text: m.thought }] : []),
                { type: "text", text: m.content },
              ],
              artifact:
                files.length > 0
                  ? {
                      title: "Proyek Next.js 16 App Router",
                      files: files.map((f: any) => ({ name: f.name, description: f.description })),
                    }
                  : undefined,
            }
          })
        }
      }
    } catch {
      // Non-critical — the client falls back to its built-in demo files.
    }
  }

  // Fallback: If no siteMessages were stored yet but frontendPrompt exists, hydrate it nicely
  if (initialMessages.length === 0 && frontendPrompt) {
    initialMessages = [
      {
        id: "msg-initial-user",
        role: "user",
        content: frontendPrompt,
        createdAt: new Date(),
      },
      {
        id: "msg-initial-assistant",
        role: "assistant",
        content: "Website Next.js 16 App Router telah berhasil dibuat berdasarkan prompt Anda dan terhubung ke SaCMS Headless CMS.",
        createdAt: new Date(),
        artifact:
          initialFiles && initialFiles.length > 0
            ? {
                title: "Proyek Next.js 16 App Router",
                files: initialFiles.map((f) => ({ name: f.name })),
              }
            : undefined,
      },
    ]
  }

  // Check user AI credit balance
  const { enforceUserAiCredits } = await import("@/lib/plan-enforcement")
  const creditStatus = await enforceUserAiCredits(session.user.id, 0)
  const initialAiCredits = {
    remaining: creditStatus.remaining,
    total: creditStatus.max,
    isUnlimited: creditStatus.max >= 900000,
  }

  const currentUser = {
    name: session.user.name || "Anda",
    email: session.user.email || "",
    image: session.user.image || null,
  }

  const hasUpgradedPlan = tenant.plan !== "FREE" || session.user.role === "admin"

  return (
    <div className="flex h-screen max-h-screen flex-col p-3 md:p-4 overflow-hidden w-full max-w-full">
      <WebsiteBuilderClient
        tenantId={tenant.id}
        tenantSlug={tenantSlug}
        hasUpgradedPlan={hasUpgradedPlan}
        initialAiCredits={initialAiCredits}
        currentUser={currentUser}
        initialProject={
          v0ChatId
            ? {
                v0ChatId,
                previewUrl,
                frontendPrompt,
                status: projectStatus,
                model: savedModel,
                files: initialFiles,
                messages: initialMessages,
              }
            : null
        }
      />
    </div>
  )
}
