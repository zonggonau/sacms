import { NextResponse } from "next/server"
import { v0 } from "v0"
import { db } from "@/lib/database"
import { deployToVercel } from "@/lib/vercel-client"
import { getV0Preview } from "@/lib/v0-client"
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

    let previewUrl = ""
    let vercelProjectId = ""

    if (deployToVercelAfter && files.length > 0) {
      try {
        const projectName = `sacms-${tenant.slug}-frontend`
        const deployment = await deployToVercel(projectName, files)
        previewUrl = deployment.url || ""
        vercelProjectId = deployment.projectId || ""
        if (vercelProjectId) {
          await db.setting.upsert({ where: { key: `${tenant.id}_vercelProjectId` }, update: { value: vercelProjectId }, create: { tenantId: tenant.id, key: `${tenant.id}_vercelProjectId`, value: vercelProjectId } })
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
        const filePath = vf.name.startsWith("app/") || vf.name.startsWith("components/") || vf.name.startsWith("lib/") ? vf.name : `app/${vf.name}`
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
