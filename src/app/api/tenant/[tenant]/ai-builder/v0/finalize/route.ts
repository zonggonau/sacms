import { NextResponse } from "next/server"
import { v0 } from "v0"
import { db } from "@/lib/database"
import { deployToVercel } from "@/lib/vercel-client"
import { getV0Preview } from "@/lib/v0-client"
import { resolveFrontendEnv, renderDotEnv, pushEnvToVercelProject } from "@/lib/infrastructure/frontend-env"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { chatBelongsToTenant } from "@/lib/ai/chat-access"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * `useChat`'s `onFinish` fires as soon as the *text* stream ends — v0 keeps
 * writing the actual source files to the chat's sandbox for a few seconds
 * after that (the same lag the preview URL/iframe already have to poll
 * around, see `preview/[chatId]/route.ts`). Calling `getFiles` exactly once
 * right at onFinish routinely came back empty, silently leaving the Code
 * tab on its placeholder `DEMO_FILES` with no sign anything was wrong.
 * Poll a few times before giving up.
 */
async function getV0FilesWithRetry(chatId: string, attempts = 8, delayMs = 1500): Promise<{ name: string; content: string }[]> {
  for (let i = 0; i < attempts; i++) {
    try {
      const filesRes = await v0.chats.getFiles({ chatId })
      const rawFiles = (filesRes as any)?.data?.files || (filesRes as any)?.files || (filesRes as any)?.data || []
      if (Array.isArray(rawFiles) && rawFiles.length > 0) {
        return rawFiles.map((f: any) => ({ name: f.path ?? f.name ?? "app/page.tsx", content: f.content ?? "" }))
      }
    } catch (err: any) {
      console.warn(`[v0/finalize] getFiles attempt ${i + 1}/${attempts} failed:`, err?.message)
    }
    if (i < attempts - 1) await sleep(delayMs)
  }
  return []
}

/**
 * Called once a v0 stream finishes (`useChat`'s `onFinish`) for either a new
 * chat or a follow-up. The stream itself only carries message content — this
 * fetches the resulting files/preview, keeps Site/SiteFile in sync, and
 * optionally deploys to Vercel, the same side effects the old synchronous
 * `generate-frontend`/`iterate` routes did inline before returning.
 */
export const POST = withStaffAuth(
  async (req, _context, { access }) => {
    const body = await req.json().catch(() => ({}))
    const chatId = typeof body?.chatId === "string" ? body.chatId : ""
    const deployToVercelAfter = body?.deployToVercelAfter === true
    if (!chatId) return apiError("validation", { message: "Missing chatId" })

    if (!(await chatBelongsToTenant(chatId, access.tenantId))) {
      return apiError("not_found", { message: "Chat not found" })
    }

    const tenant = access.tenant

    const files = await getV0FilesWithRetry(chatId)

    // Same env set `/v0/chats/stream` told v0 to put in ".env.local" and
    // instructed the generated code to read via process.env — persisted
    // there so it survives across the create → (background) finalize
    // boundary. Older chats generated before this existed won't have it
    // saved; resolve it fresh rather than leaving the deploy unconfigured.
    let envVars: Record<string, string> = {}
    try {
      const saved = await db.setting.findUnique({ where: { key: `${tenant.id}_v0EnvVars` } })
      envVars = saved?.value ? JSON.parse(saved.value) : await resolveFrontendEnv(tenant.id, tenant.slug, `${req.nextUrl.origin}`)
    } catch (err: any) {
      console.warn("[v0/finalize] Could not resolve env vars:", err?.message)
    }

    if (Object.keys(envVars).length > 0 && files.length > 0) {
      const envFile = { name: ".env.local", content: renderDotEnv(envVars) }
      const idx = files.findIndex((f) => f.name === ".env.local" || f.name.endsWith("/.env.local"))
      if (idx >= 0) files[idx] = envFile
      else files.push(envFile)
    }

    let previewUrl = ""
    let vercelProjectId = ""

    if (deployToVercelAfter && files.length > 0) {
      try {
        const projectName = `sacms-${tenant.slug}-frontend`
        const deployment = await deployToVercel(projectName, files, envVars)
        previewUrl = deployment.url || ""
        vercelProjectId = deployment.projectId || ""
        if (vercelProjectId) {
          await db.setting.upsert({ where: { key: `${tenant.id}_vercelProjectId` }, update: { value: vercelProjectId }, create: { tenantId: tenant.id, key: `${tenant.id}_vercelProjectId`, value: vercelProjectId } })
          // Persist onto the Vercel project itself too, not just this one
          // deployment, so a redeploy triggered from Vercel's own dashboard
          // still has the SaCMS connection vars.
          await pushEnvToVercelProject(vercelProjectId, envVars).catch((e) => console.warn("[v0/finalize] pushEnvToVercelProject failed:", e?.message))
        }
      } catch (deployError: any) {
        console.error("[v0/finalize] Vercel deploy failed:", deployError?.message)
      }
    }

    if (!previewUrl) {
      try {
        const hostedUrl = await getV0Preview(chatId)
        previewUrl = hostedUrl || `/api/tenant/${tenant.slug}/ai-builder/preview/${chatId}`
      } catch {
        previewUrl = `/api/tenant/${tenant.slug}/ai-builder/preview/${chatId}`
      }
    }

    await db.setting.upsert({ where: { key: `${tenant.id}_v0PreviewUrl` }, update: { value: previewUrl }, create: { tenantId: tenant.id, key: `${tenant.id}_v0PreviewUrl`, value: previewUrl } })

    // Keep Site/SiteFile in sync, same as the old synchronous routes.
    try {
      let site = await db.site.findFirst({ where: { tenantId: tenant.id }, orderBy: { updatedAt: "desc" } })
      if (!site) {
        site = await db.site.create({
          data: {
            tenantId: tenant.id,
            name: `${tenant.name} Website`,
            slug: `${tenant.slug}-web`,
            subdomain: `${tenant.slug}-web`,
            status: "published",
          },
        })
      }
      for (const vf of files) {
        const isRootFile = vf.name.startsWith("app/") || vf.name.startsWith("components/") || vf.name.startsWith("lib/") || vf.name.startsWith(".env")
        const filePath = isRootFile ? vf.name : `app/${vf.name}`
        await db.siteFile.upsert({
          where: { siteId_path: { siteId: site.id, path: filePath } },
          create: { siteId: site.id, path: filePath, content: vf.content },
          update: { content: vf.content },
        })
      }
    } catch (siteErr: any) {
      console.warn("[v0/finalize] Could not sync Site record:", siteErr?.message)
    }

    return NextResponse.json({
      success: true,
      previewUrl,
      vercelProjectId,
      files,
      filesGenerated: files.length,
      // v0 hadn't finished writing files even after retrying — the client
      // should say so honestly instead of silently keeping stale/demo files
      // in the Code tab with no indication anything's still in progress.
      stillGenerating: files.length === 0,
    })
  },
  { minRole: "admin" },
)
