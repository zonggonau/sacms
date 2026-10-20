/**
 * SaCMS Owner-Level MCP Server
 *
 * A separate, account-wide MCP server from the per-workspace one
 * (src/app/api/mcp/[[...transport]]/route.ts). Authenticates with an
 * `OwnerApiToken` (minted from /dashboard/developer/mcp, NOT the same
 * credential as a workspace's own MCP token) and can act across EVERY
 * workspace the account owns or administers: list them, create new ones,
 * and — given an explicit `workspaceId` on each tool — read a workspace's
 * schema/content and deploy its frontend, all from one connection, instead
 * of a human having to paste a separate per-workspace MCP token into their
 * agent for every workspace they manage.
 *
 * Deliberately reuses the exact same underlying functions the per-workspace
 * MCP server and the dashboard already call (cms-introspection.ts,
 * entry-service.ts, deployTenantFrontend, buildOpenApiSpec) — this file
 * does not re-implement any business logic, only resolves `workspaceId`
 * against the owner's actual ownership/membership instead of a token
 * bound to one fixed tenant.
 *
 * Deliberately a SMALLER tool set than the per-workspace server (list/
 * create/get workspace, read schema, query + create content, deploy,
 * OpenAPI spec) — not full CRUD parity. A team that wants to manage one
 * workspace in full (update/delete entries, mutate schema, webhooks,
 * custom domains) should still use that workspace's own MCP token, which
 * keeps working unchanged. Extend this file's tool set later if the owner
 * use case needs more; don't duplicate the other server's 37 tools here
 * wholesale.
 *
 * Auth: Standard HTTP Bearer token (Authorization: Bearer <OWNER_TOKEN>)
 * URL:  /api/mcp/owner
 */

import { createMcpHandler } from "mcp-handler"
import { z } from "zod"
import { NextResponse } from "next/server"
import { createHash } from "crypto"
import { AsyncLocalStorage } from "async_hooks"
import { db, getTenantDb } from "@/lib/database"
import { rateLimit } from "@/lib/rate-limit"
import { getFullSchemaForTenant, listContentTypesForTenant, queryContentForTenant } from "@/lib/cms-introspection"
import { createContentEntry, contentRevalidatePaths, type EntryWriteContext, type ContentActor } from "@/lib/content/entry-service"
import { revalidatePath } from "next/cache"
import { createTenantForUser } from "@/actions/tenant"

// ─── Auth ──────────────────────────────────────────────────────────────────

interface OwnerAuthContext {
  userId: string
  userEmail: string
  userName: string
}

const authContext = new AsyncLocalStorage<OwnerAuthContext>()

async function resolveOwnerToken(rawToken: string): Promise<OwnerAuthContext | null> {
  if (!rawToken?.trim()) return null
  const clean = rawToken.trim()
  const hashed = createHash("sha256").update(clean).digest("hex")

  const token = await db.ownerApiToken.findFirst({
    where: { OR: [{ token: hashed }, { token: clean }] },
    select: { id: true, user: { select: { id: true, email: true, name: true } } },
  })
  if (!token?.user) return null

  db.ownerApiToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } }).catch(() => {})

  return { userId: token.user.id, userEmail: token.user.email, userName: token.user.name || token.user.email }
}

const UNAUTHORIZED = {
  content: [{
    type: "text" as const,
    text: "❌ Unauthorized: Invalid or missing Owner API token. Generate one from /dashboard/developer/mcp.",
  }],
}

/**
 * Every workspace-scoped tool takes `workspaceId` (an id or slug) and must
 * resolve it against this specific owner's real ownership/membership — a
 * workspaceId alone carries no proof of access, so skipping this check
 * would let any owner token read/deploy to ANY tenant in the system by
 * guessing an id.
 */
async function resolveOwnerWorkspace(ownerUserId: string, workspaceIdOrSlug: string) {
  const tenant = await db.tenant.findFirst({
    where: {
      AND: [
        { OR: [{ id: workspaceIdOrSlug }, { slug: workspaceIdOrSlug }] },
        { OR: [
          { ownerId: ownerUserId },
          { members: { some: { userId: ownerUserId, role: { in: ["owner", "admin"] } } } },
        ] },
      ],
    },
    select: { id: true, slug: true, name: true, plan: true, status: true, hostingStatus: true },
  })
  if (!tenant) {
    return {
      ok: false as const,
      response: {
        content: [{ type: "text" as const, text: `❌ Workspace '${workspaceIdOrSlug}' tidak ditemukan, atau akun ini bukan owner/admin di sana.` }],
        isError: true,
      },
    }
  }
  return { ok: true as const, tenant }
}

function isWorkspacePaid(tenant: { status: string; hostingStatus: string | null }, activeSubscription: boolean) {
  return (tenant.status === "active" && activeSubscription) || tenant.hostingStatus === "active"
}

// ─── MCP Handler ───────────────────────────────────────────────────────────

const handler = createMcpHandler(
  async (server) => {
    server.registerTool(
      "list_workspaces",
      {
        title: "List Workspaces",
        description: "List every workspace this account owns, or is an owner/admin member of — the starting point for everything else this server can do. Each entry's `id`/`slug` is what every other tool's `workspaceId` argument expects.",
        inputSchema: {},
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const user = await db.user.findUnique({
          where: { id: auth.userId },
          include: {
            ownedTenants: { select: { id: true, slug: true, name: true, plan: true, status: true, createdAt: true } },
          },
        })
        if (!user) return UNAUTHORIZED

        const memberWorkspaces = await db.tenant.findMany({
          where: {
            members: { some: { userId: auth.userId, role: { in: ["owner", "admin"] } } },
            id: { notIn: user.ownedTenants.map((t) => t.id) },
          },
          select: { id: true, slug: true, name: true, plan: true, status: true, createdAt: true },
        })

        const workspaces = [...user.ownedTenants, ...memberWorkspaces]
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ count: workspaces.length, workspaces }, null, 2),
          }],
        }
      },
    )

    server.registerTool(
      "create_workspace",
      {
        title: "Create Workspace",
        description: "Create a brand-new workspace (tenant) owned by this account — subject to this account's plan workspace limit. Provisioning (CMS setup, dedicated resources if applicable) continues in the background after this returns; use get_workspace to check its status.",
        inputSchema: {
          name: z.string().min(2).max(100).describe("Workspace display name"),
          description: z.string().max(500).default("").describe("Optional short description"),
          plan: z.string().default("free").describe("Plan slug to start on, e.g. 'free'"),
        },
      },
      async ({ name, description, plan }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const result = await createTenantForUser(auth.userId, { name, description: description || undefined, plan })
        if ("error" in result) {
          return { content: [{ type: "text" as const, text: `❌ ${result.error}` }], isError: true }
        }

        return {
          content: [{
            type: "text" as const,
            text: `✅ Workspace '${name}' sedang dibuat (tenantId: ${result.tenantId}). Panggil get_workspace untuk cek status provisioning.`,
          }],
        }
      },
    )

    server.registerTool(
      "get_workspace",
      {
        title: "Get Workspace",
        description: "Get one workspace's basic info and content stats by id or slug.",
        inputSchema: { workspaceId: z.string().describe("Workspace id or slug, from list_workspaces") },
      },
      async ({ workspaceId }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const resolved = await resolveOwnerWorkspace(auth.userId, workspaceId)
        if (!resolved.ok) return resolved.response

        const tenantDb = await getTenantDb(resolved.tenant.slug)
        const [contentTypeCount, singleTypeCount, memberCount] = await Promise.all([
          tenantDb.contentType.count({ where: { tenantId: resolved.tenant.id } }),
          tenantDb.singleType.count({ where: { tenantId: resolved.tenant.id } }),
          db.tenantMember.count({ where: { tenantId: resolved.tenant.id } }),
        ])

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ ...resolved.tenant, contentTypeCount, singleTypeCount, memberCount }, null, 2),
          }],
        }
      },
    )

    server.registerTool(
      "cms_get_full_schema",
      {
        title: "Get Workspace's Full CMS Schema",
        description: "Get the complete database schema (Content Types, Single Types, Components with fields) of one workspace this account owns/administers. Call this before building a frontend for that workspace.",
        inputSchema: { workspaceId: z.string().describe("Workspace id or slug, from list_workspaces") },
      },
      async ({ workspaceId }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const resolved = await resolveOwnerWorkspace(auth.userId, workspaceId)
        if (!resolved.ok) return resolved.response

        const tenantDb = await getTenantDb(resolved.tenant.slug)
        const schema = await getFullSchemaForTenant(tenantDb, resolved.tenant.id, {
          id: resolved.tenant.id,
          name: resolved.tenant.name,
          slug: resolved.tenant.slug,
        })

        return { content: [{ type: "text" as const, text: JSON.stringify(schema, null, 2) }] }
      },
    )

    server.registerTool(
      "cms_list_content_types",
      {
        title: "List Workspace's Content Types",
        description: "List one workspace's Content Types (collections) with their field schemas and entry counts.",
        inputSchema: { workspaceId: z.string().describe("Workspace id or slug, from list_workspaces") },
      },
      async ({ workspaceId }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const resolved = await resolveOwnerWorkspace(auth.userId, workspaceId)
        if (!resolved.ok) return resolved.response

        const tenantDb = await getTenantDb(resolved.tenant.slug)
        const types = await listContentTypesForTenant(tenantDb, resolved.tenant.id)
        return { content: [{ type: "text" as const, text: JSON.stringify(types, null, 2) }] }
      },
    )

    server.registerTool(
      "cms_query_content",
      {
        title: "Query Workspace's Content Entries",
        description: "Fetch content entries from one workspace's Content Type with pagination, locale filtering, and sorting.",
        inputSchema: {
          workspaceId: z.string().describe("Workspace id or slug, from list_workspaces"),
          contentTypeSlug: z.string().describe("Slug of the Content Type (e.g. 'articles')"),
          limit: z.number().default(10).describe("Number of items to return (max 100)"),
          page: z.number().default(1).describe("Page number (1-indexed)"),
          status: z.enum(["PUBLISHED", "DRAFT", "IN_REVIEW", "ARCHIVED", "ALL"]).default("PUBLISHED"),
          locale: z.string().default("").describe("Filter by locale code; empty = no filter"),
          sortOrder: z.enum(["asc", "desc"]).default("desc"),
        },
      },
      async ({ workspaceId, contentTypeSlug, limit, page, status, locale, sortOrder }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const resolved = await resolveOwnerWorkspace(auth.userId, workspaceId)
        if (!resolved.ok) return resolved.response

        const tenantDb = await getTenantDb(resolved.tenant.slug)
        const result = await queryContentForTenant(tenantDb, resolved.tenant.id, {
          contentTypeSlug, limit, page, status, locale: locale || undefined, sortOrder,
        })
        if (!result) {
          return { content: [{ type: "text" as const, text: `❌ Content Type '${contentTypeSlug}' tidak ditemukan.` }], isError: true }
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      },
    )

    server.registerTool(
      "cms_create_content_entry",
      {
        title: "Create Content Entry in a Workspace",
        description: "Insert a new content entry into one workspace's Content Type collection with JSON payload data.",
        inputSchema: {
          workspaceId: z.string().describe("Workspace id or slug, from list_workspaces"),
          contentTypeSlug: z.string().describe("Slug of the target Content Type"),
          data: z.record(z.string(), z.any()).describe("JSON object of field values"),
          status: z.enum(["PUBLISHED", "DRAFT", "IN_REVIEW"]).default("PUBLISHED"),
          locale: z.string().default("id"),
        },
      },
      async ({ workspaceId, contentTypeSlug, data, status, locale }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const resolved = await resolveOwnerWorkspace(auth.userId, workspaceId)
        if (!resolved.ok) return resolved.response

        const tenantDb = await getTenantDb(resolved.tenant.slug)
        const ctx: EntryWriteContext = { client: tenantDb, tenantId: resolved.tenant.id, tenantSlug: resolved.tenant.slug, isGlobal: false, enforcePlan: true }
        const actor: ContentActor = { kind: "system" }

        const result = await createContentEntry(ctx, actor, { contentTypeSlug, data: data || {}, status, locale })
        if (!result.ok) {
          return { content: [{ type: "text" as const, text: `❌ ${result.message}` }], isError: true }
        }

        for (const path of contentRevalidatePaths(resolved.tenant.slug, contentTypeSlug)) revalidatePath(path)

        return {
          content: [{
            type: "text" as const,
            text: `✅ Entry dibuat di '${contentTypeSlug}' (workspace: ${resolved.tenant.slug}) dengan ID '${result.data.id}'.\n\n${JSON.stringify(result.data, null, 2)}`,
          }],
        }
      },
    )

    server.registerTool(
      "deploy_workspace_frontend",
      {
        title: "Deploy Frontend to a Workspace's SaCMS Cloud Hosting",
        description: "Deploy generated website frontend files directly to one workspace's SaCMS Cloud Hosting project — the same one-project-per-workspace deploy the dashboard's own deploy button and AI Site Publish use. Returns the live production URL. Requires the target workspace to have an active paid plan.",
        inputSchema: {
          workspaceId: z.string().describe("Workspace id or slug, from list_workspaces"),
          files: z.array(z.object({
            name: z.string().describe("File path, e.g. 'app/page.tsx'"),
            content: z.string().describe("Raw source code content of the file"),
          })).min(1).describe("Array of files to deploy"),
          envVars: z.record(z.string(), z.string()).default({}).describe("Extra env vars merged on top of the workspace's saved Environment vars"),
        },
      },
      async ({ workspaceId, files, envVars }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const resolved = await resolveOwnerWorkspace(auth.userId, workspaceId)
        if (!resolved.ok) return resolved.response
        const tenant = resolved.tenant

        const activeSubscription = await db.subscription.findFirst({
          where: { tenantId: tenant.id, status: { in: ["active", "paid", "trialing"] } },
        })
        if (!isWorkspacePaid(tenant, !!activeSubscription)) {
          return {
            content: [{ type: "text" as const, text: `❌ Payment Required: Workspace '${tenant.slug}' belum berstatus PAID. Deploy ditolak.` }],
            isError: true,
          }
        }

        const deployLimit = await rateLimit(`mcp_owner_deploy:${auth.userId}`, { limit: 3, windowSeconds: 300 })
        if (!deployLimit.success) {
          return { content: [{ type: "text" as const, text: "❌ Terlalu banyak percobaan deploy. Maksimal 3 deploy per 5 menit per akun." }], isError: true }
        }

        try {
          const { deployTenantFrontend } = await import("@/lib/infrastructure/deploy-frontend")
          const { resolveApiOrigin } = await import("@/lib/infrastructure/frontend-env")
          const result = await deployTenantFrontend(tenant.id, tenant.slug, resolveApiOrigin(), files)

          return {
            content: [{
              type: "text" as const,
              text: `🚀 Deploy ke workspace '${tenant.slug}' sukses!\n- Deployment ID: ${result.deploymentId}\n- Live URL: ${result.url}\n- Status: ${result.state}`,
            }],
          }
        } catch (err: any) {
          return { content: [{ type: "text" as const, text: `❌ Gagal deploy: ${err.message}` }], isError: true }
        }
      },
    )

    server.registerTool(
      "get_workspace_openapi_spec",
      {
        title: "Get a Workspace's OpenAPI Specification",
        description: "Get a real OpenAPI 3.1 document generated live from one workspace's actual CMS schema — hand this to any OpenAPI-aware tool or codegen step while building that workspace's frontend. Same generator the per-workspace MCP server's get_openapi_spec tool and the dashboard's Swagger tab use.",
        inputSchema: { workspaceId: z.string().describe("Workspace id or slug, from list_workspaces") },
      },
      async ({ workspaceId }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const resolved = await resolveOwnerWorkspace(auth.userId, workspaceId)
        if (!resolved.ok) return resolved.response

        const { buildOpenApiSpec } = await import("@/lib/openapi-generator")
        const { resolveApiOrigin } = await import("@/lib/infrastructure/frontend-env")
        const { EXCLUDE_PLATFORM_CONTENT_TYPES } = await import("@/lib/platform-content-types")

        const tenantDb = await getTenantDb(resolved.tenant.slug)
        const [contentTypesRaw, singleTypesRaw] = await Promise.all([
          tenantDb.contentType.findMany({
            where: { OR: [{ tenantId: resolved.tenant.id }, { tenantId: null, ...EXCLUDE_PLATFORM_CONTENT_TYPES }] },
            include: { schemaFields: true },
          }),
          tenantDb.singleType.findMany({ where: { tenantId: resolved.tenant.id }, include: { schemaFields: true } }),
        ])

        const spec = buildOpenApiSpec({
          tenantName: resolved.tenant.name,
          tenantSlug: resolved.tenant.slug,
          apiOrigin: resolveApiOrigin(),
          contentTypes: contentTypesRaw.map((ct) => ({ slug: ct.slug, name: ct.name, fields: ct.schemaFields })),
          singleTypes: singleTypesRaw.map((st) => ({ slug: st.slug, name: st.name, fields: st.schemaFields })),
        })

        return { content: [{ type: "text" as const, text: JSON.stringify(spec, null, 2) }] }
      },
    )
  },
  { serverInfo: { name: "sacms-owner-mcp", version: "1.0.0" } },
)

// ─── HTTP Request Handlers ─────────────────────────────────────────────────

async function handleOwnerMcpRequest(req: Request): Promise<Response> {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
    const ipLimit = await rateLimit(`mcp_owner_ip:${ip}`, { limit: 120, windowSeconds: 60 })
    if (!ipLimit.success) {
      return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 })
    }

    const authHeader = req.headers.get("authorization")
    let token = ""
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "")
    } else {
      token = new URL(req.url).searchParams.get("token") || ""
    }

    const auth = await resolveOwnerToken(token)
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized: Invalid or missing Owner API token." }, { status: 401 })
    }

    const ownerLimit = await rateLimit(`mcp_owner:${auth.userId}`, { limit: 300, windowSeconds: 60 })
    if (!ownerLimit.success) {
      return NextResponse.json({ error: "Rate limit exceeded for this account. Try again later." }, { status: 429 })
    }

    return await authContext.run(auth, () => handler(req))
  } catch (error: any) {
    console.error("Owner MCP Error:", error)
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 })
  }
}

export async function GET(req: Request) {
  return handleOwnerMcpRequest(req)
}

export async function POST(req: Request) {
  return handleOwnerMcpRequest(req)
}

export async function DELETE(req: Request) {
  return handleOwnerMcpRequest(req)
}
