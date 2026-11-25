import { createMcpHandler } from "mcp-handler"
import { z } from "zod"
import { registerGlobalPreviews } from "@/lib/infrastructure/mcp-preview"
import { GLOBAL_MCP_INSTRUCTIONS, GLOBAL_MCP_VERSION } from "@/lib/mcp/global-guidance"
import { NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { requiredScopeForTool } from "@/lib/mcp-global-scopes"
import { authContext, resolveGlobalSchemaToken, scopeDenied, UNAUTHORIZED, GLOBAL_RESOURCES } from "@/lib/mcp/global/context"
import { registerGuideTools } from "@/lib/mcp/global/guide-tools"
import { registerWebsiteTemplateTools } from "@/lib/mcp/global/website-template-tools"
import { registerGlobalComponentTools } from "@/lib/mcp/global/global-component-tools"

const handler = createMcpHandler(
  async (server) => {
    // Scope gate for EVERY tool, applied once here rather than in each
    // handler (a tool missing from the scope map requires `write` — fails
    // closed). Each handler's own `if (!auth) return UNAUTHORIZED` still
    // runs; this only adds the per-token scope check on top.
    const registerToolUnscoped = server.registerTool.bind(server) as (...args: any[]) => any
    ;(server as { registerTool: unknown }).registerTool = (name: string, config: unknown, toolHandler: (...args: any[]) => any) =>
      registerToolUnscoped(name, config, async (...args: any[]) => {
        const auth = authContext.getStore()
        const required = requiredScopeForTool(name)
        if (auth && !auth.scopes.includes(required)) return scopeDenied(name, required)
        return toolHandler(...args)
      })

    registerGlobalPreviews(server, () => authContext.getStore())

    registerGuideTools(server)
    registerWebsiteTemplateTools(server)
    registerGlobalComponentTools(server)
    // ── Resources ───────────────────────────────────────────────────────
    // Audit recommendation: expose the reference material as resources too.
    // Every token has `read`, so a valid token is all a read needs.
    for (const resource of GLOBAL_RESOURCES) {
      server.registerResource(
        resource.name,
        resource.uri,
        { title: resource.title, description: resource.description, mimeType: resource.mimeType },
        async (uri: URL) => {
          if (!authContext.getStore()) throw new Error("Unauthorized: a valid SaCMS Developer MCP token is required.")
          return { contents: [{ uri: uri.href, mimeType: resource.mimeType, text: await resource.read() }] }
        },
      )
    }

    // ── Prompts ─────────────────────────────────────────────────────────
    // Report P1/P2 (no `prompts` capability at all): a pre-packaged,
    // parameterized entry point for the exact workflow get_builder_guide
    // documents in prose — a client that supports MCP prompts can surface
    // this as a one-click/slash-command starting point instead of the
    // agent having to piece the same steps together from the guide text.
    server.registerPrompt(
      "buat-website",
      {
        title: "Buat Website Baru",
        description: "Start building a new Website Template end-to-end: schema + frontend + demo preview, for a given site topic/type.",
        argsSchema: {
          topic: z.string().describe("What the site is about, e.g. 'warung kopi', 'portal berita lokal', 'company profile konsultan hukum'"),
          name: z.string().optional().describe("Template display name, if already decided (otherwise propose one from the topic)"),
        },
      },
      async ({ topic, name }) => ({
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Bangun sebuah Website Template baru untuk: "${topic}"${name ? ` (nama template: "${name}")` : ""}.\n\n` +
              "Ambil dan ikuti get_website_agent_workflow. Analisis brief dan rencanakan pekerjaan terlebih dahulu. " +
              "Setelah workspace demo siap, baca skema aktualnya dan sesuaikan kebutuhan data sebelum menulis frontend. " +
              "Gunakan Next.js App Router, TypeScript, dan shadcn/ui. Selesaikan pemeriksaan keamanan dan dry run sebelum deploy demo. " +
              "Verifikasi rute pada deployment terbaru sebelum melaporkan URL pratinjau.",
          },
        }],
      }),
    )

  },
  {
    serverInfo: { name: "sacms-global-schema-mcp", version: GLOBAL_MCP_VERSION },
    // Kept short deliberately — confirmed live that at least one real MCP
    // client (Claude Code) truncates a long `instructions` string outright
    // (this field used to run ~6,178 characters and was cut off mid-word
    // well before the end, so everything past the cut never reached the
    // agent). Call get_builder_guide for the full workflow; this is only
    // the handful of rules too safety-critical to risk never being read.
    instructions: GLOBAL_MCP_INSTRUCTIONS,
  },
)

// ─── HTTP Request Handler ───────────────────────────────────────────────────
// No billing/payment concept applies here — unlike /api/mcp, this server is
// purely internal (SaCMS Global only), so the handshake only needs auth +
// rate limiting, not the subscription-status gate the per-workspace server
// has (which the Global tenant doesn't pass — see the file doc comment).

async function handleGlobalSchemaMcpRequest(req: Request): Promise<Response> {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown"
    const ipLimit = await rateLimit(`mcp_global_schema_ip:${ip}`, { limit: 60, windowSeconds: 60 })
    if (!ipLimit.success) {
      // Third/fourth external audit, RL-1: a plain `{error}` body with no
      // Retry-After/RateLimit-* headers gave a calling agent nothing to
      // act on but "wait an undetermined amount of time and hope" — JSON-RPC
      // shaped body (matching every other error this server returns) +
      // the standard rate-limit headers so a client can back off precisely.
      // `id` echoes the request's own JSON-RPC id (falling back to null
      // only when the body can't be read/parsed as JSON-RPC at all) — a
      // client that correlates responses by id would otherwise wait on
      // this request forever instead of ever seeing its rejection. Clone
      // rather than read `req` directly: this branch returns immediately,
      // but the original body must stay unconsumed for every OTHER path
      // below (the overwhelming majority of requests, which never hit this
      // clone/parse cost at all).
      const requestId = await req
        .clone()
        .json()
        .then((body) => (body && typeof body === "object" && "id" in body ? body.id : null))
        .catch(() => null)
      const retryAfterSeconds = Math.max(1, Math.ceil((ipLimit.resetAt - Date.now()) / 1000))
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: requestId,
          error: { code: -32000, message: "Rate limit exceeded. Try again later.", data: { retryAfterSeconds } },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds),
            "RateLimit-Limit": String(ipLimit.limit),
            "RateLimit-Remaining": String(Math.max(0, ipLimit.remaining)),
            "RateLimit-Reset": String(retryAfterSeconds),
          },
        },
      )
    }

    let token = ""
    const authHeader = req.headers.get("authorization")
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "")
    } else {
      token = new URL(req.url).searchParams.get("token") || ""
    }

    const auth = await resolveGlobalSchemaToken(token)
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized: Invalid or missing API token." }, { status: 401 })
    }

    const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host")
    const forwardedProto = req.headers.get("x-forwarded-proto") || "https"
    let patchedReq = req
    if (forwardedHost) {
      try {
        const url = new URL(req.url)
        url.host = forwardedHost
        url.port = ""
        url.protocol = `${forwardedProto}:`
        const newHeaders = new Headers(req.headers)
        newHeaders.set("host", forwardedHost)
        patchedReq = new Request(url.toString(), {
          method: req.method,
          headers: newHeaders,
          body: req.body,
          duplex: "half",
        } as any)
      } catch {
        patchedReq = req
      }
    }

    return await authContext.run(auth, () => handler(patchedReq))
  } catch (error: any) {
    console.error("MCP Global Schema Error:", error)
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return handleGlobalSchemaMcpRequest(req)
}

export async function POST(req: Request) {
  return handleGlobalSchemaMcpRequest(req)
}

export async function DELETE(req: Request) {
  return handleGlobalSchemaMcpRequest(req)
}
