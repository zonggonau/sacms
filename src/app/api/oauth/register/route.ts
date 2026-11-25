import { NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { registerClient } from "@/lib/mcp/oauth/service"
import { oauthError } from "@/lib/mcp/oauth/protocol"

// RFC 7591 dynamic client registration. Public clients only (no client secret),
// so the PKCE challenge is the proof of possession at the token endpoint.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" }

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
  // Registration creates a row for every call, so it is throttled per client IP.
  const limit = await rateLimit(`oauth_register:${ip}`, { limit: 20, windowSeconds: 60 * 60 })
  if (!limit.success) {
    return NextResponse.json(oauthError("rate_limited", "Too many registrations. Try again later."), { status: 429, headers: CORS })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json(oauthError("invalid_client_metadata", "Body must be JSON."), { status: 400, headers: CORS })
  }

  const result = await registerClient({ clientName: body.client_name, redirectUris: body.redirect_uris })
  if (!result.ok) {
    return NextResponse.json(oauthError(result.error, result.description), { status: 400, headers: CORS })
  }
  return NextResponse.json(result.value, { status: 201, headers: { ...CORS, "Cache-Control": "no-store" } })
}

export function OPTIONS() {
  return new Response(null, { headers: CORS })
}
