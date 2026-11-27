// registerPlatformTools — Workspace MCP tools (split out of route.ts; see context.ts).
import { createMcpHandler } from "mcp-handler"
import { z } from "zod"
import { buildWorkspacePlaybook } from "@/lib/mcp/workspace-guidance"
import { getTenantDb } from "@/lib/database"
import { deriveNextStep } from "@/lib/workspace-next-step"
import { loadWorkspaceFacts } from "@/lib/workspace-next-step-facts"
import { McpServer, authContext, UNAUTHORIZED, hasScope, permissionDenied } from "./context"

export function registerPlatformTools(server: McpServer) {
    // ── inspect_api_capabilities ─────────────────────────────────────────────
    server.registerTool(
      "inspect_api_capabilities",
      {
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        title: "Inspect API Capabilities & Permissions",
        description: "Inspect active API key permissions (read, write, delete) to determine whether to build read-only or interactive dynamic components.",
        inputSchema: {},
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const permissions = auth.permissions || []
        const canRead = hasScope(auth, "read")
        const canWrite = hasScope(auth, "write")
        const canDelete = hasScope(auth, "delete")
        // Schema tools (content-type/component CRUD) and webhook tools are
        // gated on "write"/"delete" (see hasScope call sites) — the
        // dashboard's token-creation UI only ever grants read/write/delete,
        // so there is no separate grantable "schema"/"webhooks" scope.
        const canModifySchema = canWrite
        const canManageWebhooks = canWrite

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              tenantId: auth.tenantId,
              tenantSlug: auth.tenantSlug,
              tenantName: auth.tenantName,
              permissions,
              capabilities: {
                canRead,
                canWrite,
                canDelete,
                canModifySchema,
                canManageWebhooks,
              },
              recommendedMode: canWrite ? "interactive_fullstack" : "public_consumer",
              description: canWrite 
                ? "Token has write permissions: AI can generate interactive forms, data submissions, and mutations."
                : "Token has read-only permissions: AI should generate public catalog and reading interfaces."
            }, null, 2)
          }]
        }
      }
    )

    // ── get_api_info ─────────────────────────────────────────────────────────
    server.registerTool(
      "get_api_info",
      {
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        title: "Get API Information",
        description: "Get the full REST API documentation, endpoints, filtering syntax, and sample integration code for this workspace. The base URL is resolved automatically — only pass baseUrl to override it (e.g. a custom domain this isn't aware of).",
        inputSchema: {
          baseUrl: z.string().optional().describe("Override the public base URL of SaCMS (e.g. https://yourdomain.com). Leave unset — it's resolved automatically to the real platform URL, never a placeholder."),
        },
      },
      async ({ baseUrl }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        // Was previously a hardcoded "https://your-sacms.com" placeholder
        // whenever a caller didn't supply baseUrl — confirmed live via a
        // real external agent's transcript: it asked a human for the real
        // URL, was told to just proceed, and ended up handing back broken
        // sample code pointing at a domain that's never resolvable. SaCMS
        // already knows its own real public host (same resolver AI Site's
        // Sandbox preview env uses) — resolve it instead of guessing.
        const { resolveApiOrigin, SYSTEM_ENV_VARS } = await import("@/lib/infrastructure/frontend-env")
        const origin = baseUrl?.replace(/\/$/, "") || resolveApiOrigin()
        const apiBase = `${origin}/api/public/${auth.tenantSlug}`
        // The exact env var name deploy_to_sacms injects — read from the
        // same SYSTEM_ENV_VARS list list_deployment_env surfaces, instead
        // of a second hardcoded copy that can silently drift from it (the
        // sample below used to reference a var name SaCMS never actually
        // sets — confirmed live by chatgpt1.md's P1 finding; an agent
        // following this doc would ship code reading an env var that's
        // always empty).
        const tokenEnvKey = SYSTEM_ENV_VARS.find((v) => v.key === "SACMS_API_KEY")?.key || "SACMS_API_KEY"

        const docs = `# SaCMS API & MCP Integration Guide — Workspace: ${auth.tenantName}

## Base URL
${apiBase}

## Authentication Header
Authorization: Bearer YOUR_API_TOKEN

When calling the API from a deployed frontend (not a third-party server), use \`process.env.${tokenEnvKey}\` — this is injected automatically on every deploy_to_sacms call (never a placeholder you need to set yourself), server-side only (no \`NEXT_PUBLIC_\` prefix, so it's never sent to the browser). Call list_deployment_env if you need the full current list of injected/custom env vars for this workspace.

## Public REST Endpoints
- \`GET ${apiBase}/content/{contentTypeSlug}\` — List published collection entries
- \`GET ${apiBase}/content/{contentTypeSlug}/{id}\` — Get single collection entry by ID
- \`GET ${apiBase}/single/{singleTypeSlug}\` — Get single type content data
- \`POST ${apiBase}/graphql\` — Dynamic GraphQL API Endpoint

## Advanced Query & Filtering Operators
- Pagination: \`?pagination[page]=1&pagination[pageSize]=20\`
- Sorting: \`?sort=createdAt:desc\`
- Full-text Search: \`?search=keyword\`
- Field Selection: \`?fields=title,slug,publishedAt\`
- Relations: \`?populate=category,author\`
- Filter Eq: \`?filters[category][$eq]=tech\`
- Filter Contains: \`?filters[title][$contains]=tutorial\`
- Filter In: \`?filters[tags][$in]=news,updates\`

## Sample Next.js 16 Server Component (with ISR)
\`\`\`tsx
export default async function NewsPage() {
  const res = await fetch(\`${apiBase}/content/articles?pagination[pageSize]=10\`, {
    headers: { Authorization: \`Bearer \${process.env.${tokenEnvKey}}\` },
    next: { revalidate: 60 }
  })
  const { data } = await res.json()
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      {data.map((item: any) => (
        <article key={item.id} className="p-4 border rounded-xl">
          <h2 className="text-xl font-bold">{item.title}</h2>
          <p className="text-muted-foreground">{item.excerpt}</p>
        </article>
      ))}
    </main>
  )
}
\`\`\`
`
        return { content: [{ type: "text" as const, text: docs }] }
      }
    )

    // ── check_sdk_availability ───────────────────────────────────────────────
    // @sacms/sdk (mini-services/sdk in this repo) is a real, typed client an
    // agent can use instead of hand-written fetch() calls — but it's an
    // ordinary npm package, published and versioned independently of this
    // server, so its availability is never guaranteed from inside this code.
    // This checks the live public registry rather than trusting a hardcoded
    // "yes it's published" claim, which is exactly how an agent ended up
    // telling a user to `npm install` a package that didn't exist yet the
    // last time this was asserted statically.
    server.registerTool(
      "check_sdk_availability",
      {
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
        title: "Check @sacms/sdk Availability (Typed Client SDK)",
        description: "Live-checks whether the official @sacms/sdk npm package is currently published, and returns a ready-to-use init snippet pre-filled with THIS workspace's real base URL and tenant slug — call this before hand-writing fetch()/GraphQL boilerplate if you'd rather use a typed client with retries, pagination, and the filter DSL built in. Never assume the package is or isn't published without calling this first. If it comes back unavailable, fall back to the REST/GraphQL tools (query_content, get_content_entry, create_content_entry, ...) or get_api_info's raw fetch() sample instead of telling the user to npm install something unconfirmed.",
        inputSchema: {},
        outputSchema: {
          available: z.boolean(),
          packageName: z.string(),
          latestVersion: z.string().optional(),
          installCommand: z.string().optional(),
          quickStart: z.string().optional(),
          typeGenCommand: z.string().optional(),
          note: z.string().optional(),
          checkError: z.string().optional(),
          fallback: z.string().optional(),
        },
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const packageName = "@sacms/sdk"
        let latestVersion: string | null = null
        let checkError: string | undefined

        try {
          const res = await fetch(`https://registry.npmjs.org/${packageName}`, {
            signal: AbortSignal.timeout(5000),
          })
          if (res.ok) {
            const data = await res.json()
            latestVersion = data?.["dist-tags"]?.latest || null
          } else {
            checkError = `npm registry returned HTTP ${res.status}`
          }
        } catch (err: any) {
          checkError = err?.message || "Failed to reach the npm registry"
        }

        if (!latestVersion) {
          const structured = {
            available: false,
            packageName,
            checkError,
            fallback: "Could not confirm the package is published right now. Use the REST/GraphQL MCP tools directly (query_content, get_content_entry, create_content_entry, get_single_type, ...) or get_api_info's raw fetch() sample instead — do not tell the user to npm install this package without it being confirmed here.",
          }
          return {
            content: [{ type: "text" as const, text: `⚠️ Could not confirm @sacms/sdk is published right now${checkError ? ` (${checkError})` : ""}. Use the REST/GraphQL tools directly instead.` }],
            structuredContent: structured,
          }
        }

        const { resolveApiOrigin } = await import("@/lib/infrastructure/frontend-env")
        const origin = resolveApiOrigin()

        const quickStart = `import { SaCMS } from "${packageName}"

const sacms = new SaCMS({
  baseUrl: "${origin}",
  tenant: "${auth.tenantSlug}",
  token: process.env.SACMS_API_KEY!, // from get_or_create_api_key, injected automatically by deploy_to_sacms
})

const { data } = await sacms.collection("articles").findMany({ pagination: { pageSize: 10 } })`

        const structured = {
          available: true,
          packageName,
          latestVersion,
          installCommand: `npm install ${packageName}@${latestVersion}`,
          quickStart,
          typeGenCommand: `npx ${packageName} generate --url ${origin} --tenant ${auth.tenantSlug} --token YOUR_TOKEN --out src/types/sacms.ts`,
          note: "Prefer this typed client over raw fetch() for collections/single types/GraphQL. Member (end-user) auth is separate — see sacms.auth.* in the SDK's own README, unrelated to the service token above.",
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        }
      }
    )

    // ── get_next_step ────────────────────────────────────────────────────────
    // Where this workspace is on the planning → live path, and the next actions.
    // Same derivation as the dashboard's "Langkah berikutnya" card.
    server.registerTool(
      "get_next_step",
      {
        title: "Get Next Step",
        description: "Tells you where this workspace is on the path from planning to a live site (plan schema → add content → deploy frontend → live) and which tools or dashboard pages to use next. Call it when you are not sure what to do next, or after finishing a step. Read-only, no arguments.",
        inputSchema: {},
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const facts = await loadWorkspaceFacts(auth.tenantId, auth.tenantSlug)
        const next = deriveNextStep(facts, auth.tenantSlug)
        return {
          content: [{ type: "text" as const, text: JSON.stringify(next, null, 2) }],
          structuredContent: next,
        }
      }
    )

    // ── get_agent_playbook ───────────────────────────────────────────────────
    // The ordered, step-by-step workflow for an AI agent/IDE that just
    // connected to this server — distinct from get_api_info (which is REST
    // reference docs, not a sequence). Also surfaced automatically via this
    // server's `instructions` field (see createMcpHandler options below) for
    // clients that load MCP server instructions into the model's context on
    // connect; this tool exists so the same guidance is reachable by name on
    // every client, including ones that ignore `instructions`.
    server.registerTool(
      "get_agent_playbook",
      {
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        title: "Get Agent Playbook (Start Here)",
        description: "Read this FIRST when you connect to this MCP server. Returns the recommended, ordered workflow for building or updating a frontend against this SaCMS workspace — which tools to call, in what order, and how schema, content, and deployment fit together. Call with no arguments.",
        inputSchema: {},
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const playbook = buildWorkspacePlaybook(auth.tenantName)

        return { content: [{ type: "text" as const, text: playbook }] }
      }
    )

    // ── get_openapi_spec ─────────────────────────────────────────────────────
    server.registerTool(
      "get_openapi_spec",
      {
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        title: "Get OpenAPI Specification",
        description:
          "Get a real OpenAPI 3.0 document generated live from this workspace's actual CMS schema — every Content Type and Single Type as a JSON Schema model, with its list/get/create/update/delete paths. Hand this straight to any OpenAPI-aware tool or codegen step instead of re-deriving the API shape from get_full_schema by hand. The exact same document (same generator) is also served at GET /api/public/{tenant}/openapi.json for non-MCP tools (e.g. v0.app), and powers the dashboard's own Swagger tab.",
        inputSchema: {},
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const { buildOpenApiSpec } = await import("@/lib/openapi-generator")
        const { resolveApiOrigin } = await import("@/lib/infrastructure/frontend-env")
        const { EXCLUDE_PLATFORM_CONTENT_TYPES } = await import("@/lib/platform-content-types")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        // Same visibility rule the real public content API applies: this
        // tenant's own types plus global ones, minus SaCMS's internal
        // platform types — so the spec matches exactly what an external
        // tool calling the real endpoints would actually see, not just
        // this tenant's own schema in the abstract (unlike get_full_schema).
        const [contentTypesRaw, singleTypesRaw] = await Promise.all([
          tenantDb.contentType.findMany({
            where: { OR: [{ tenantId: auth.tenantId }, { tenantId: null, ...EXCLUDE_PLATFORM_CONTENT_TYPES }] },
            include: { schemaFields: true },
          }),
          tenantDb.singleType.findMany({
            where: { tenantId: auth.tenantId },
            include: { schemaFields: true },
          }),
        ])

        const spec = buildOpenApiSpec({
          tenantName: auth.tenantName,
          tenantSlug: auth.tenantSlug,
          apiOrigin: resolveApiOrigin(),
          contentTypes: contentTypesRaw.map((ct) => ({ slug: ct.slug, name: ct.name, fields: ct.schemaFields })),
          singleTypes: singleTypesRaw.map((st) => ({ slug: st.slug, name: st.name, fields: st.schemaFields })),
        })

        return { content: [{ type: "text" as const, text: JSON.stringify(spec, null, 2) }] }
      }
    )

    // ── get_or_create_api_key ────────────────────────────────────────────────
    server.registerTool(
      "get_or_create_api_key",
      {
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        title: "Get or Create Workspace API Key",
        description: "Get this workspace's primary REST/GraphQL API key (used as `Authorization: Bearer <key>` by frontends built against this workspace), creating it once if it doesn't exist yet. Safe to call repeatedly — an existing key is always reused, never duplicated. The plaintext secret is only returned the first time it is created; calling this again later returns metadata only (id, name, permissions), since the secret cannot be recovered after creation.",
        inputSchema: {},
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const { findPrimaryApiToken, getOrCreatePrimaryApiToken } = await import("@/lib/api-token-registry")

        const existing = await findPrimaryApiToken(auth.tenantId)
        if (existing) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                status: "existing",
                id: existing.id,
                name: existing.name,
                permissions: existing.permissions,
                createdAt: existing.createdAt,
                note: "This key already existed. Its secret was shown only once at creation and cannot be recovered here — ask the workspace owner for it, or ask them to create an additional key in Developer & API → API Keys (a workspace can hold several, one per app).",
              }, null, 2)
            }]
          }
        }

        const { apiToken, plainToken } = await getOrCreatePrimaryApiToken(auth.tenantId, null)
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              status: "created",
              id: apiToken.id,
              name: apiToken.name,
              permissions: apiToken.permissions,
              apiKey: plainToken,
              warning: "Store this key now (e.g. as SACMS_API_KEY) — it will never be shown again.",
            }, null, 2)
          }]
        }
      }
    )

    // update_api_key_permissions / regenerate_api_key were removed: both
    // mutate the tenant's primary REST/GraphQL API key with production-
    // breaking blast radius (an instant secret rotation invalidates every
    // live integration; a permission change alters what every consumer of
    // that key can do) — the dashboard reserves both for admin/owner
    // humans, but every MCP token is minted with full scope and no human
    // role concept, so holding any MCP token was equivalent to admin/owner
    // authority here with no audit trail. Same reasoning as removing the
    // Member tools: an agent helping build schemas/content has no
    // legitimate need to rotate or reconfigure production credentials.
    // get_or_create_api_key is kept — it only reveals the existing key or
    // creates one if none exists yet, never invalidates a working secret.

    // =========================================================================
    // 8. LOCAL DEVELOPMENT TOOLS
    // =========================================================================

    // ── sync_dev_env ─────────────────────────────────────────────────────────
    // Same env set deploy_to_sacms pushes to Vercel, so a project downloaded to
    // an IDE runs locally against the exact credentials production uses.
    server.registerTool(
      "sync_dev_env",
      {
        title: "Get Local Development .env",
        description:
          "Returns a ready-to-save .env.local for running this workspace's frontend locally against SaCMS: " +
          "NEXT_PUBLIC_SACMS_API_URL, NEXT_PUBLIC_SACMS_TENANT, SACMS_API_KEY (the same server-side key deploy_to_sacms injects), " +
          "plus every custom variable saved via add_deployment_env or the dashboard's Environment tab. " +
          "Write it to .env.local (never commit it). To add a third-party variable, call add_deployment_env — it is stored " +
          "for the workspace, pushed to the hosting project, and re-applied on every deploy, so local and deployed env stay in sync.",
        inputSchema: {
          format: z.enum(["env", "json"]).optional().describe("'env' (default) for .env.local file content, 'json' for a key/value object"),
        },
        outputSchema: {
          format: z.enum(["env", "json"]),
          keys: z.array(z.string()),
          content: z.string(),
        },
        annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
      },
      async ({ format = "env" }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        // SACMS_API_KEY can write content over REST and the env file carries every
        // custom secret, so this needs its own "env" scope, not just "write".
        if (!hasScope(auth, "env")) return permissionDenied("env")

        const { resolveFrontendEnv, renderDotEnv, resolveApiOrigin } = await import("@/lib/infrastructure/frontend-env")
        const env = await resolveFrontendEnv(auth.tenantId, auth.tenantSlug, resolveApiOrigin())
        const content =
          format === "json"
            ? JSON.stringify(env, null, 2)
            : `# SaCMS local env for workspace "${auth.tenantSlug}". Save as .env.local; do not commit.\n${renderDotEnv(env)}`
        const structured = { format, keys: Object.keys(env), content }

        return {
          content: [{ type: "text" as const, text: content }],
          structuredContent: structured,
        }
      }
    )

    // =========================================================================
    // 9. HOSTING & CLOUD DEPLOYMENT TOOLS (SACMS CLOUD HOSTING)
    // =========================================================================
}
