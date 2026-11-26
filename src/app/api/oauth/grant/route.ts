import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { createAuthorizationCode, findClient } from "@/lib/mcp/oauth/service"
import { isValidCodeChallenge, parseMcpResource, publicOrigin } from "@/lib/mcp/oauth/protocol"

// Called by the consent page (/oauth/authorize) when the signed-in user approves
// or denies a client for one workspace. Only owners and admins of that workspace
// can approve. Returns the URL to send the browser to.

function withParams(redirectUri: string, params: Record<string, string>) {
  const url = new URL(redirectUri)
  // Empty values (e.g. a client that sent no state) are left out, not sent as "".
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value)
  return url.toString()
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 })
  }
  const str = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : "")

  const clientId = str("client_id")
  const redirectUri = str("redirect_uri")
  const state = str("state")
  const codeChallenge = str("code_challenge")
  const method = str("code_challenge_method")
  const resource = str("resource")
  const tenantSlug = str("tenant_slug")
  const decision = str("decision")

  // Never redirect to a URI the client did not register: that would turn this
  // endpoint into an open redirect.
  const client = await findClient(clientId)
  if (!client || !client.redirectUris.includes(redirectUri)) {
    return NextResponse.json({ error: "Unknown client or unregistered redirect_uri." }, { status: 400 })
  }

  const origin = publicOrigin()
  const named = parseMcpResource(origin, resource)
  if (resource && !named) {
    return NextResponse.json({ error: "resource does not name this MCP server." }, { status: 400 })
  }
  // A per-workspace resource fixes the workspace. The request body may not pick another one.
  const lockedSlug = named?.workspaceSlug ?? null
  if (lockedSlug && tenantSlug !== lockedSlug) {
    return NextResponse.json({ error: `This connection is for workspace "${lockedSlug}" only.` }, { status: 400 })
  }
  const workspaceSlug = lockedSlug ?? tenantSlug
  if (method !== "S256" || !isValidCodeChallenge(codeChallenge)) {
    return NextResponse.json({ redirect: withParams(redirectUri, { error: "invalid_request", error_description: "PKCE with S256 is required.", state }) })
  }

  if (decision !== "approve") {
    return NextResponse.json({ redirect: withParams(redirectUri, { error: "access_denied", state }) })
  }

  const access = await getTenantAccess(session as any, workspaceSlug)
  if (!access || (access.role !== "owner" && access.role !== "admin" && session.user.role !== "super_admin")) {
    return NextResponse.json({ error: "Only an owner or admin of this workspace can connect it." }, { status: 403 })
  }

  const code = await createAuthorizationCode({
    clientId,
    userId: session.user.id,
    tenantId: access.tenantId,
    redirectUri,
    codeChallenge,
  })
  return NextResponse.json({ redirect: withParams(redirectUri, { code, state }) })
}
