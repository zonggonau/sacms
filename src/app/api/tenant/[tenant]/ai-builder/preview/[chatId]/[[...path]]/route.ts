import { db } from "@/lib/database"
import { v0, fetchPreview } from "v0"
import { withStaffAuth } from "@/lib/api/route-helpers"
import { chatBelongsToTenant } from "@/lib/ai/chat-access"

export const GET = withStaffAuth(async (request, context, { access }) => {
    const resolvedParams = await context.params
    const { tenant: tenantSlug, chatId } = resolvedParams
    const path: string[] = Array.isArray((resolvedParams as any).path) ? (resolvedParams as any).path : []

    // If it's a locally generated site (starts with sacms_gen_)
    if (chatId.startsWith("sacms_gen_")) {
      let hasGeneratedCode = false
      try {
        const site = await (db as any).site?.findFirst({
          where: { tenantId: access.tenantId },
          include: { siteFiles: true },
          orderBy: { updatedAt: "desc" },
        })
        const pageFile = site?.siteFiles?.find((f: any) => f.path.includes("page.tsx") || f.path.includes("page.jsx"))
        hasGeneratedCode = Boolean(pageFile?.content)
      } catch {}

      // This chat id is a local fallback (the v0 API call failed or timed out
      // — see generateFallbackFiles in lib/v0-client.ts), not a real v0
      // preview. The generated .tsx source is on SiteFile, but it's React/JSX
      // and can't be rendered by dropping it into static HTML — it needs a
      // real build step. Rather than fake a preview with unrelated generic
      // marketing content (as this route used to), say plainly that a live
      // preview isn't available and point at the two things that DO show the
      // real generated code: the Code tab and the starter ZIP.
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

    // A real v0 chatId must belong to this tenant.
    if (!(await chatBelongsToTenant(chatId, access.tenantId))) {
      return new Response("Not found", { status: 404 })
    }

    // Try fetching from v0
    let result: any = null
    try {
      result = await v0.chats.getPreview({ chatId })
    } catch {
      result = null
    }

    const previewData = (result as any)?.data || result

    if (!previewData || !previewData.url || !previewData.token) {
      // Cap retries — without this the meta-refresh spins forever if the
      // underlying v0 chat is permanently broken, with no error ever shown.
      const MAX_ATTEMPTS = 20 // ~60s at 3s intervals
      const attempt = Number(request.nextUrl.searchParams.get("_attempt") || "0")

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
              p { margin: 0; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="spinner"></div>
            <h3>Mengompilasi Frontend Website...</h3>
            <p>Sandbox sedang memuat berkas Next.js Anda...</p>
          </body>
        </html>
      `, { headers: { "Content-Type": "text/html; charset=utf-8" } })
    }

    // Proxy the request securely
    const response = await fetchPreview({
      request,
      preview: previewData,
      path,
      fallbackUrl: `/api/tenant/${tenantSlug}/ai-builder/preview/${chatId}/loading`,
    })

    const contentType = response.headers.get("content-type") || ""
    if (contentType.includes("text/html")) {
      let html = await response.text()
      const proxyBase = `/api/tenant/${tenantSlug}/ai-builder/preview/${chatId}`

      html = html.replace(/(src|href|action)="\/([^\/"][^"]*)?"/g, (match, attr, pathStr) => {
        return `${attr}="${proxyBase}/${pathStr || ""}"`
      })

      const newHeaders = new Headers(response.headers)
      newHeaders.delete("content-length")
      newHeaders.delete("content-security-policy")

      return new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      })
    }

    return response
})
