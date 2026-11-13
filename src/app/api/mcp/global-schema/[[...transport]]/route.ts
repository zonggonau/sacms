/**
 * SaCMS Global — Schema Template MCP Server
 *
 * A separate, deliberately narrow MCP server for managing the platform-wide
 * template catalog: SchemaTemplate (prisma/schema.prisma's SchemaTemplate
 * model — reusable Content Type/Single Type/Component blueprints any
 * workspace can start a new site from, e.g. "Company Profile", "E-Commerce
 * Storefront") AND WebsiteTemplate (a frontend source bundle built by
 * SaCMS's own IT team here via ChatGPT/IDE, tied to one SchemaTemplate —
 * one SchemaTemplate can have many WebsiteTemplates, different frontend
 * "skins" for the same structure). It has no access to any tenant's own
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
import { websiteTemplateFilesSchema } from "@/lib/validations/website-template"
import { FIELD_TYPES, FIELD_CATEGORIES } from "@/lib/field-types"
import { FIELD_TYPE_GUIDE } from "@/lib/field-type-guide"

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
    select: { id: true, tenantId: true, tenant: { select: { id: true, slug: true } } },
  })
  if (!token?.tenant) return null

  // Defense in depth: this token type is only ever minted for the
  // configured Global tenant (see createGlobalSchemaMcpTokenAction), but
  // re-verify at request time in case that setting is ever repointed —
  // this server must never authorize against a non-Global tenant.
  // `globalTenantId` may be configured as either the tenant's real id OR
  // its slug (see isGlobal in src/lib/tenant-access.ts, which this must
  // match) — comparing only against `token.tenantId` (always the real id)
  // wrongly rejected every token whenever the setting held the slug
  // instead, which is exactly how the Global tenant was provisioned here.
  const { getGlobalWorkspaceId } = await import("@/lib/settings")
  const globalId = await getGlobalWorkspaceId()
  if (token.tenant.id !== globalId && token.tenant.slug !== globalId) return null

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
      "list_field_types",
      {
        title: "List Supported Field Types",
        description:
          "List all 36 field types a Schema Template's fields can use, with each one's real `options`/" +
          "`relationSlug` shape and entry-value shape — call this BEFORE writing any field into " +
          "create_schema_template/update_schema_template. Several options look plausible but are silently " +
          "ignored at render time once a tenant applies the template (e.g. currency's currencyCode, media's " +
          "allowedTypes) — this flags those explicitly so you don't guess an options shape that does nothing.",
        inputSchema: {
          category: z.enum([
            "Basic", "Number", "Date & Time", "Selection", "Boolean",
            "Validation", "Media", "Relations", "Advanced",
          ]).optional().describe("Optional category to filter field types"),
        },
      },
      async ({ category }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        let types = FIELD_TYPES as unknown as any[]
        if (category) types = types.filter((t) => t.category.toLowerCase() === category.toLowerCase())

        const fieldDocs = types.map((ft) => {
          const guide = FIELD_TYPE_GUIDE[ft.type]
          const supportedOptions: Record<string, string> = {
            required: "boolean (default false)",
            unique: "boolean (default false)",
          }
          if (guide?.options) supportedOptions.options = guide.options
          if (guide?.relationSlug) supportedOptions.relationSlug = guide.relationSlug

          return {
            type: ft.type,
            label: ft.label,
            category: ft.category,
            description: ft.description,
            supportedOptions,
            exampleOptions: guide?.exampleOptions,
            entryValueShape: guide?.entryValue,
            note: guide?.note,
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              totalCount: fieldDocs.length,
              categories: FIELD_CATEGORIES,
              fieldTypes: fieldDocs,
              usageNote: "Put these in each model's `fields` array inside create_schema_template/update_schema_template's `schema`. `note` (when present) flags a dead option or an easy-to-miss real capability — read it before guessing.",
            }, null, 2),
          }],
        }
      },
    )

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
            "{ groups?: [...], contentTypes: [...], singleTypes: [...], components: [...] } — each model: " +
            "{ name, slug, description?, fields: [{ name, slug, type, required?, unique?, relationSlug?, componentSlug?, options? }], dummyData?: [...] }. " +
            "Call list_field_types FIRST — it has the real options/relationSlug shape and entry-value shape " +
            "per field type, and flags options that look plausible but are silently ignored. Never guess one. " +
            "Optionally organize Content Types into sidebar folders via `groups`: [{ slug, name, parentSlug? }] " +
            "— `slug` here is a template-local key, NOT a real database id (list parents before children, max " +
            "3 levels) — then set `group: '<that slug>'` on each contentTypes[] entry that belongs in it. " +
            "Single Types and Components have no grouping concept in SaCMS — `group` on those is ignored.",
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
          schema: schemaTemplateBundleSchema.optional().describe(
            "Full replacement for groups/contentTypes/singleTypes/components. Call list_field_types first, " +
            "same as create_schema_template — don't guess an options shape. Same `groups`/`group` convention " +
            "too (template-local slugs, Content Types only).",
          ),
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

    // ── Website Templates (frontend bundles following a Schema Template) ──

    server.registerTool(
      "list_website_templates",
      {
        title: "List Website Templates",
        description:
          "List Website Templates — frontend source bundles that follow a specific Schema Template's " +
          "structure, built by the SaCMS team. Metadata only (no `files` — call get_website_template for " +
          "that). Call this FIRST before creating a new one, and to check which Website Templates already " +
          "exist for a given Schema Template.",
        inputSchema: {
          schemaTemplateId: z.string().optional().describe("Filter to Website Templates following this Schema Template's id"),
        },
      },
      async ({ schemaTemplateId }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const templates = await db.websiteTemplate.findMany({
          where: schemaTemplateId ? { schemaTemplateId } : {},
          orderBy: { createdAt: "desc" },
          select: {
            id: true, name: true, slug: true, schemaTemplateId: true, icon: true,
            description: true, published: true, createdAt: true, updatedAt: true,
            schemaTemplate: { select: { name: true, slug: true } },
          },
        })
        return { content: [{ type: "text" as const, text: JSON.stringify(templates, null, 2) }] }
      },
    )

    server.registerTool(
      "get_website_template",
      {
        title: "Get Website Template",
        description: "Get one Website Template's full detail, including its complete `files` array (path + content for every source file).",
        inputSchema: {
          id: z.string().describe("Website Template id or slug"),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const template = await db.websiteTemplate.findFirst({
          where: { OR: [{ id }, { slug: id }] },
          include: { schemaTemplate: { select: { id: true, name: true, slug: true } } },
        })
        if (!template) return notFound(id)
        return { content: [{ type: "text" as const, text: JSON.stringify(template, null, 2) }] }
      },
    )

    server.registerTool(
      "create_website_template",
      {
        title: "Create Website Template",
        description:
          "Create a new Website Template — a frontend source bundle (Next.js app files, text/code only, no " +
          "binary assets) that follows an existing Schema Template's structure. Call list_schema_templates " +
          "first to get the right schemaTemplateId, and get_schema_template to see exactly what Content " +
          "Types/Single Types/Components/fields this frontend needs to render. Call list_website_templates " +
          "first to avoid creating a near-duplicate for the same Schema Template. IMPORTANT: include a " +
          "`.env.example` file in `files` listing every env var the frontend reads from process.env — " +
          "\"Terapkan\" parses it and auto-creates matching custom env vars on the workspace's Environment " +
          "tab at apply time. If your frontend doesn't use SaCMS's own fixed names (NEXT_PUBLIC_SACMS_API_URL / " +
          "NEXT_PUBLIC_SACMS_TENANT / SACMS_API_KEY) — e.g. it reads NEXT_PUBLIC_API_URL instead — write the " +
          "value as the literal placeholder `{{SACMS_API_URL}}`, `{{SACMS_TENANT_SLUG}}`, or `{{SACMS_API_KEY}}` " +
          "and it resolves to that workspace's REAL production value on apply, instead of staying empty for " +
          "the customer to guess. Any other var (e.g. NEXT_PUBLIC_SITE_NAME=) is created with its literal " +
          "default value, editable later on the Environment tab.",
        inputSchema: {
          schemaTemplateId: z.string().describe("The Schema Template this frontend follows (id or slug)"),
          name: z.string().min(1).max(150).describe("Template display name, e.g. 'Company Profile — Modern Dark'"),
          icon: z.string().max(10).optional().describe("A single emoji shown on the template card, e.g. '🖥️'"),
          description: z.string().max(500).optional(),
          files: websiteTemplateFilesSchema.describe(
            "[{ path, content }, ...] — every source file for the frontend (package.json, app/**, " +
            "components/**, tailwind config, etc.), as plain text, PLUS a `.env.example` documenting its env " +
            "vars (see the {{SACMS_*}} placeholder convention above). Max 200 files, 200KB each. No binary assets.",
          ),
          published: z.boolean().optional().describe(
            "Default false (visible only to SaCMS Global staff until reviewed). Set true to make it immediately browsable by every workspace.",
          ),
        },
      },
      async ({ schemaTemplateId, name, icon, description, files, published }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const schemaTemplate = await db.schemaTemplate.findFirst({
          where: { OR: [{ id: schemaTemplateId }, { slug: schemaTemplateId }] },
          select: { id: true, slug: true, name: true, schema: true, demoTenantId: true },
        })
        if (!schemaTemplate) {
          return {
            content: [{ type: "text" as const, text: `❌ Schema Template '${schemaTemplateId}' tidak ditemukan. Panggil list_schema_templates untuk melihat id/slug yang valid.` }],
            isError: true,
          }
        }

        const parsedFiles = websiteTemplateFilesSchema.safeParse(files)
        if (!parsedFiles.success) return invalidSchema(parsedFiles.error)

        const baseSlug = slugify(name)
        let slug = baseSlug
        let suffix = 1
        while (await db.websiteTemplate.findUnique({ where: { slug } })) {
          slug = `${baseSlug}-${++suffix}`
        }

        const template = await db.websiteTemplate.create({
          data: {
            name,
            slug,
            schemaTemplateId: schemaTemplate.id,
            icon: icon || "🖥️",
            description: description || null,
            files: parsedFiles.data,
            published: published ?? false,
          },
        })

        const { deployWebsiteTemplateDemo } = await import("@/lib/infrastructure/deploy-website-template-demo")
        const demo = await deployWebsiteTemplateDemo({
          id: template.id,
          slug: template.slug,
          files: parsedFiles.data,
          schemaTemplate,
        })

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              ...template,
              demoUrl: demo.url,
              demoDeployment: demo.url ? { status: "ok" } : { status: "failed", error: demo.error },
            }, null, 2),
          }],
        }
      },
    )

    server.registerTool(
      "update_website_template",
      {
        title: "Update Website Template",
        description:
          "Update an existing Website Template's metadata, files, and/or published status. Passing `files` " +
          "REPLACES the whole bundle — it is not merged file by file, so include every file you want to keep.",
        inputSchema: {
          id: z.string().describe("Website Template id or slug"),
          name: z.string().min(1).max(150).optional(),
          icon: z.string().max(10).optional(),
          description: z.string().max(500).optional(),
          files: websiteTemplateFilesSchema.optional().describe("Full replacement for the file bundle — see create_website_template."),
          published: z.boolean().optional(),
        },
      },
      async ({ id, name, icon, description, files, published }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const existing = await db.websiteTemplate.findFirst({
          where: { OR: [{ id }, { slug: id }] },
          include: { schemaTemplate: { select: { id: true, slug: true, name: true, schema: true, demoTenantId: true } } },
        })
        if (!existing) return notFound(id)

        let filesData: z.infer<typeof websiteTemplateFilesSchema> | undefined
        if (files !== undefined) {
          const parsedFiles = websiteTemplateFilesSchema.safeParse(files)
          if (!parsedFiles.success) return invalidSchema(parsedFiles.error)
          filesData = parsedFiles.data
        }

        const template = await db.websiteTemplate.update({
          where: { id: existing.id },
          data: {
            ...(name !== undefined ? { name } : {}),
            ...(icon !== undefined ? { icon } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(filesData !== undefined ? { files: filesData } : {}),
            ...(published !== undefined ? { published } : {}),
          },
        })

        // Only a real file change warrants a redeploy — a metadata-only
        // edit (name/icon/description/published) shouldn't rebuild the demo.
        if (filesData !== undefined) {
          const { deployWebsiteTemplateDemo } = await import("@/lib/infrastructure/deploy-website-template-demo")
          const demo = await deployWebsiteTemplateDemo({
            id: template.id,
            slug: template.slug,
            files: filesData,
            schemaTemplate: existing.schemaTemplate,
          })
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                ...template,
                demoUrl: demo.url,
                demoDeployment: demo.url ? { status: "ok" } : { status: "failed", error: demo.error },
              }, null, 2),
            }],
          }
        }

        return { content: [{ type: "text" as const, text: JSON.stringify(template, null, 2) }] }
      },
    )

    server.registerTool(
      "delete_website_template",
      {
        title: "Delete Website Template",
        description: "Permanently delete a Website Template from the catalog. The Schema Template it followed is unaffected.",
        inputSchema: {
          id: z.string().describe("Website Template id or slug"),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const existing = await db.websiteTemplate.findFirst({ where: { OR: [{ id }, { slug: id }] } })
        if (!existing) return notFound(id)

        if (existing.demoVercelProjectId) {
          const { deleteVercelProject } = await import("@/lib/vercel-client")
          await deleteVercelProject(existing.demoVercelProjectId).catch((err) =>
            console.warn(`[delete_website_template] Failed to delete demo Vercel project for ${existing.slug}:`, err),
          )
        }

        await db.websiteTemplate.delete({ where: { id: existing.id } })
        return { content: [{ type: "text" as const, text: `✅ Website Template '${existing.name}' dihapus.` }] }
      },
    )
  },
  {
    serverInfo: { name: "sacms-global-schema-mcp", version: "1.3.0" },
    instructions:
      "This server manages SaCMS's platform-wide template catalog ONLY — Schema Templates (reusable CMS " +
      "blueprints: Content Types, Single Types, Components) and Website Templates (frontend source bundles " +
      "that follow a Schema Template's structure). It has no access to any tenant's own content, deployment, " +
      "or settings; for that, connect to a workspace's own MCP server at /api/mcp instead. Call " +
      "list_field_types before writing any Schema Template field (it has the real options/relationSlug shape " +
      "per type, and flags options that are silently ignored — never guess one), and list_schema_templates / " +
      "list_website_templates before creating a new one, to avoid a near-duplicate. To build a Website " +
      "Template: get_schema_template first to see exactly what structure the frontend needs to render, " +
      "develop it like any other SaCMS frontend (same conventions as deploy_to_sacms on the per-workspace " +
      "server), then create_website_template with every source file as plain text. Every " +
      "create_website_template and update_website_template(files: ...) call automatically (re)deploys a " +
      "live preview at https://demo-<slug>.sites.sacms.cloud, fed by sample content — never a real customer's " +
      "data — so you can test in a real browser before publishing. The response includes `demoUrl` (and " +
      "`demoDeployment.error` if the deploy itself failed — the save still succeeds either way, just retry " +
      "update_website_template with the same files to redeploy). A metadata-only update (no `files`) does " +
      "not redeploy.",
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
