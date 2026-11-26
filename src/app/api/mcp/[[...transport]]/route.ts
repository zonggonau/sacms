import { createMcpHandler } from "mcp-handler"
import { registerWorkspacePreviews } from "@/lib/infrastructure/mcp-preview"
import { WORKSPACE_MCP_INSTRUCTIONS, WORKSPACE_MCP_VERSION } from "@/lib/mcp/workspace-guidance"
import { NextResponse } from "next/server"
import { rateLimit, getTenantRateLimit } from "@/lib/rate-limit"
import { authContext, resolveToken, hasScope } from "@/lib/mcp/workspace/context"
import { registerSchemaTools } from "@/lib/mcp/workspace/schema-tools"
import { registerContentTools } from "@/lib/mcp/workspace/content-tools"
import { registerSingleTypeAndComponentTools } from "@/lib/mcp/workspace/single-type-component-tools"
import { registerWebhookTools } from "@/lib/mcp/workspace/webhook-tools"
import { registerPlatformTools } from "@/lib/mcp/workspace/platform-tools"
import { registerBuildTools } from "@/lib/mcp/workspace/build-tools"
import { registerDeployTools } from "@/lib/mcp/workspace/deploy-tools"
import { publicOrigin } from "@/lib/mcp/oauth/protocol"
import { workspaceScopeError } from "@/lib/mcp/workspace-scope"

const handler = createMcpHandler(
  async (server) => {
    registerWorkspacePreviews(server, () => {
      const auth = authContext.getStore()
      return auth && { tenantId: auth.tenantId, tenantSlug: auth.tenantSlug, canRead: hasScope(auth, "read"), canWrite: hasScope(auth, "write") && auth.isHostingPlanPaid }
    })

    // =========================================================================
    // 1. FULL SCHEMA & INTROSPECTION TOOLS
    // =========================================================================

    registerSchemaTools(server)
    registerContentTools(server)
    registerSingleTypeAndComponentTools(server)
    registerWebhookTools(server)
    registerPlatformTools(server)
    registerBuildTools(server)
    registerDeployTools(server)


  },
  {
    serverInfo: { name: "sacms-mcp", version: WORKSPACE_MCP_VERSION },
    // Many MCP clients (Claude Desktop/Code, Cursor, Windsurf, VS Code
    // Copilot) load a server's `instructions` into the model's context
    // automatically on connect — no manual invocation needed. This is the
    // mechanism behind "connect this MCP server and the agent already knows
    // the workflow" (as opposed to a slash-command/@-mention, which is a
    // per-client UI convention this protocol field doesn't control). Kept
    // short since it's injected into every conversation; the full ordered
    // workflow lives in the get_agent_playbook tool for clients that ignore
    // this field or that an agent wants to re-read on demand.
    instructions: WORKSPACE_MCP_INSTRUCTIONS,
  }
)

// ─── HTTP Request Handlers & Protocol Wrapper ─────────────────────────────────

export async function authenticateRequest(req: Request) {
  let token = ""
  const authHeader = req.headers.get("authorization")
  
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.replace("Bearer ", "")
  } else {
    const url = new URL(req.url)
    token = url.searchParams.get("token") || ""
  }

  const auth = await resolveToken(token)
  return auth
}

function patchRequestUrl(req: Request): Request {
  const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host")
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https"
  
  if (forwardedHost) {
    try {
      const url = new URL(req.url)
      url.host = forwardedHost
      url.port = ""
      url.protocol = forwardedProto ? `${forwardedProto}:` : "https:"
      const newHeaders = new Headers(req.headers)
      newHeaders.set("host", forwardedHost)

      return new Request(url.toString(), {
        method: req.method,
        headers: newHeaders,
        body: req.body,
        duplex: 'half'
      } as any)
    } catch(e) {
      return req
    }
  }
  return req
}

/**
 * Shared by GET/POST/DELETE — the MCP protocol uses all three on the same
 * endpoint, and every request needs the same auth → rate-limit → dispatch
 * sequence. Two rate limits apply, in order:
 *
 *  1. Per client IP, BEFORE authentication — an invalid-token guess still
 *     costs a DB lookup inside resolveToken(), so brute-forcing tokens must
 *     be throttled before that lookup runs, not after.
 *  2. Per tenant, once authenticated, scaled by plan (reusing the same
 *     getTenantRateLimit() tiers the public content API uses) — so even a
 *     valid token can't hammer expensive tools (deploy_to_sacms) or the DB
 *     without bound.
 */
export async function handleMcpRequest(req: Request, opts: { workspaceSlug?: string } = {}): Promise<Response> {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown"
    const ipLimit = await rateLimit(`mcp_ip:${ip}`, { limit: 120, windowSeconds: 60 })
    if (!ipLimit.success) {
      return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 })
    }

    const auth = await authenticateRequest(req)
    if (!auth) {
      // RFC 9728: point the client at the protected-resource metadata so it can
      // start the OAuth flow. Clients that already hold a token ignore this.
      const origin = publicOrigin(new URL(req.url).origin)
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing API token." },
        {
          status: 401,
          headers: {
            "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource${opts.workspaceSlug ? `/api/mcp/w/${opts.workspaceSlug}` : "/api/mcp"}"`,
          },
        },
      )
    }
    const scopeError = workspaceScopeError(auth.tenantSlug, opts.workspaceSlug)
    if (scopeError) {
      return NextResponse.json({ error: scopeError, code: "WRONG_WORKSPACE" }, { status: 403 })
    }
    if (auth.paymentError) {
      return NextResponse.json({
        error: auth.paymentError,
        code: "PAYMENT_REQUIRED",
        plan: auth.plan,
        upgradeUrl: `/dashboard/${auth.tenantSlug}/subscriptions`
      }, { status: 402 })
    }

    const tenantLimit = await rateLimit(`mcp_tenant:${auth.tenantId}`, getTenantRateLimit(auth.plan))
    if (!tenantLimit.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded for this workspace. Try again later." },
        { status: 429 },
      )
    }

    const patchedReq = patchRequestUrl(req)
    return await authContext.run(auth, () => handler(patchedReq))
  } catch (error: any) {
    console.error("MCP Error:", error)
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return handleMcpRequest(req)
}

export async function POST(req: Request) {
  return handleMcpRequest(req)
}

export async function DELETE(req: Request) {
  return handleMcpRequest(req)
}
