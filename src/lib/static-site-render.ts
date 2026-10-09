import { randomBytes } from "crypto"

/**
 * Combines a static site's html + js into one response-ready document with
 * a strict CSP (script-src locked to 'self' + a per-request nonce + the
 * Alpine.js CDN — no 'unsafe-inline' blanket allowance, since that's the
 * actual XSS vector for AI-generated code served straight to the public).
 * Shared by the public route (site/[tenant]/route.ts) and the authenticated
 * draft preview route, so both render identically.
 */
export function renderStaticSite(html: string, js: string): { body: string; headers: Record<string, string> } {
  const nonce = randomBytes(16).toString("base64")

  const scriptTag = `<script nonce="${nonce}">${js}</script>`
  let body = html
  if (body.includes('<script src="app.js"></script>')) {
    body = body.replace('<script src="app.js"></script>', scriptTag)
  } else if (body.includes("<script src='app.js'></script>")) {
    body = body.replace("<script src='app.js'></script>", scriptTag)
  } else if (body.includes("</body>")) {
    body = body.replace("</body>", `${scriptTag}</body>`)
  } else {
    body = `${body}\n${scriptTag}`
  }

  // The Public REST API this site's js fetches from lives on the apex/
  // wildcard-subdomain domain, not necessarily the exact hostname the site
  // itself is served on — allow both. Derived from config, not hardcoded,
  // so local dev (plain localhost) isn't locked out by CSP.
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "sacms.cloud"
  const connectSrc = rootDomain.includes("localhost")
    ? "'self' http://localhost:* http://127.0.0.1:*"
    : `'self' https://${rootDomain} https://*.${rootDomain}`

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net https://unpkg.com https://cdn.tailwindcss.com 'unsafe-eval'`,
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com https://cdn.tailwindcss.com",
    "img-src 'self' https: data:",
    "font-src 'self' https: data: https://fonts.gstatic.com",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
  ].join("; ")

  return {
    body,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": csp,
    },
  }
}
