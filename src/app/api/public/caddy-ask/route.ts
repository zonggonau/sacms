// GET /api/public/caddy-ask
// Used by Caddy on_demand_tls to validate if a custom domain should receive an SSL certificate.
// Caddy calls this endpoint before issuing a new TLS certificate for unknown hostnames.
// Returns 200 OK if domain is verified in database, 403 Forbidden otherwise.

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  try {
    const domain = req.nextUrl.searchParams.get("domain")?.toLowerCase().trim()

    if (!domain) {
      return new NextResponse("Bad Request: missing domain parameter", { status: 400 })
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
