import NextAuth from "next-auth"
import { getAuthOptionsForHost } from "@/lib/auth"
import type { NextRequest } from "next/server"
import { resolveTrustedOrigin, isPlatformHost } from "@/lib/trusted-host"

/**
 * SaCMS serves many hosts (platform subdomains + tenant custom domains), so
 * NEXTAUTH_URL must track the request host — but only for a host we actually
 * serve. resolveTrustedOrigin() rejects an arbitrary X-Forwarded-Host, which
 * would otherwise poison OAuth callbacks and email links (host-header
 * injection → account takeover).
 *
 * The session cookie's Domain attribute also has to track the host: a
 * platform subdomain (*.sacms.cloud) gets the shared `.sacms.cloud` cookie,
 * but a tenant's external custom domain (admin.bangparjo.shop) needs a
 * host-only cookie, or the browser silently drops the Set-Cookie entirely
 * (Domain mismatch) and login loops back to /login forever. See
 * getAuthOptionsForHost in src/lib/auth.ts.
 */
async function auth(req: NextRequest, ctx: unknown) {
  process.env.NEXTAUTH_URL = await resolveTrustedOrigin(req)
  const rawHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || ""
  const host = rawHost.split(",")[0].trim()
  const options = getAuthOptionsForHost(isPlatformHost(host))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextAuth(options)(req as any, ctx as any)
}

export { auth as GET, auth as POST }
