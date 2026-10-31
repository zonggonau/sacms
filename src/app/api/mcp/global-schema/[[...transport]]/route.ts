/**
 * SaCMS Global — Schema Template MCP Server
 *
 * A separate, deliberately narrow MCP server for ONE job: managing the
 * platform-wide Schema Template catalog (prisma/schema.prisma's
 * SchemaTemplate model — reusable Content Type/Single Type/Component
 * blueprints any workspace can start a new site from, e.g. "Company
 * Profile", "E-Commerce Storefront"). It has no access to any tenant's own
 * content, schema, deployment, or settings — that's the per-workspace
 * server at /api/mcp instead.
 *
 * Why a separate server/token type rather than reusing /api/mcp:
 * 1. The per-workspace server's `resolveToken` requires an active paid
 *    Subscription row — the SaCMS Global tenant has none (it was created
 *    directly by the admin "Setup Global Tenant" route, which bypasses the
 *    normal tenant-creation flow that always creates one), so every single
 *    request there — including the initial MCP `initialize` handshake —
 *    gets rejected with HTTP 402 before the protocol layer ever runs. That
 *    is the literal cause of "The server couldn't complete MCP setup" when
 *    trying to add a regular `mcp_...` token for Global to an MCP client:
 *    the client never gets a valid initialize response, just a raw 402
 *    JSON body it can't parse as MCP.
 * 2. Schema Template tools have NO business being callable with every
 *    other workspace's own `mcp_...` token — keeping them on a separate
 *    server with its own `mcpglobal_...` token type means a leaked/misused
 *    workspace token can never reach this catalog, and vice versa.
 *
 * Auth: Standard HTTP Bearer token (Authorization: Bearer <mcpglobal_...>),
 * minted only for the SaCMS Global tenant (see src/actions/mcp-tokens.ts).
 * URL:  /api/mcp/global-schema
 */

import { createMcpHandler } from "mcp-handler"
import { z } from "zod"
import { db } from "@/lib/database"
import { NextResponse } from "next/server"
import { createHash } from "crypto"
import { AsyncLocalStorage } from "async_hooks"
import { slugify } from "@/lib/slug"
import { rateLimit } from "@/lib/rate-limit"
import { schemaTemplateBundleSchema } from "@/lib/validations/schema-template"

// ─── Auth ────────────────────────────────────────────────────────────────

interface GlobalAuthContext {
  tenantId: string
}

const authContext = new AsyncLocalStorage<GlobalAuthContext>()

export async function resolveGlobalSchemaToken(rawToken: string): Promise<GlobalAuthContext | null> {
  if (!rawToken?.trim()) return null
  const clean = rawToken.trim()
  const hashed = createHash("sha256").update(clean).digest("hex")

  const token = await db.apiToken.findFirst({
    where: { OR: [{ token: hashed }, { token: clean }], type: "mcp-global-schema" },
    select: { id: true, tenantId: true },
  })
  if (!token) return null

  // Defense in depth: this token type is only ever minted for the
  // configured Global tenant (see createGlobalSchemaMcpTokenAction), but
  // re-verify at request time in case that setting is ever repointed —
  // this server must never authorize against a non-Global tenant.
  const { getGlobalWorkspaceId } = await import("@/lib/settings")
  const globalId = await getGlobalWorkspaceId()
  if (token.tenantId !== globalId) return null

  db.apiToken
    .updateMany({
      where: { OR: [{ token: hashed }, { token: clean }], type: "mcp-global-schema" },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {})

  return { tenantId: token.tenantId }
}

const UNAUTHORIZED = {
  content: [{
    type: "text" as const,
    text: "❌ Unauthorized: Invalid or missing API token for the SaCMS Global Schema Template MCP server.",
  }],
}

function notFound(id: string) {
  return { content: [{ type: "text" as const, text: `❌ Schema Template '${id}' tidak ditemukan.` }], isError: true }
}

function invalidSchema(error: z.ZodError) {
  return {
    content: [{
      type: "text" as const,
      text: `❌ Schema tidak valid: ${error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    }],
    isError: true,
  }
}

// ─── MCP Handler ─────────────────────────────────────────────────────────

const handler = createMcpHandler(
  async (server) => {
    server.registerTool(
      "list_schema_templates",
      {
        title: "List Schema Templates",
        description:
          "List every Schema Template in the SaCMS catalog (both published and draft), with id, name, slug, " +
          "category, icon, description, published status, and timestamps — without the full schema blob " +
          "(call get_schema_template for that). Call this FIRST before creating a new template, to check " +
          "whether something close enough already exists.",
        inputSchema: {},
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const templates = await db.schemaTemplate.findMany({
          orderBy: { createdAt: "desc" },
          select: {
            id: true, name: true, slug: true, category: true, icon: true,
            description: true, published: true, createdAt: true, updatedAt: true,
          },
        })
        return { content: [{ type: "text" as const, text: JSON.stringify(templates, null, 2) }] }
      },
    )

    server.registerTool(
      "get_schema_template",
      {
        title: "Get Schema Template",
        description:
          "Get one Schema Template's full detail, including its complete schema (contentTypes/singleTypes/" +
          "components, each with their exact fields) — the same shape the per-workspace MCP server's " +
          "get_full_schema returns for a real workspace.",
        inputSchema: {
          id: z.string().describe("Schema Template id or slug"),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const template = await db.schemaTemplate.findFirst({ where: { OR: [{ id }, { slug: id }] } })
        if (!template) return notFound(id)
        return { content: [{ type: "text" as const, text: JSON.stringify(template, null, 2) }] }
      },
    )

    server.registerTool(
      "create_schema_template",
      {
        title: "Create Schema Template",
        description:
          "Create a new Schema Template — a reusable CMS schema blueprint (Content Types, Single Types, and " +
          "Components with their fields) for one type of website/system (e.g. 'Company Profile', 'E-Commerce " +
          "Storefront', 'Blog & News Portal'). This is the ONLY kind of data this server lets you write — it " +
          "never touches any tenant's own live content, schema, or settings. Call list_schema_templates first " +
          "to avoid creating a near-duplicate.",
        inputSchema: {
          name: z.string().min(1).max(150).describe("Template display name, e.g. 'Company Profile'"),
          category: z.string().min(1).max(100).describe("Catalog category, e.g. 'Business', 'E-Commerce', 'Portfolio'"),
          icon: z.string().max(10).optional().describe("A single emoji shown on the template card, e.g. '🏢'"),
          description: z.string().max(500).optional(),
          schema: schemaTemplateBundleSchema.describe(
            "{ contentTypes: [...], singleTypes: [...], components: [...] } — each model: " +
            "{ name, slug, description?, fields: [{ name, slug, type, required?, unique?, relationSlug?, componentSlug? }], dummyData?: [...] }",
          ),
          published: z.boolean().optional().describe(
            "Default false (visible only to SaCMS Global staff until reviewed). Set true to make it immediately browsable by every workspace.",
          ),
        },
      },
      async ({ name, category, icon, description, schema, published }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const parsedSchema = schemaTemplateBundleSchema.safeParse(schema)
        if (!parsedSchema.success) return invalidSchema(parsedSchema.error)

        const baseSlug = slugify(name)
        let slug = baseSlug
        let suffix = 1
        while (await db.schemaTemplate.findUnique({ where: { slug } })) {
          slug = `${baseSlug}-${++suffix}`
        }

        const template = await db.schemaTemplate.create({
          data: {
            name,
            slug,
            category,
            icon: icon || "📦",
            description: description || null,
            schema: parsedSchema.data,
            published: published ?? false,
          },
        })
        return { content: [{ type: "text" as const, text: JSON.stringify(template, null, 2) }] }
      },
    )

    server.registerTool(
      "update_schema_template",
      {
        title: "Update Schema Template",
        description:
          "Update an existing Schema Template's metadata, full schema, and/or published status. Passing " +
          "`schema` REPLACES the whole blob (contentTypes/singleTypes/components) — it is not merged field by " +
          "field, so include every model you want to keep.",
        inputSchema: {
          id: z.string().describe("Schema Template id or slug"),
          name: z.string().min(1).max(150).optional(),
          category: z.string().min(1).max(100).optional(),
          icon: z.string().max(10).optional(),
          description: z.string().max(500).optional(),
          schema: schemaTemplateBundleSchema.optional().describe("Full replacement for contentTypes/singleTypes/components"),
          published: z.boolean().optional(),
        },
      },
      async ({ id, name, category, icon, description, schema, published }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const existing = await db.schemaTemplate.findFirst({ where: { OR: [{ id }, { slug: id }] } })
        if (!existing) return notFound(id)

        let schemaData: z.infer<typeof schemaTemplateBundleSchema> | undefined
        if (schema !== undefined) {
          const parsedSchema = schemaTemplateBundleSchema.safeParse(schema)
          if (!parsedSchema.success) return invalidSchema(parsedSchema.error)
          schemaData = parsedSchema.data
        }

        const template = await db.schemaTemplate.update({
          where: { id: existing.id },
          data: {
            ...(name !== undefined ? { name } : {}),
            ...(category !== undefined ? { category } : {}),
            ...(icon !== undefined ? { icon } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(schemaData !== undefined ? { schema: schemaData } : {}),
            ...(published !== undefined ? { published } : {}),
          },
        })
        return { content: [{ type: "text" as const, text: JSON.stringify(template, null, 2) }] }
      },
    )

    server.registerTool(
      "delete_schema_template",
      {
        title: "Delete Schema Template",
        description: "Permanently delete a Schema Template from the catalog.",
        inputSchema: {
          id: z.string().describe("Schema Template id or slug"),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const existing = await db.schemaTemplate.findFirst({ where: { OR: [{ id }, { slug: id }] } })
        if (!existing) return notFound(id)

        await db.schemaTemplate.delete({ where: { id: existing.id } })
        return { content: [{ type: "text" as const, text: `✅ Template '${existing.name}' dihapus.` }] }
      },
    )
  },
  {
    serverInfo: { name: "sacms-global-schema-mcp", version: "1.0.0" },
    instructions:
      "This server manages SaCMS's platform-wide Schema Template catalog ONLY — reusable CMS blueprints " +
      "(Content Types, Single Types, Components) that any workspace can start a new site from. It has no " +
      "access to any tenant's own content, deployment, or settings; for that, connect to a workspace's own " +
      "MCP server at /api/mcp instead. Call list_schema_templates before creating a new one, to avoid a " +
      "near-duplicate. A template's `schema` field uses the exact same shape as the per-workspace server's " +
      "get_full_schema output.",
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
      return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 })
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
