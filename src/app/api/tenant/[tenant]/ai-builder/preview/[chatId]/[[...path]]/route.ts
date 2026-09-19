import { db } from "@/lib/database"
import { v0, fetchPreview, type ChatsGetPreviewResponse } from "v0"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { chatBelongsToTenant } from "@/lib/ai/chat-access"
import { ensureV0PreviewHostsTrusted } from "@/lib/v0-client"
import type { NextRequest } from "next/server"

// ────────────────────────────────────────────────────────────────────────────
// In-memory preview cache — per v0 docs, the preview token is valid until
// `expiresAt`, so we cache it to avoid calling `chats.getPreview()` on every
// sub-resource request (CSS, JS, images). Without this, a single page load
// fires dozens of redundant API calls and risks v0 rate limits.
// ────────────────────────────────────────────────────────────────────────────
type PreviewData = NonNullable<ChatsGetPreviewResponse>
const previewCache = new Map<string, PreviewData>()

async function getCachedPreview(chatId: string): Promise<PreviewData | null> {
  const cached = previewCache.get(chatId)
  const now = Date.now()
  // Keep a 60s buffer before expiry to avoid using a token that's about to die
  if (cached && new Date(cached.expiresAt).getTime() - now > 60_000) {
    return cached
  }

  try {
    const response = await v0.chats.getPreview({ chatId })
    const preview = (response as any)?.data || response
    if (preview?.url && preview?.token) {
      previewCache.set(chatId, preview)
      return preview
    }
  } catch {
    // fall through — return null so caller can show loading/retry
  }

  previewCache.delete(chatId)
  return null
}

function invalidatePreviewCache(chatId: string) {
  previewCache.delete(chatId)
}

// ────────────────────────────────────────────────────────────────────────────
// Catch-all preview proxy — handles the initial document AND every sub-
// resource (CSS, JS, images, fonts, API calls) from the v0 preview sandbox.
// ────────────────────────────────────────────────────────────────────────────

async function handler(request: Request, context: any, { access }: any) {
  const resolvedParams = await context.params
  const { tenant: tenantSlug, chatId } = resolvedParams
  const path: string[] = Array.isArray((resolvedParams as any).path) ? (resolvedParams as any).path : []

  // ── Local fallback builds (sacms_gen_* / sacms_claude_*) ──
  if (chatId.startsWith("sacms_gen_") || chatId.startsWith("sacms_claude_")) {
    let hasGeneratedCode = false
    try {
      const site = await db.site.findFirst({
        where: { tenantId: access.tenantId },
        include: { files: true },
        orderBy: { updatedAt: "desc" },
      })
      const pageFile = site?.files?.find((f) => f.path.includes("page.tsx") || f.path.includes("page.jsx"))
      hasGeneratedCode = Boolean(pageFile?.content)
    } catch {}

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${access.tenant.name} — Preview Tidak Tersedia</title>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #0a0a0c; color: #e4e4e7; }
    .box { max-width: 440px; text-align: center; padding: 32px; }
    .badge { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
      color: #f0975a; background: rgba(240,151,90,.12); border: 1px solid rgba(240,151,90,.3); border-radius: 999px; padding: 4px 12px; margin-bottom: 16px; }
    h1 { font-size: 18px; font-weight: 800; margin: 0 0 8px; }
    p { font-size: 13px; line-height: 1.6; color: #a1a1aa; margin: 0; }
  </style>
</head>
<body>
  <div class="box">
    <span class="badge">Preview Sandbox Tidak Tersedia</span>
    <h1>Live preview untuk build ini belum bisa ditampilkan</h1>
    <p>
      ${hasGeneratedCode
        ? "Kode website sudah berhasil dibuat dan tersimpan — buka tab <strong>Code</strong> untuk melihatnya, atau unduh <strong>ZIP starter</strong> untuk menjalankannya secara lokal."
        : "Generasi AI untuk build ini belum menghasilkan file yang bisa ditampilkan. Coba generate ulang."}
    </p>
  </div>
</body>
</html>`

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  }

  // ── Real v0 chatId — must belong to this tenant ──
  if (!(await chatBelongsToTenant(chatId, access.tenantId))) {
    return new Response("Not found", { status: 404 })
  }

  await ensureV0PreviewHostsTrusted()

  // ── Get (cached) preview details from v0 ──
  const previewData = await getCachedPreview(chatId)

  if (!previewData) {
    const MAX_ATTEMPTS = 40 // ~2min at 3s intervals
    const attempt = Number(new URL(request.url).searchParams.get("_attempt") || "0")

    if (attempt >= MAX_ATTEMPTS) {
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; color: #a1a1aa; text-align: center; padding: 24px; }
              h3 { margin: 0 0 6px; font-size: 14px; font-weight: 700; color: #f4f4f5; }
              p { margin: 0; font-size: 12px; max-width: 320px; }
            </style>
          </head>
          <body>
            <h3>Preview Tidak Bisa Dimuat</h3>
            <p>Sandbox tidak merespons setelah beberapa kali percobaan. Coba generate ulang atau hubungi dukungan jika masalah berlanjut.</p>
          </body>
        </html>
      `, { status: 504, headers: { "Content-Type": "text/html; charset=utf-8" } })
    }

    const secondsWaited = attempt * 3
    const statusLine = secondsWaited < 20
      ? "Sandbox sedang memuat berkas Next.js Anda..."
      : secondsWaited < 60
      ? "AI masih menyusun komponen &amp; halaman — build kompleks bisa memakan waktu 1-2 menit."
      : "Hampir selesai — v0 sedang menyelesaikan build terakhir, mohon tunggu sebentar lagi."

    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta http-equiv="refresh" content="3;url=/api/tenant/${tenantSlug}/ai-builder/preview/${chatId}?_attempt=${attempt + 1}">
          <style>
            body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; color: #a1a1aa; }
            .spinner { width: 36px; height: 36px; border: 3px solid #27272a; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px; }
            @keyframes spin { to { transform: rotate(360deg); } }
            h3 { margin: 0 0 6px; font-size: 14px; font-weight: 700; color: #f4f4f5; }
            p { margin: 0; font-size: 12px; max-width: 320px; text-align: center; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="spinner"></div>
          <h3>Website Sedang Dibangun oleh AI...</h3>
          <p>${statusLine}</p>
        </body>
      </html>
    `, { headers: { "Content-Type": "text/html; charset=utf-8" } })
  }

  // ── Proxy the request through v0's fetchPreview ──
  const proxyBase = `/api/tenant/${tenantSlug}/ai-builder/preview/${chatId}`
  const fallbackUrl = new URL(`${proxyBase}/loading`, request.url)

  const response = await fetchPreview({
    request,
    preview: previewData,
    path,
    fallbackUrl,
    onPreviewRefresh: () => {
      invalidatePreviewCache(chatId)
    },
  })

  // For HTML responses, rewrite root-relative URLs so assets and scripts
  // route cleanly through this proxy instead of hitting the parent host's 404 handler.
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("text/html")) {
    let html = await response.text()
    const newHeaders = new Headers(response.headers)
    newHeaders.delete("content-length")
    newHeaders.delete("content-security-policy")
    newHeaders.delete("x-frame-options")
    newHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin")

    // 1. Rewrite Next.js static asset and chunk bundles
    html = html.replaceAll('"/_next/', `"${proxyBase}/_next/`)
    html = html.replaceAll("'/_next/", `'${proxyBase}/_next/`)

    // 2. Rewrite v0 runtime scripts
    html = html.replaceAll('"/v0-runtime-dist.js"', `"${proxyBase}/v0-runtime-dist.js"`)
    html = html.replaceAll("'/v0-runtime-dist.js'", `'${proxyBase}/v0-runtime-dist.js'`)

    // 3. Rewrite favicon and icons
    html = html.replaceAll('href="/icon', `href="${proxyBase}/icon`)
    html = html.replaceAll('href="/apple-icon', `href="${proxyBase}/apple-icon`)

    // 4. Rewrite general root-relative attributes (src="/...", href="/...", action="/...")
    // Avoid double rewriting paths that already start with proxyBase or /api/tenant/
    html = html.replace(/(src|href|action)="\/((?!api\/tenant\/)[^"\/][^"]*)"/g, `$1="${proxyBase}/$2"`)

    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    })
  }

  return response
}

async function authWrapper(request: NextRequest, context: any) {
  const resolvedParams = await context.params
  const { tenant: tenantSlug, chatId } = resolvedParams
  const path: string[] = Array.isArray((resolvedParams as any).path) ? (resolvedParams as any).path : []

  // Check authenticated staff session
  const session = await getServerSession(authOptions)
  let access: any = null
  if (session?.user) {
    access = await getTenantAccess(session, tenantSlug)
  }

  // If subresource (path.length > 0) without session (e.g. web fonts, CORS anonymous requests),
  // verify that chatId actually belongs to this tenant in the database.
  if (!access && path.length > 0) {
    const tenant = await db.tenant.findFirst({
      where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] },
      select: { id: true, name: true, slug: true },
    })
    if (tenant && (await chatBelongsToTenant(chatId, tenant.id))) {
      access = { tenantId: tenant.id, tenant }
    }
  }

  if (!access) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  return handler(request, context, { access })
}

export const GET = authWrapper
export const POST = authWrapper
