import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"
import type { NextRequest } from "next/server"
import { resolveTrustedOrigin } from "@/lib/trusted-host"

/**
 * SaCMS serves many hosts (platform subdomains + tenant custom domains), so
 * NEXTAUTH_URL must track the request host — but only for a host we actually
 * serve. resolveTrustedOrigin() rejects an arbitrary X-Forwarded-Host, which
 * would otherwise poison OAuth callbacks and email links (host-header
 * injection → account takeover).
 */
async function auth(req: NextRequest, ctx: unknown) {
  process.env.NEXTAUTH_URL = await resolveTrustedOrigin(req)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextAuth(authOptions)(req as any, ctx as any)
}

export { auth as GET, auth as POST }
