import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { v0, fetchPreview } from "v0"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string, chatId: string, path?: string[] }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new Response("Unauthorized", { status: 401 })

    const resolvedParams = await params
    const { tenant: tenantSlug, chatId, path = [] } = resolvedParams

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return new Response("Forbidden", { status: 403 })

    // Fetch the preview data using the chatId
    const result = await v0.chats.getPreview({ chatId })
    
    // v0 sdk returns { data: { url, token, expiresAt }, request, response }
    const previewData = (result as any)?.data || result

    if (!previewData || !previewData.url || !previewData.token) {
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta http-equiv="refresh" content="4;url=/api/tenant/${tenantSlug}/ai-builder/preview/${chatId}">
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
            <h3>Mengompilasi Frontend v0.dev...</h3>
            <p>Sandbox sedang memuat berkas Next.js Anda...</p>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } })
    }

    if (path.length > 0 && path[0] === 'loading') {
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta http-equiv="refresh" content="3;url=/api/tenant/${tenantSlug}/ai-builder/preview/${chatId}">
            <style>
              body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: sans-serif; background: #fafafa; color: #666; }
              .spinner { width: 40px; height: 40px; border: 3px solid #e5e5e5; border-top-color: #000; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px; }
              @keyframes spin { to { transform: rotate(360deg); } }
            </style>
          </head>
          <body>
            <div class="spinner"></div>
            <p>Booting v0 Sandbox Environment...</p>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } })
    }

    // Proxy the request securely
    const response = await fetchPreview({
      request,
      preview: previewData,
      path,
      fallbackUrl: `/api/tenant/${tenantSlug}/ai-builder/preview/${chatId}/loading`,
    })

    // If the response is HTML, rewrite absolute paths (e.g., /chat-static, /_next) 
    // to include our proxy base URL so the browser doesn't request them from the host root.
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('text/html')) {
      let html = await response.text()
      const proxyBase = `/api/tenant/${tenantSlug}/ai-builder/preview/${chatId}`
      
      // Replace absolute paths for src, href, and action attributes
      // Pattern: starts with exactly one slash (not two, which would be protocol-relative)
      html = html.replace(/(src|href|action)="\/([^\/"][^"]*)?"/g, (match, attr, pathStr) => {
        return `${attr}="${proxyBase}/${pathStr || ''}"`
      })
      
      // Handle srcset if present (e.g., Next.js Image component)
      html = html.replace(/srcset="([^"]+)"/g, (match, srcsetContent) => {
        const rewritten = srcsetContent.split(',').map((part: string) => {
          const trimmed = part.trim()
          if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
            return `${proxyBase}${trimmed}`
          }
          return trimmed
        }).join(', ')
        return `srcset="${rewritten}"`
      })

      // Inject monkey-patch script to handle dynamic fetch and DOM node creation (client-side routing)
      const patchScript = `
        <script>
          (function() {
            const proxyBase = '${proxyBase}';
            
            // Intercept window.fetch
            const _origFetch = window.fetch;
            window.fetch = function(input, init) {
              let url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
              
              // Strip origin if present
              if (url && url.startsWith(window.location.origin)) {
                url = url.substring(window.location.origin.length);
              }
              
              if (url && url.startsWith('/') && !url.startsWith(proxyBase) && !url.startsWith('//')) {
                const newUrl = proxyBase + url;
                if (input instanceof Request) {
                  // We must create a new request with the new URL
                  input = new Request(newUrl, init || input);
                } else {
                  input = newUrl;
                }
              }
              return _origFetch.call(this, input, init);
            };

            // Intercept dynamic script/link creation (Webpack chunks)
            const _origCreateElement = document.createElement;
            document.createElement = function(tagName, options) {
              const el = _origCreateElement.call(document, tagName, options);
              const tag = tagName.toLowerCase();
              if (tag === 'script' || tag === 'link') {
                const attrToWatch = tag === 'script' ? 'src' : 'href';
                const origSetAttribute = el.setAttribute;
                el.setAttribute = function(name, value) {
                  if (name === attrToWatch && typeof value === 'string' && value.startsWith('/') && !value.startsWith(proxyBase) && !value.startsWith('//')) {
                    value = proxyBase + value;
                  }
                  origSetAttribute.call(this, name, value);
                };
                Object.defineProperty(el, attrToWatch, {
                  set: function(val) { this.setAttribute(attrToWatch, val); },
                  get: function() { return this.getAttribute(attrToWatch); }
                });
              }
              return el;
            };

            // Prevent pushState from actually changing the URL to avoid breaking Referer and hydration
            const _origPush = window.history.pushState;
            window.history.pushState = function(state, unused, url) {
              return _origPush.call(this, state, unused, window.location.href);
            };
            const _origReplace = window.history.replaceState;
            window.history.replaceState = function(state, unused, url) {
              return _origReplace.call(this, state, unused, window.location.href);
            };
          })();
        </script>
      `;
      
      // Inject before closing head or body, or at the top if neither found
      if (html.includes('</head>')) {
        html = html.replace('</head>', patchScript + '</head>');
      } else {
        html = patchScript + html;
      }


      
      const newHeaders = new Headers(response.headers)
      newHeaders.delete('content-length') // Length changed
      newHeaders.delete('content-security-policy') // Relax CSP if any so styles can load
      
      return new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      })
    }

    return response
  } catch (error: any) {
    console.error("Preview proxy error:", error)
    return new Response(error.message || "Internal Server Error", { status: 500 })
  }
}
