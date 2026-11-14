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

/**
 * Shared output shape + serializer for get_website_template/
 * create_website_template/update_website_template — all three return the
 * same WebsiteTemplate row shape (Prisma Dates converted to ISO strings,
 * since structuredContent is validated against this zod shape directly,
 * not after a JSON.stringify round-trip that would've done it for free).
 */
const WEBSITE_TEMPLATE_OUTPUT_SHAPE = {
  id: z.string(), name: z.string(), slug: z.string(), schemaTemplateId: z.string(), icon: z.string(),
  description: z.string().nullable(), files: z.array(z.object({ path: z.string(), content: z.string() })),
  published: z.boolean(), createdAt: z.string(), updatedAt: z.string(),
  demoVercelProjectId: z.string().nullable(), demoUrl: z.string().nullable(),
  demoDeployedAt: z.string().nullable(), demoDeploymentId: z.string().nullable(),
}

function serializeWebsiteTemplate(t: {
  createdAt: Date
  updatedAt: Date
  demoDeployedAt: Date | null
  [key: string]: unknown
}) {
  return {
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    demoDeployedAt: t.demoDeployedAt ? t.demoDeployedAt.toISOString() : null,
  }
}

/** The demoDeployment sub-object every create/update_website_template response carries. */
const DEMO_DEPLOYMENT_OUTPUT_SHAPE = z.object({
  status: z.enum(["ok", "failed", "skipped"]),
  error: z.string().optional(),
  deploymentId: z.string().optional(),
  verified: z.boolean().optional(),
  verificationError: z.string().optional(),
})

function describeDemoDeployment(demo: { url: string | null; deploymentId?: string; verified?: boolean; verificationError?: string; error?: string }) {
  return demo.url
    ? { status: "ok" as const, deploymentId: demo.deploymentId, verified: demo.verified, verificationError: demo.verificationError }
    : { status: "failed" as const, error: demo.error, deploymentId: demo.deploymentId }
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

/** Shared slug-collision-retry loop — used by create_schema_template and create_website_template's own slug, and (new) a Schema Template auto-created inline by create_website_template. */
async function dedupeSlug(baseSlug: string, exists: (slug: string) => Promise<unknown>): Promise<string> {
  let slug = baseSlug
  let suffix = 1
  while (await exists(slug)) {
    slug = `${baseSlug}-${++suffix}`
  }
  return slug
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
        outputSchema: {
          totalCount: z.number(),
          categories: z.array(z.string()),
          fieldTypes: z.array(z.any()),
          usageNote: z.string(),
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

        const structured = {
          totalCount: fieldDocs.length,
          categories: FIELD_CATEGORIES,
          fieldTypes: fieldDocs,
          usageNote: "Put these in each model's `fields` array inside create_schema_template/update_schema_template's `schema`. `note` (when present) flags a dead option or an easy-to-miss real capability — read it before guessing.",
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
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
        outputSchema: {
          templates: z.array(z.object({
            id: z.string(), name: z.string(), slug: z.string(), category: z.string(), icon: z.string(),
            description: z.string().nullable(), published: z.boolean(), createdAt: z.string(), updatedAt: z.string(),
          })),
        },
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const rows = await db.schemaTemplate.findMany({
          orderBy: { createdAt: "desc" },
          select: {
            id: true, name: true, slug: true, category: true, icon: true,
            description: true, published: true, createdAt: true, updatedAt: true,
          },
        })
        const templates = rows.map((t) => ({ ...t, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() }))
        const structured = { templates }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(templates, null, 2) }],
          structuredContent: structured,
        }
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
        outputSchema: {
          id: z.string(), name: z.string(), slug: z.string(), category: z.string(), icon: z.string(),
          description: z.string().nullable(), schema: z.any(), published: z.boolean(),
          demoTenantId: z.string().nullable(), createdAt: z.string(), updatedAt: z.string(),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const template = await db.schemaTemplate.findFirst({ where: { OR: [{ id }, { slug: id }] } })
        if (!template) return notFound(id)
        const structured = { ...template, createdAt: template.createdAt.toISOString(), updatedAt: template.updatedAt.toISOString() }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        }
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
        outputSchema: {
          id: z.string(), name: z.string(), slug: z.string(), category: z.string(), icon: z.string(),
          description: z.string().nullable(), schema: z.any(), published: z.boolean(),
          demoTenantId: z.string().nullable(), createdAt: z.string(), updatedAt: z.string(),
        },
      },
      async ({ name, category, icon, description, schema, published }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const parsedSchema = schemaTemplateBundleSchema.safeParse(schema)
        if (!parsedSchema.success) return invalidSchema(parsedSchema.error)

        const slug = await dedupeSlug(slugify(name), (s) => db.schemaTemplate.findUnique({ where: { slug: s } }))

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
        const structured = { ...template, createdAt: template.createdAt.toISOString(), updatedAt: template.updatedAt.toISOString() }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        }
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
        outputSchema: {
          id: z.string(), name: z.string(), slug: z.string(), category: z.string(), icon: z.string(),
          description: z.string().nullable(), schema: z.any(), published: z.boolean(),
          demoTenantId: z.string().nullable(), createdAt: z.string(), updatedAt: z.string(),
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
        const structured = { ...template, createdAt: template.createdAt.toISOString(), updatedAt: template.updatedAt.toISOString() }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        }
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
        outputSchema: {
          templates: z.array(z.object({
            id: z.string(), name: z.string(), slug: z.string(), schemaTemplateId: z.string(), icon: z.string(),
            description: z.string().nullable(), published: z.boolean(), createdAt: z.string(), updatedAt: z.string(),
            demoUrl: z.string().nullable(), schemaTemplate: z.object({ name: z.string(), slug: z.string() }),
          })),
        },
      },
      async ({ schemaTemplateId }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const rows = await db.websiteTemplate.findMany({
          where: schemaTemplateId ? { schemaTemplateId } : {},
          orderBy: { createdAt: "desc" },
          select: {
            id: true, name: true, slug: true, schemaTemplateId: true, icon: true,
            description: true, published: true, createdAt: true, updatedAt: true, demoUrl: true,
            schemaTemplate: { select: { name: true, slug: true } },
          },
        })
        const templates = rows.map((t) => ({ ...t, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() }))
        const structured = { templates }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(templates, null, 2) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "get_website_template",
      {
        title: "Get Website Template",
        description: "Get one Website Template's full detail, including its complete `files` array (path + content for every source file) and its demo deployment state (demoUrl/demoDeploymentId) — use `files` as the base for a changedFiles/deletedFiles patch via update_website_template instead of regenerating the whole bundle for a small edit.",
        inputSchema: {
          id: z.string().describe("Website Template id or slug"),
        },
        outputSchema: WEBSITE_TEMPLATE_OUTPUT_SHAPE,
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const template = await db.websiteTemplate.findFirst({
          where: { OR: [{ id }, { slug: id }] },
          include: { schemaTemplate: { select: { id: true, name: true, slug: true } } },
        })
        if (!template) return notFound(id)
        const structured = serializeWebsiteTemplate(template)
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "create_website_template",
      {
        title: "Create Website Template",
        description:
          "Create a new Website Template — a frontend source bundle (Next.js app files, text/code only, no " +
          "binary assets) PLUS the CMS schema it renders, built together in one call. Pass `schema` to define " +
          "a brand-new structure for this frontend (the common case — SaCMS auto-creates the backing Schema " +
          "Template for you, you never need to call create_schema_template separately). Pass `schemaTemplateId` " +
          "instead only when deliberately reusing an EXISTING Schema Template for a second frontend skin — " +
          "call list_schema_templates/get_schema_template first to find it. Exactly one of the two is required. " +
          "Call list_website_templates first either way, to avoid creating a near-duplicate. IMPORTANT: include a " +
          "`.env.example` file in `files` listing every env var the frontend reads from process.env — " +
          "\"Terapkan\" parses it and auto-creates matching custom env vars on the workspace's Environment " +
          "tab at apply time. If your frontend doesn't use SaCMS's own fixed names (NEXT_PUBLIC_SACMS_API_URL / " +
          "NEXT_PUBLIC_SACMS_TENANT / SACMS_API_KEY) — e.g. it reads NEXT_PUBLIC_API_URL instead — write the " +
          "value as the literal placeholder `{{SACMS_API_URL}}`, `{{SACMS_TENANT_SLUG}}`, or `{{SACMS_API_KEY}}` " +
          "and it resolves to that workspace's REAL production value on apply, instead of staying empty for " +
          "the customer to guess. Any other var (e.g. NEXT_PUBLIC_SITE_NAME=) is created with its literal " +
          "default value, editable later on the Environment tab.",
        inputSchema: {
          schemaTemplateId: z.string().optional().describe("Reuse an EXISTING Schema Template's structure (id or slug) instead of defining a new one via `schema`. Mutually exclusive with `schema`."),
          schema: schemaTemplateBundleSchema.optional().describe(
            "Define this frontend's CMS structure inline — { groups?: [...], contentTypes: [...], singleTypes: [...], components: [...] }, same shape as create_schema_template's own `schema`. " +
            "Call list_field_types FIRST — it has the real options/relationSlug shape and entry-value shape per field type, and flags options that look plausible but are silently ignored. Never guess one. " +
            "SaCMS auto-creates the backing Schema Template for you (named/categorized from this call's `name`/`category`). Mutually exclusive with `schemaTemplateId`.",
          ),
          category: z.string().min(1).max(100).optional().describe("Catalog category for the auto-created backing Schema Template when `schema` is given (e.g. 'Business', 'Blog & News'). Ignored when `schemaTemplateId` is given. Defaults to 'Custom'."),
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
        outputSchema: {
          ...WEBSITE_TEMPLATE_OUTPUT_SHAPE,
          demoDeployment: DEMO_DEPLOYMENT_OUTPUT_SHAPE,
        },
      },
      async ({ schemaTemplateId, schema, category, name, icon, description, files, published }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        if (!schemaTemplateId && !schema) {
          return {
            content: [{ type: "text" as const, text: "❌ Berikan salah satu: `schemaTemplateId` (pakai Schema Template yang sudah ada) ATAU `schema` (buat Schema Template baru otomatis untuk frontend ini)." }],
            isError: true,
          }
        }
        if (schemaTemplateId && schema) {
          return {
            content: [{ type: "text" as const, text: "❌ Berikan HANYA salah satu dari `schemaTemplateId` atau `schema`, bukan keduanya — keduanya menyatakan maksud yang berbeda (pakai schema lama vs buat schema baru)." }],
            isError: true,
          }
        }

        let schemaTemplate: { id: string; slug: string; name: string; schema: unknown; demoTenantId: string | null }
        if (schemaTemplateId) {
          const found = await db.schemaTemplate.findFirst({
            where: { OR: [{ id: schemaTemplateId }, { slug: schemaTemplateId }] },
            select: { id: true, slug: true, name: true, schema: true, demoTenantId: true },
          })
          if (!found) {
            return {
              content: [{ type: "text" as const, text: `❌ Schema Template '${schemaTemplateId}' tidak ditemukan. Panggil list_schema_templates untuk melihat id/slug yang valid.` }],
              isError: true,
            }
          }
          schemaTemplate = found
        } else {
          const parsedBundle = schemaTemplateBundleSchema.safeParse(schema)
          if (!parsedBundle.success) return invalidSchema(parsedBundle.error)
          const schemaSlug = await dedupeSlug(slugify(name), (s) => db.schemaTemplate.findUnique({ where: { slug: s } }))
          const createdSchemaTemplate = await db.schemaTemplate.create({
            data: {
              name,
              slug: schemaSlug,
              category: category || "Custom",
              icon: icon || "📦",
              description: null,
              schema: parsedBundle.data,
              published: false,
            },
          })
          schemaTemplate = createdSchemaTemplate
        }

        const parsedFiles = websiteTemplateFilesSchema.safeParse(files)
        if (!parsedFiles.success) return invalidSchema(parsedFiles.error)

        const slug = await dedupeSlug(slugify(name), (s) => db.websiteTemplate.findUnique({ where: { slug: s } }))

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

        // Re-read rather than patch the in-memory `template` by hand —
        // deployWebsiteTemplateDemo persists the authoritative demo* fields
        // itself (or leaves them untouched on a hard failure), so this is
        // the one query that can't drift from what it actually wrote.
        const saved = (await db.websiteTemplate.findUnique({ where: { id: template.id } })) || template
        const structured = { ...serializeWebsiteTemplate(saved), demoDeployment: describeDemoDeployment(demo) }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "update_website_template",
      {
        title: "Update Website Template",
        description:
          "Update an existing Website Template's metadata, files, schema, and/or published status. For a " +
          "TARGETED edit (\"ubah warna header\", \"ganti font\"), prefer changedFiles/deletedFiles over files — " +
          "call get_website_template first if you don't already have the current bundle in this conversation, " +
          "then send only what actually changed; SaCMS merges it onto the full stored bundle so you never risk " +
          "silently dropping an untouched file. Passing `files` instead REPLACES the whole bundle wholesale — " +
          "only use that for a full rewrite, and include every file you want to keep. Pass `schema` to revise " +
          "the backing Schema Template's structure in the same call as a frontend edit (e.g. adding a field the " +
          "new UI needs) — full replacement like `files`, include every model you want to keep.",
        inputSchema: {
          id: z.string().describe("Website Template id or slug"),
          name: z.string().min(1).max(150).optional(),
          icon: z.string().max(10).optional(),
          description: z.string().max(500).optional(),
          files: websiteTemplateFilesSchema.optional().describe("Full replacement for the file bundle. Do not combine with changedFiles/deletedFiles — pick one."),
          changedFiles: z.array(z.object({ path: z.string().trim().min(1).max(300), content: z.string().max(200_000) })).optional().describe("Only the files being added or changed — every other file in the stored bundle is kept as-is."),
          deletedFiles: z.array(z.string()).optional().describe("File paths to remove from the stored bundle entirely."),
          schema: schemaTemplateBundleSchema.optional().describe("Full replacement for the backing Schema Template's groups/contentTypes/singleTypes/components. Call list_field_types first — don't guess an options shape."),
          published: z.boolean().optional(),
        },
        outputSchema: {
          ...WEBSITE_TEMPLATE_OUTPUT_SHAPE,
          demoDeployment: DEMO_DEPLOYMENT_OUTPUT_SHAPE.optional(),
        },
      },
      async ({ id, name, icon, description, files, changedFiles, deletedFiles, schema, published }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        if (files !== undefined && (changedFiles !== undefined || deletedFiles !== undefined)) {
          return {
            content: [{ type: "text" as const, text: "❌ Berikan `files` ATAU `changedFiles`/`deletedFiles`, bukan keduanya — keduanya menyatakan maksud yang berbeda (ganti seluruh bundle vs ubah sebagian)." }],
            structuredContent: { ok: false, code: "INVALID_ARGUMENT", message: "files is mutually exclusive with changedFiles/deletedFiles." },
            isError: true,
          }
        }

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
        } else if (changedFiles !== undefined || deletedFiles !== undefined) {
          // Merge onto the bundle already persisted on this row — the DB
          // row IS the full source of truth here (unlike the per-workspace
          // deploy_to_sacms flow, there's no separate "ask Vercel what it
          // has" step needed), so a patch update is a cheap, safe merge.
          const base = existing.files as unknown as { path: string; content: string }[]
          const fileMap = new Map(base.map((f) => [f.path, f] as const))
          for (const f of changedFiles || []) fileMap.set(f.path, f)
          for (const path of deletedFiles || []) fileMap.delete(path)
          const merged = Array.from(fileMap.values())
          const parsedFiles = websiteTemplateFilesSchema.safeParse(merged)
          if (!parsedFiles.success) return invalidSchema(parsedFiles.error)
          filesData = parsedFiles.data
        }

        let schemaUpdated = false
        if (schema !== undefined) {
          const parsedBundle = schemaTemplateBundleSchema.safeParse(schema)
          if (!parsedBundle.success) return invalidSchema(parsedBundle.error)
          await db.schemaTemplate.update({ where: { id: existing.schemaTemplate.id }, data: { schema: parsedBundle.data } })
          schemaUpdated = true
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

        // A real file OR schema change warrants a redeploy (the demo needs
        // to reflect either) — a metadata-only edit (name/icon/description/
        // published) shouldn't rebuild it.
        if (filesData !== undefined || schemaUpdated) {
          // Re-fetch rather than reuse `existing.schemaTemplate` — that
          // closure is stale the moment `schemaUpdated` just wrote a new
          // schema blob, and the demo must seed against the NEW one.
          const freshSchemaTemplate = schemaUpdated
            ? await db.schemaTemplate.findUnique({ where: { id: existing.schemaTemplate.id } })
            : existing.schemaTemplate
          const { deployWebsiteTemplateDemo } = await import("@/lib/infrastructure/deploy-website-template-demo")
          const demo = await deployWebsiteTemplateDemo({
            id: template.id,
            slug: template.slug,
            files: filesData ?? (template.files as unknown as { path: string; content: string }[]),
            schemaTemplate: freshSchemaTemplate || existing.schemaTemplate,
          })
          const saved = (await db.websiteTemplate.findUnique({ where: { id: template.id } })) || template
          const structured = { ...serializeWebsiteTemplate(saved), demoDeployment: describeDemoDeployment(demo) }
          return {
            content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
            structuredContent: structured,
          }
        }

        const structured = { ...serializeWebsiteTemplate(template), demoDeployment: { status: "skipped" as const } }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        }
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
    serverInfo: { name: "sacms-global-schema-mcp", version: "1.5.0" },
    instructions:
      "This server manages SaCMS's platform-wide template catalog ONLY — Schema Templates (reusable CMS " +
      "blueprints: Content Types, Single Types, Components) and Website Templates (frontend source bundles " +
      "that follow a Schema Template's structure). It has no access to any tenant's own content, deployment, " +
      "or settings; for that, connect to a workspace's own MCP server at /api/mcp instead. Call " +
      "list_field_types before writing any schema field (it has the real options/relationSlug shape per type, " +
      "and flags options that are silently ignored — never guess one), and list_website_templates before " +
      "creating a new one, to avoid a near-duplicate. BUILD SCHEMA AND FRONTEND TOGETHER in one call: pass " +
      "`schema` directly to create_website_template — it auto-creates the backing Schema Template for you, no " +
      "separate create_schema_template step needed for the common case. Only use `schemaTemplateId` (and the " +
      "standalone create_schema_template/update_schema_template/list_schema_templates/get_schema_template " +
      "tools) when deliberately reusing an existing structure for a second frontend skin. Every " +
      "create_website_template and update_website_template(files/changedFiles/schema: ...) call automatically " +
      "(re)deploys a live preview at https://demo-<slug>.sites.sacms.cloud, fed by sample content — never a " +
      "real customer's data — so you can test in a real browser before publishing. The response's " +
      "`demoDeployment` reports `status` (ok/failed/skipped), `verified` (SaCMS actually fetched the URL and " +
      "confirmed it renders — Vercel accepting the build is NOT the same as it working), and `error`/" +
      "`verificationError` when something's wrong; `status: \"ok\"` alone doesn't mean verified is true, check " +
      "both before telling a human the preview is ready. A metadata-only update (no files/changedFiles/schema) " +
      "returns `demoDeployment.status: \"skipped\"` and does not redeploy. For a TARGETED revision of an " +
      "existing template (\"ubah warna header\"), call get_website_template to see the current bundle, then " +
      "update_website_template with changedFiles/deletedFiles instead of resending every file via `files`.",
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
