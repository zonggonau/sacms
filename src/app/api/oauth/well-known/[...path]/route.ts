import { NextResponse } from "next/server"
import { authorizationServerMetadata, protectedResourceMetadata, publicOrigin, WORKSPACE_SLUG_PATTERN } from "@/lib/mcp/oauth/protocol"

// Served at /.well-known/* by the rewrite in next.config.ts. Clients fetch these
// from another origin (Claude.ai, ChatGPT), so CORS is open for GET.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Cache-Control": "public, max-age=300" }

function originOf(req: Request): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host")
  const proto = req.headers.get("x-forwarded-proto") || "https"
  return publicOrigin(host ? `${proto}://${host}` : undefined)
}

export async function GET(req: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const name = path[0] ?? ""
  const origin = originOf(req)

  if (name === "oauth-protected-resource") {
    // RFC 9728 path form: /.well-known/oauth-protected-resource/api/mcp (shared)
    // or /.well-known/oauth-protected-resource/api/mcp/w/<slug> (one workspace).
    const rest = path.slice(1).join("/")
    if (rest === "" || rest === "api/mcp") {
      return NextResponse.json(protectedResourceMetadata(origin), { headers: CORS })
    }
    const match = rest.match(/^api\/mcp\/w\/([^/]+)$/)
    if (match && WORKSPACE_SLUG_PATTERN.test(match[1])) {
      return NextResponse.json(protectedResourceMetadata(origin, match[1]), { headers: CORS })
    }
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: CORS })
  }
  if (name === "oauth-authorization-server") {
    return NextResponse.json(authorizationServerMetadata(origin), { headers: CORS })
  }
  return NextResponse.json({ error: "not_found" }, { status: 404, headers: CORS })
}

export function OPTIONS() {
  return new Response(null, { headers: { ...CORS, "Access-Control-Allow-Headers": "Content-Type, Authorization" } })
}
