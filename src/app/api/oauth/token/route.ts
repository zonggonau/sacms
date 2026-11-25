import { NextResponse } from "next/server"
import { exchangeAuthorizationCode, refreshConnection } from "@/lib/mcp/oauth/service"
import { oauthError } from "@/lib/mcp/oauth/protocol"

// RFC 6749 token endpoint, form-encoded per section 4.1.3 and 6. Responses are
// never cached: they carry credentials.
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
  Pragma: "no-cache",
}

export async function POST(req: Request) {
  const form = new URLSearchParams(await req.text())
  const grantType = form.get("grant_type")
  const clientId = form.get("client_id") || ""

  if (grantType === "authorization_code") {
    const code = form.get("code") || ""
    const redirectUri = form.get("redirect_uri") || ""
    const codeVerifier = form.get("code_verifier") || ""
    if (!code || !redirectUri || !codeVerifier || !clientId) {
      return NextResponse.json(oauthError("invalid_request", "code, redirect_uri, client_id, and code_verifier are required."), { status: 400, headers: HEADERS })
    }
    const result = await exchangeAuthorizationCode({ code, clientId, redirectUri, codeVerifier })
    if (!result.ok) {
      return NextResponse.json(oauthError(result.error, result.description), { status: 400, headers: HEADERS })
    }
    return NextResponse.json(result.value, { headers: HEADERS })
  }

  if (grantType === "refresh_token") {
    const refreshToken = form.get("refresh_token") || ""
    if (!refreshToken || !clientId) {
      return NextResponse.json(oauthError("invalid_request", "refresh_token and client_id are required."), { status: 400, headers: HEADERS })
    }
    const result = await refreshConnection({ refreshToken, clientId })
    if (!result.ok) {
      return NextResponse.json(oauthError(result.error, result.description), { status: 400, headers: HEADERS })
    }
    return NextResponse.json(result.value, { headers: HEADERS })
  }

  return NextResponse.json(oauthError("unsupported_grant_type", "Only authorization_code and refresh_token are supported."), { status: 400, headers: HEADERS })
}

export function OPTIONS() {
  return new Response(null, { headers: HEADERS })
}
