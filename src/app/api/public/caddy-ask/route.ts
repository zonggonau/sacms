// GET /api/public/caddy-ask
// Used by Caddy on_demand_tls to validate if a custom domain should receive an SSL certificate.
// Caddy calls this endpoint before issuing a new TLS certificate for unknown hostnames.
// Returns 200 OK if domain is verified in database, 403 Forbidden otherwise.

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"

export const runtime = "nodejs"

const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "sacms.cloud").toLowerCase()

const RESERVED_SUBDOMAINS = new Set(["api", "cms", "admin", "developer", "www", "media"])

// A hostname under SaCMS's own root domain (tenant slugs like
// c7865b61a6798752.sacms.cloud, owner slugs like
// u8f9c1d2e3b4a5f6.sacms.cloud) is never a row in CustomDomain — that table
// is only for tenants' EXTERNAL domains — so the old code 403'd every one of
// them, and Caddy's on-demand TLS refused to issue a cert at all
// (ERR_SSL_PROTOCOL_ERROR). Fix: recognize them here too, but only when the
// subdomain actually matches a real tenant/owner — not a blanket allow for
// *.sacms.cloud, which would let anyone mint unlimited on-demand TLS
// requests against our own root domain and burn through Let's Encrypt's
// per-registered-domain rate limit (50 certs/domain/week) for everyone.
async function isRealPlatformSubdomain(domain: string): Promise<boolean> {
  if (domain === ROOT_DOMAIN) return true
  if (!domain.endsWith(`.${ROOT_DOMAIN}`)) return false
  const sub = domain.slice(0, -(ROOT_DOMAIN.length + 1))
  if (sub.includes(".")) return false // only one level of subdomain is ever legitimate
  if (RESERVED_SUBDOMAINS.has(sub)) return true
  if (sub.startsWith("u") && sub.length >= 8) {
    const owner = await db.user.findFirst({ where: { ownerSlug: sub }, select: { id: true } })
    if (owner) return true
  }
  const tenant = await db.tenant.findFirst({ where: { slug: sub }, select: { id: true } })
  return Boolean(tenant)
}

export async function GET(req: NextRequest) {
  try {
    const domain = req.nextUrl.searchParams.get("domain")?.toLowerCase().trim()

    if (!domain) {
      return new NextResponse("Bad Request: missing domain parameter", { status: 400 })
    }

    if (await isRealPlatformSubdomain(domain)) {
      return new NextResponse("OK", { status: 200 })
    }

    // Only allow verified custom domains from the database
    const verified = await db.customDomain.findFirst({
      where: {
        domain,
        status: "verified",
      },
      select: { id: true },
    })

    if (verified) {
      // Caddy expects 200 to proceed with TLS
      return new NextResponse("OK", { status: 200 })
    }

    // 403 tells Caddy to NOT issue a certificate for this domain
    return new NextResponse("Forbidden: domain not verified", { status: 403 })
  } catch (error) {
    console.error("[caddy-ask] Error validating domain:", error)
    // Fail-safe: return 403 so Caddy doesn't issue certificates for unknown domains
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
