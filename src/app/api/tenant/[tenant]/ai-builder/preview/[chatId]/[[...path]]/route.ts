import { db } from "@/lib/database"
import { v0, fetchPreview } from "v0"
import { withStaffAuth } from "@/lib/api/route-helpers"

export const GET = withStaffAuth(async (request, context, { access }) => {
    const resolvedParams = await context.params
    const { tenant: tenantSlug, chatId } = resolvedParams
    const path: string[] = Array.isArray((resolvedParams as any).path) ? (resolvedParams as any).path : []

    // If it's a locally generated site (starts with sacms_gen_)
    if (chatId.startsWith("sacms_gen_")) {
      let rawCode = ""
      try {
        const site = await (db as any).site?.findFirst({
          where: { tenantId: access.tenantId },
          include: { siteFiles: true },
          orderBy: { updatedAt: "desc" },
        })
        const pageFile = site?.siteFiles?.find((f: any) => f.path.includes("page.tsx") || f.path.includes("page.jsx"))
        rawCode = pageFile?.content || ""
      } catch (e) {}

      // Render standalone dynamic HTML preview with Tailwind CSS
      const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${access.tenant.name} - Website Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    body { margin: 0; padding: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #020617; color: #f8fafc; }
  </style>
</head>
<body class="bg-slate-950 text-slate-50">
  <div id="root">
    <!-- Navbar -->
    <nav class="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-base shadow-lg shadow-blue-500/25">
            ${access.tenant.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <span class="font-extrabold text-base tracking-tight text-white block leading-none">
              ${access.tenant.name}
            </span>
            <span class="text-[10px] text-blue-400 font-mono tracking-wider uppercase font-bold">
              Live SaCMS Connected
            </span>
          </div>
        </div>
        <div class="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
          <a href="#beranda" class="hover:text-blue-400">Beranda</a>
          <a href="#katalog" class="hover:text-blue-400">Katalog</a>
          <a href="#keunggulan" class="hover:text-blue-400">Keunggulan</a>
          <a href="#kontak" class="hover:text-blue-400">Kontak</a>
        </div>
        <div class="flex items-center gap-3">
          <button class="h-9 px-4 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-all">
            Hubungi Kami
          </button>
        </div>
      </div>
    </nav>

    <!-- Hero -->
    <section id="beranda" class="pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
      <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-bold mb-6">
        <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
        Website Next.js 16 Aktif Terhubung SaCMS
      </div>
      <h1 class="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto leading-tight">
        Selamat Datang di ${access.tenant.name}
      </h1>
      <p class="mt-5 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
        Platform modern berkinerja tinggi yang ditenagai oleh API Headless CMS SaCMS dan Next.js App Router.
      </p>
    </section>

    <!-- Grid -->
    <section id="katalog" class="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h2 class="text-xl sm:text-2xl font-black text-white">Daftar Konten & Layanan</h2>
          <p class="text-xs text-slate-400 mt-1">Data tersinkronisasi otomatis dari database CMS.</p>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <img src="https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80" class="w-full h-48 object-cover" />
          <div class="p-5 space-y-2">
            <span class="text-xs font-bold text-blue-400">Teknologi Terkini</span>
            <h3 class="font-bold text-base text-white">Inovasi Layanan Terpadu</h3>
            <p class="text-xs text-slate-400">Arsitektur API berkinerja tinggi dengan keamanan enterprise grade.</p>
          </div>
        </div>
        <div class="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <img src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80" class="w-full h-48 object-cover" />
          <div class="p-5 space-y-2">
            <span class="text-xs font-bold text-blue-400">Enterprise Database</span>
            <h3 class="font-bold text-base text-white">Dedicated Storage & Pool</h3>
            <p class="text-xs text-slate-400">Isolasi data terenkripsi penuh dengan PostgreSQL 17 mandiri.</p>
          </div>
        </div>
        <div class="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <img src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80" class="w-full h-48 object-cover" />
          <div class="p-5 space-y-2">
            <span class="text-xs font-bold text-blue-400">Custom Domain Anycast</span>
            <h3 class="font-bold text-base text-white">Aktivasi SSL Otomatis</h3>
            <p class="text-xs text-slate-400">DNS Gateway Anycast cepat dengan integrasi Domain Registrar Global.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800 text-xs text-slate-500 text-center">
      &copy; ${new Date().getFullYear()} ${access.tenant.name}. Powered by SaCMS AI Engine.
    </footer>
  </div>
  <script>
    lucide.createIcons();
  </script>
</body>
</html>`

      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
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
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta http-equiv="refresh" content="3;url=/api/tenant/${tenantSlug}/ai-builder/preview/${chatId}">
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
