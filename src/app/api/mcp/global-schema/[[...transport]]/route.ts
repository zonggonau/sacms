/**
 * Platform "Developer" — Schema Template MCP Server
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
 *    Subscription row. The catalog this server manages has no tenant
 *    owner at all (WebsiteTemplate/SchemaTemplate carry no tenantId), so
 *    gating it behind a workspace subscription makes no sense in the
 *    first place.
 * 2. Schema Template tools have NO business being callable with every
 *    other workspace's own `mcp_...` token — keeping them on a separate
 *    server with its own `mcpglobal_...` token type means a leaked/misused
 *    workspace token can never reach this catalog, and vice versa.
 *
 * Auth: Standard HTTP Bearer token (Authorization: Bearer <mcpglobal_...>),
 * minted from /admin/developer/mcp (see src/actions/mcp-tokens.ts) — a
 * platform-level token with no tenant attached at all.
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
import { FIELD_TYPE_GUIDE, CONTENT_API_CONTRACT_EXAMPLES } from "@/lib/field-type-guide"
import { formatZodPath, validateBundleReferences } from "@/lib/schema-template-validation"

// ─── Auth ────────────────────────────────────────────────────────────────

// This token type carries no tenant at all (ApiToken.tenantId: null) — the
// Website/Schema Template catalog it authenticates against has no tenant
// owner either (see prisma/schema.prisma). The former "SaCMS Global"
// workspace this used to be minted under has been retired; auth here is
// just "does a live mcp-global-schema token with this hash exist", nothing
// tenant-shaped to re-verify.
interface GlobalAuthContext {
  authenticated: true
}

const authContext = new AsyncLocalStorage<GlobalAuthContext>()

export async function resolveGlobalSchemaToken(rawToken: string): Promise<GlobalAuthContext | null> {
  if (!rawToken?.trim()) return null
  const clean = rawToken.trim()
  const hashed = createHash("sha256").update(clean).digest("hex")

  const token = await db.apiToken.findFirst({
    where: { OR: [{ token: hashed }, { token: clean }], type: "mcp-global-schema" },
    select: { id: true },
  })
  if (!token) return null

  db.apiToken
    .updateMany({
      where: { OR: [{ token: hashed }, { token: clean }], type: "mcp-global-schema" },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {})

  return { authenticated: true }
}

// chatgpt8.md P1 ("use one consistent error code"): this used to carry
// neither `structuredContent` nor `isError: true` — on any tool that
// declares an outputSchema (effectively every tool in this file), the MCP
// SDK's validateToolOutput treats a result with no structuredContent AND no
// isError as a malformed SUCCESS and throws its own generic
// "Output validation error: ... no structured content was provided"
// instead of surfacing this unauthorized message at all.
const UNAUTHORIZED = {
  content: [{
    type: "text" as const,
    text: "❌ Unauthorized: Invalid or missing API token for the SaCMS Global Schema Template MCP server.",
  }],
  structuredContent: { ok: false, code: "UNAUTHORIZED", message: "Invalid or missing API token." },
  isError: true,
}

// Thrown from inside create_website_template's db.$transaction callback
// when a caller-supplied schemaTemplateId doesn't resolve — lets the
// outer catch distinguish "ordinary not-found" from a genuine DB error
// after the transaction has already rolled back.
class SchemaTemplateNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Schema Template '${id}' not found`)
  }
}

// A real, confirmed bug (chatgpt7.md): this used to hardcode "Schema
// Template" regardless of which entity was actually missing — looking up
// a nonexistent Website Template by slug came back saying "Schema
// Template '...' tidak ditemukan", and with no structured `code` at all
// (an agent checking for NOT_FOUND specifically had nothing to match on).
function notFound(entity: "Schema Template" | "Website Template", id: string) {
  return {
    content: [{ type: "text" as const, text: `❌ ${entity} '${id}' tidak ditemukan.` }],
    structuredContent: { ok: false, code: "NOT_FOUND", message: `${entity} not found.` },
    isError: true,
  }
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
  // chatgpt.md P1: pass THIS back as expectedVersion, not `updatedAt` —
  // `updatedAt` is bumped by every redeploy (even a metadata-only one with
  // no source change), while sourceVersion only moves when files/schema
  // genuinely change. See update_website_template's CONFLICT check.
  sourceVersion: z.string(),
  demoVercelProjectId: z.string().nullable(), demoUrl: z.string().nullable(),
  demoDeployedAt: z.string().nullable(), demoDeploymentId: z.string().nullable(),
}

function serializeWebsiteTemplate(t: {
  createdAt: Date
  updatedAt: Date
  sourceVersion: Date
  demoDeployedAt: Date | null
  [key: string]: unknown
}) {
  return {
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    sourceVersion: t.sourceVersion.toISOString(),
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

// chatgpt8.md P0: create_website_template's `dryRun: true` branch never
// creates or deploys anything, so its response shares no real fields with a
// genuine create's row — it used to be validated against
// WEBSITE_TEMPLATE_OUTPUT_SHAPE (id/name/slug/files/...) regardless, so the
// MCP SDK's output-schema check (server/mcp.js's validateToolOutput, which
// only skips validation when isError is true) rejected EVERY valid dry-run
// result at the protocol layer before it ever reached the calling agent. A
// separate shape — unioned into create_website_template's own outputSchema
// below — instead of cramming both shapes into one object with every field
// optional, which would have let a REAL create response silently pass
// validation while missing fields it's supposed to always have.
const DRY_RUN_OUTPUT_SHAPE = z.object({
  mode: z.literal("dry_run"),
  ok: z.literal(true),
  valid: z.literal(true),
  issues: z.array(z.object({ path: z.string(), message: z.string() })),
  warnings: z.array(z.object({ path: z.string(), message: z.string() })),
})

function invalidSchema(error: z.ZodError) {
  const issues = error.issues.map((i) => ({ path: formatZodPath(i.path), message: i.message }))
  return {
    content: [{
      type: "text" as const,
      text: `❌ Schema tidak valid:\n${issues.map((i) => `- ${i.path}: ${i.message}`).join("\n")}`,
    }],
    structuredContent: { ok: false, code: "VALIDATION_FAILED", issues, message: `${issues.length} validation issue(s) found.` },
    isError: true,
  }
}

function referenceIssuesResponse(issues: { path: string; message: string }[]) {
  return {
    content: [{ type: "text" as const, text: `❌ Ditemukan ${issues.length} masalah referensi/opsi:\n${issues.map((i) => `- ${i.path}: ${i.message}`).join("\n")}` }],
    structuredContent: { ok: false, code: "VALIDATION_FAILED", issues, message: `${issues.length} validation issue(s) found.` },
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
          "allowedTypes) — this flags those explicitly so you don't guess an options shape that does nothing. " +
          "Also returns `contentApiContract`: real request/response examples for the frontend's actual Content " +
          "API calls (a collection list, a single entry, a populated relation) and what the demo fixture does " +
          "and doesn't seed — read that before scaffolding any fetch call in the frontend you're building.",
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
          contentApiContract: z.any(),
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
          contentApiContract: CONTENT_API_CONTRACT_EXAMPLES,
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

        // No sourceVersion here deliberately — this listing is metadata-only
        // (no schema blob either); get_schema_template is the canonical
        // place to read the version to use for a later expectedVersion.
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
          // chatgpt.md P1: pass THIS back as update_schema_template's
          // expectedVersion, not `updatedAt` (which also moves on the
          // one-time demoTenantId write a first demo deploy makes).
          sourceVersion: z.string(),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const template = await db.schemaTemplate.findFirst({ where: { OR: [{ id }, { slug: id }] } })
        if (!template) return notFound("Schema Template", id)
        const structured = { ...template, createdAt: template.createdAt.toISOString(), updatedAt: template.updatedAt.toISOString(), sourceVersion: template.sourceVersion.toISOString() }
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
          sourceVersion: z.string(),
        },
      },
      async ({ name, category, icon, description, schema, published }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const parsedSchema = schemaTemplateBundleSchema.safeParse(schema)
        if (!parsedSchema.success) return invalidSchema(parsedSchema.error)

        const refIssues = validateBundleReferences(parsedSchema.data)
        if (refIssues.length > 0) return referenceIssuesResponse(refIssues)

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
        const structured = { ...template, createdAt: template.createdAt.toISOString(), updatedAt: template.updatedAt.toISOString(), sourceVersion: template.sourceVersion.toISOString() }
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
          "field, so include every model you want to keep. This Schema Template may be shared by more than one " +
          "Website Template (a second frontend skin reusing it via schemaTemplateId) — changing `schema` here " +
          "changes what ALL of them render from, immediately, since they all point at this same row. Call " +
          "list_website_templates with schemaTemplateId first to see who's affected; if any exist, a structural " +
          "`schema` change refuses with code HAS_DEPENDENTS (listing them) unless confirmSharedUpdate: true.",
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
          expectedVersion: z.string().optional().describe("The `sourceVersion` you last read for this template (from get_schema_template) — NOT `updatedAt`, which also moves on a first demo deploy's one-time bookkeeping write even with no `schema` change. If someone else changed `schema` since, this rejects with code: \"CONFLICT\" instead of silently overwriting their change — re-read and retry with the fresh value."),
          confirmSharedUpdate: z.boolean().optional().describe("Required (after confirming with the user) when `schema` is being changed AND one or more Website Templates already follow this Schema Template — see this tool's own description."),
        },
        outputSchema: {
          id: z.string(), name: z.string(), slug: z.string(), category: z.string(), icon: z.string(),
          description: z.string().nullable(), schema: z.any(), published: z.boolean(),
          demoTenantId: z.string().nullable(), createdAt: z.string(), updatedAt: z.string(),
          sourceVersion: z.string(),
        },
      },
      async ({ id, name, category, icon, description, schema, published, expectedVersion, confirmSharedUpdate }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const existing = await db.schemaTemplate.findFirst({ where: { OR: [{ id }, { slug: id }] } })
        if (!existing) return notFound("Schema Template", id)

        if (expectedVersion && existing.sourceVersion.toISOString() !== expectedVersion) {
          return {
            content: [{ type: "text" as const, text: `⚠️ Conflict: '${existing.name}' sudah diubah sejak ${expectedVersion} — versi saat ini ${existing.sourceVersion.toISOString()}. Panggil get_schema_template lagi untuk melihat versi terbaru sebelum menimpa perubahan yang belum kamu lihat.` }],
            structuredContent: { ok: false, code: "CONFLICT", currentVersion: existing.sourceVersion.toISOString(), message: "This template's schema was changed since expectedVersion was read." },
            isError: true,
          }
        }

        let schemaData: z.infer<typeof schemaTemplateBundleSchema> | undefined
        if (schema !== undefined) {
          const parsedSchema = schemaTemplateBundleSchema.safeParse(schema)
          if (!parsedSchema.success) return invalidSchema(parsedSchema.error)
          const refIssues = validateBundleReferences(parsedSchema.data)
          if (refIssues.length > 0) return referenceIssuesResponse(refIssues)

          if (!confirmSharedUpdate) {
            const dependents = await db.websiteTemplate.findMany({ where: { schemaTemplateId: existing.id }, select: { id: true, name: true, slug: true } })
            if (dependents.length > 0) {
              return {
                content: [{
                  type: "text" as const,
                  text: `❌ '${existing.name}' dipakai oleh ${dependents.length} Website Template: ${dependents.map((d) => `'${d.name}' (${d.slug})`).join(", ")}. Mengubah struktur schema ini langsung mengubah apa yang ditampilkan SEMUANYA, karena mereka berbagi row yang sama. Konfirmasi dulu ke pengguna, lalu panggil lagi dengan confirmSharedUpdate: true.`,
                }],
                structuredContent: {
                  ok: false,
                  code: "HAS_DEPENDENTS",
                  dependents: dependents.map((d) => ({ id: d.id, name: d.name, slug: d.slug })),
                  message: "This Schema Template is shared by one or more Website Templates — a structural change affects all of them.",
                },
                isError: true,
              }
            }
          }
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
            // Only a genuine `schema` change moves sourceVersion — a later
            // metadata-only edit, or the one-time demoTenantId write a first
            // demo deploy makes, must never invalidate an expectedVersion
            // read against THIS change.
            ...(schemaData !== undefined ? { sourceVersion: new Date() } : {}),
          },
        })
        const structured = { ...template, createdAt: template.createdAt.toISOString(), updatedAt: template.updatedAt.toISOString(), sourceVersion: template.sourceVersion.toISOString() }
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
        description: "Permanently delete a Schema Template from the catalog. WARNING: WebsiteTemplate.schemaTemplateId cascades on delete at the database level — any Website Template built on this Schema Template would be permanently deleted too, not just left dangling. This refuses by default when dependents exist, listing them, instead of silently cascading; pass confirmCascade: true only after telling the user exactly what else will be deleted.",
        inputSchema: {
          id: z.string().describe("Schema Template id or slug"),
          confirmCascade: z.boolean().optional().describe("Required (after confirming with the user) when this Schema Template still has one or more Website Templates built on it — deleting it WILL cascade-delete those too."),
        },
      },
      async ({ id, confirmCascade }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const existing = await db.schemaTemplate.findFirst({ where: { OR: [{ id }, { slug: id }] } })
        if (!existing) return notFound("Schema Template", id)

        const dependents = await db.websiteTemplate.findMany({
          where: { schemaTemplateId: existing.id },
          select: { id: true, name: true, slug: true },
        })
        if (dependents.length > 0 && !confirmCascade) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ '${existing.name}' masih dipakai oleh ${dependents.length} Website Template: ${dependents.map((d) => `'${d.name}' (${d.slug})`).join(", ")}. Menghapus Schema Template ini akan ikut MENGHAPUS PERMANEN semua Website Template tersebut (cascade di level database, bukan sekadar menjadi dangling). Konfirmasi dulu ke pengguna persis apa yang akan terhapus, lalu panggil lagi dengan confirmCascade: true.`,
            }],
            structuredContent: {
              ok: false,
              code: "HAS_DEPENDENTS",
              dependents: dependents.map((d) => ({ id: d.id, name: d.name, slug: d.slug })),
              message: "This Schema Template still has Website Templates built on it — deleting it would cascade-delete them too.",
            },
            isError: true,
          }
        }

        await db.schemaTemplate.delete({ where: { id: existing.id } })
        return {
          content: [{
            type: "text" as const,
            text: dependents.length > 0
              ? `✅ Template '${existing.name}' dan ${dependents.length} Website Template yang memakainya ikut terhapus.`
              : `✅ Template '${existing.name}' dihapus.`,
          }],
          structuredContent: { ok: true, deletedDependents: dependents.length },
        }
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
        if (!template) return notFound("Website Template", id)
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
          idempotencyKey: z.string().optional().describe("A key unique to THIS submission. If this tool's response is ever lost, retry with the SAME key — you'll get back the already-created template instead of a duplicate (and, when `schema` was given, a second orphaned backing Schema Template). Ignored when dryRun is true."),
          dryRun: z.boolean().optional().describe("Validate everything (files, schema shape, relationSlug/componentSlug/allowedComponents references, select/multiselect choices, schemaTemplateId existence) WITHOUT creating anything or deploying a demo. Returns the same validation errors a real call would reject with, each with an exact path like \"schema.contentTypes[2].fields[4].options.choices\" — call this first for anything non-trivial instead of discovering a mistake only after it's already saved."),
        },
        outputSchema: z.union([
          DRY_RUN_OUTPUT_SHAPE,
          z.object({ ...WEBSITE_TEMPLATE_OUTPUT_SHAPE, demoDeployment: DEMO_DEPLOYMENT_OUTPUT_SHAPE }),
        ]),
      },
      async ({ schemaTemplateId, schema, category, name, icon, description, files, published, idempotencyKey, dryRun }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        // Idempotent replay — before anything else, so a lost response's
        // retry never creates a second template (or, worse, a second
        // orphaned backing Schema Template when `schema` was given). A
        // dry run never writes anything, so it has no idempotency state
        // to consult or consume.
        if (!dryRun && idempotencyKey) {
          const already = await db.websiteTemplate.findUnique({ where: { idempotencyKey } })
          if (already) {
            // No fresh deploy call was made on this replay — describe the
            // demo status from whatever is already persisted on the row.
            const demoDeployment = describeDemoDeployment({
              url: already.demoUrl,
              deploymentId: already.demoDeploymentId ?? undefined,
            })
            const structured = { ...serializeWebsiteTemplate(already), demoDeployment }
            return {
              content: [{ type: "text" as const, text: `🔁 Replay idempoten — Website Template '${already.id}' sudah dibuat untuk idempotencyKey ini.\n${JSON.stringify(structured, null, 2)}` }],
              structuredContent: structured,
            }
          }
        }

        if (!schemaTemplateId && !schema) {
          return {
            content: [{ type: "text" as const, text: "❌ Berikan salah satu: `schemaTemplateId` (pakai Schema Template yang sudah ada) ATAU `schema` (buat Schema Template baru otomatis untuk frontend ini)." }],
            structuredContent: { ok: false, code: "INVALID_ARGUMENT", message: "Provide exactly one of schemaTemplateId or schema." },
            isError: true,
          }
        }
        if (schemaTemplateId && schema) {
          return {
            content: [{ type: "text" as const, text: "❌ Berikan HANYA salah satu dari `schemaTemplateId` atau `schema`, bukan keduanya — keduanya menyatakan maksud yang berbeda (pakai schema lama vs buat schema baru)." }],
            structuredContent: { ok: false, code: "INVALID_ARGUMENT", message: "schemaTemplateId and schema are mutually exclusive." },
            isError: true,
          }
        }

        // Validate EVERYTHING before writing anything — files used to be
        // validated only after a `schema`-given call had already created
        // its backing Schema Template, so an invalid `files` payload left
        // that Schema Template permanently orphaned (a real, confirmed
        // bug class: schema+website creation must be all-or-nothing).
        const parsedFiles = websiteTemplateFilesSchema.safeParse(files)
        if (!parsedFiles.success) return invalidSchema(parsedFiles.error)

        let bundleData: z.infer<typeof schemaTemplateBundleSchema> | undefined
        if (!schemaTemplateId) {
          const parsedBundle = schemaTemplateBundleSchema.safeParse(schema)
          if (!parsedBundle.success) return invalidSchema(parsedBundle.error)
          const refIssues = validateBundleReferences(parsedBundle.data)
          if (refIssues.length > 0) return referenceIssuesResponse(refIssues)
          bundleData = parsedBundle.data
        }

        if (dryRun) {
          // Read-only existence check — the real path's lookup happens
          // INSIDE the transaction below and stays authoritative; this is
          // just early feedback for a call that's never going to write
          // anything regardless.
          if (schemaTemplateId) {
            const found = await db.schemaTemplate.findFirst({ where: { OR: [{ id: schemaTemplateId }, { slug: schemaTemplateId }] }, select: { id: true } })
            if (!found) return notFound("Schema Template", schemaTemplateId)
          }
          const hasEnvExample = parsedFiles.data.some((f) => f.path === ".env.example" || f.path.endsWith("/.env.example"))
          const warnings = hasEnvExample
            ? []
            : [{ path: "files", message: "No .env.example found — this is advisory only (it won't block a real save), but env vars won't be auto-declared on the workspace's Environment tab when a customer applies this template." }]
          return {
            content: [{
              type: "text" as const,
              text: warnings.length > 0
                ? `✅ Valid, dengan catatan:\n${warnings.map((w) => `- ${w.path}: ${w.message}`).join("\n")}`
                : "✅ Valid — tidak ada masalah ditemukan. Panggil lagi tanpa dryRun untuk benar-benar menyimpan.",
            }],
            structuredContent: { mode: "dry_run" as const, ok: true as const, valid: true as const, issues: [] as { path: string; message: string }[], warnings },
          }
        }

        let schemaTemplate: { id: string; slug: string; name: string; schema: unknown; demoTenantId: string | null }
        let template: Awaited<ReturnType<typeof db.websiteTemplate.create>>
        try {
          const result = await db.$transaction(async (tx) => {
            let resolvedSchemaTemplate: typeof schemaTemplate
            if (schemaTemplateId) {
              const found = await tx.schemaTemplate.findFirst({
                where: { OR: [{ id: schemaTemplateId }, { slug: schemaTemplateId }] },
                select: { id: true, slug: true, name: true, schema: true, demoTenantId: true },
              })
              if (!found) throw new SchemaTemplateNotFoundError(schemaTemplateId)
              resolvedSchemaTemplate = found
            } else {
              const schemaSlug = await dedupeSlug(slugify(name), (s) => tx.schemaTemplate.findUnique({ where: { slug: s } }))
              resolvedSchemaTemplate = await tx.schemaTemplate.create({
                data: {
                  name,
                  slug: schemaSlug,
                  category: category || "Custom",
                  icon: icon || "📦",
                  description: null,
                  schema: bundleData!,
                  published: false,
                },
              })
            }

            // Same transaction as the Schema Template create above (when
            // one happened) — a failure here (including the idempotencyKey
            // unique-constraint race below) rolls BOTH back together,
            // instead of leaving that Schema Template orphaned.
            const slug = await dedupeSlug(slugify(name), (s) => tx.websiteTemplate.findUnique({ where: { slug: s } }))
            const createdTemplate = await tx.websiteTemplate.create({
              data: {
                name,
                slug,
                schemaTemplateId: resolvedSchemaTemplate.id,
                icon: icon || "🖥️",
                description: description || null,
                files: parsedFiles.data,
                published: published ?? false,
                idempotencyKey: idempotencyKey || null,
              },
            })
            return { schemaTemplate: resolvedSchemaTemplate, template: createdTemplate }
          })
          schemaTemplate = result.schemaTemplate
          template = result.template
        } catch (err: any) {
          if (err instanceof SchemaTemplateNotFoundError) {
            return {
              content: [{ type: "text" as const, text: `❌ Schema Template '${err.id}' tidak ditemukan. Panggil list_schema_templates untuk melihat id/slug yang valid.` }],
              structuredContent: { ok: false, code: "NOT_FOUND", message: "Schema Template not found." },
              isError: true,
            }
          }
          // A concurrent call claimed this exact idempotencyKey between
          // our own check at the top of this handler and this transaction
          // — re-read and return the winning row as a replay, same as the
          // check at the top, instead of surfacing the raw P2002 error.
          if (idempotencyKey && err?.code === "P2002") {
            const winner = await db.websiteTemplate.findUnique({ where: { idempotencyKey } })
            if (winner) {
              const demoDeployment = describeDemoDeployment({ url: winner.demoUrl, deploymentId: winner.demoDeploymentId ?? undefined })
              const structured = { ...serializeWebsiteTemplate(winner), demoDeployment }
              return {
                content: [{ type: "text" as const, text: `🔁 Replay idempoten — Website Template '${winner.id}' sudah dibuat untuk idempotencyKey ini.\n${JSON.stringify(structured, null, 2)}` }],
                structuredContent: structured,
              }
            }
          }
          throw err
        }

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
          "new UI needs) — full replacement like `files`, include every model you want to keep. That Schema " +
          "Template may be shared by another Website Template (a second frontend skin reusing it via " +
          "schemaTemplateId) — changing `schema` here changes what BOTH render from. A structural `schema` " +
          "change refuses with code HAS_DEPENDENTS (listing the others) unless confirmSharedUpdate: true.",
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
          expectedVersion: z.string().optional().describe("The `sourceVersion` you last read for this template (from get_website_template) — NOT `updatedAt`, which also moves on every demo redeploy even with no source change. If someone else changed files/schema since, this rejects with code: \"CONFLICT\" instead of silently overwriting their change — re-read and retry with the fresh value."),
          confirmSharedUpdate: z.boolean().optional().describe("Required (after confirming with the user) when `schema` is being changed AND another Website Template also follows the same backing Schema Template — see this tool's own description."),
        },
        outputSchema: {
          ...WEBSITE_TEMPLATE_OUTPUT_SHAPE,
          demoDeployment: DEMO_DEPLOYMENT_OUTPUT_SHAPE.optional(),
        },
      },
      async ({ id, name, icon, description, files, changedFiles, deletedFiles, schema, published, expectedVersion, confirmSharedUpdate }) => {
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
        if (!existing) return notFound("Website Template", id)

        if (expectedVersion && existing.sourceVersion.toISOString() !== expectedVersion) {
          return {
            content: [{ type: "text" as const, text: `⚠️ Conflict: '${existing.name}' sudah diubah sejak ${expectedVersion} — versi saat ini ${existing.sourceVersion.toISOString()}. Panggil get_website_template lagi untuk melihat versi terbaru sebelum menimpa perubahan yang belum kamu lihat.` }],
            structuredContent: { ok: false, code: "CONFLICT", currentVersion: existing.sourceVersion.toISOString(), message: "This template's files/schema were changed since expectedVersion was read." },
            isError: true,
          }
        }

        if (schema !== undefined && !confirmSharedUpdate) {
          const siblings = await db.websiteTemplate.findMany({
            where: { schemaTemplateId: existing.schemaTemplate.id, id: { not: existing.id } },
            select: { id: true, name: true, slug: true },
          })
          if (siblings.length > 0) {
            return {
              content: [{
                type: "text" as const,
                text: `❌ Schema Template '${existing.schemaTemplate.name}' juga dipakai oleh ${siblings.length} Website Template lain: ${siblings.map((d) => `'${d.name}' (${d.slug})`).join(", ")}. Mengubah struktur schema di sini langsung mengubah apa yang mereka tampilkan juga, karena semuanya berbagi row yang sama. Konfirmasi dulu ke pengguna, lalu panggil lagi dengan confirmSharedUpdate: true.`,
              }],
              structuredContent: {
                ok: false,
                code: "HAS_DEPENDENTS",
                dependents: siblings.map((d) => ({ id: d.id, name: d.name, slug: d.slug })),
                message: "The backing Schema Template is shared by another Website Template — a structural change affects it too.",
              },
              isError: true,
            }
          }
        }

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
        let parsedBundleData: z.infer<typeof schemaTemplateBundleSchema> | undefined
        if (schema !== undefined) {
          const parsedBundle = schemaTemplateBundleSchema.safeParse(schema)
          if (!parsedBundle.success) return invalidSchema(parsedBundle.error)
          const refIssues = validateBundleReferences(parsedBundle.data)
          if (refIssues.length > 0) return referenceIssuesResponse(refIssues)
          parsedBundleData = parsedBundle.data
          schemaUpdated = true
        }

        // One transaction when both are changing — a website-metadata
        // write failing right after the schema write landed would
        // otherwise leave the two inconsistent with each other.
        const template = await db.$transaction(async (tx) => {
          if (parsedBundleData) {
            await tx.schemaTemplate.update({ where: { id: existing.schemaTemplate.id }, data: { schema: parsedBundleData } })
          }
          return tx.websiteTemplate.update({
            where: { id: existing.id },
            data: {
              ...(name !== undefined ? { name } : {}),
              ...(icon !== undefined ? { icon } : {}),
              ...(description !== undefined ? { description } : {}),
              ...(filesData !== undefined ? { files: filesData } : {}),
              ...(published !== undefined ? { published } : {}),
              // Only a genuine source change moves sourceVersion — the
              // demo redeploy triggered below (files/schema) or any later
              // metadata-only edit must never invalidate an expectedVersion
              // read against THIS change.
              ...(filesData !== undefined || schemaUpdated ? { sourceVersion: new Date() } : {}),
            },
          })
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
        description: "Permanently delete a Website Template from the catalog. The Schema Template it followed is unaffected (deleting a Website Template never cascades the other way). If it has a live demo deployment, that Vercel project is deleted too (best-effort — a failure there is logged but never blocks the Website Template's own deletion).",
        inputSchema: {
          id: z.string().describe("Website Template id or slug"),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const existing = await db.websiteTemplate.findFirst({ where: { OR: [{ id }, { slug: id }] } })
        if (!existing) return notFound("Website Template", id)

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

    server.registerTool(
      "get_website_template_demo_status",
      {
        title: "Get Website Template Demo Status (Read-Only)",
        description: "Read a Website Template's demo deployment status WITHOUT redeploying anything — the build stage of its most recent deploy, a FRESH HTTP check of the demo URL right now (not just whatever was recorded at deploy time), and, when the build errored, a summary of the build log's error lines. Call this instead of create_website_template/update_website_template just to check on an existing demo, and before deciding whether redeploy_website_template_demo is actually needed.",
        inputSchema: {
          id: z.string().describe("Website Template id or slug"),
        },
        outputSchema: {
          deployed: z.boolean(),
          demoUrl: z.string().nullable(),
          deploymentId: z.string().nullable(),
          state: z.string().optional(),
          verified: z.boolean().optional(),
          verificationError: z.string().optional(),
          buildErrorLines: z.array(z.string()).optional(),
          message: z.string(),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const existing = await db.websiteTemplate.findFirst({ where: { OR: [{ id }, { slug: id }] } })
        if (!existing) return notFound("Website Template", id)

        if (!existing.demoVercelProjectId) {
          const structured = {
            deployed: false,
            demoUrl: null,
            deploymentId: null,
            message: "No demo has ever been deployed for this template. Call create_website_template/update_website_template with files, or redeploy_website_template_demo, to deploy one.",
          }
          return { content: [{ type: "text" as const, text: structured.message }], structuredContent: structured }
        }

        const { getDeploymentStatus, getLatestDeployment, getDeploymentBuildLogs } = await import("@/lib/vercel-client")
        const { verifyDemoUrl } = await import("@/lib/infrastructure/deploy-website-template-demo")

        const status = existing.demoDeploymentId
          ? await getDeploymentStatus(existing.demoDeploymentId).catch(() => null)
          : await getLatestDeployment(existing.demoVercelProjectId).catch(() => null)

        const verification = existing.demoUrl ? await verifyDemoUrl(existing.demoUrl) : { verified: false, error: "No demo URL recorded." }

        // chatgpt.md P0: a build this ERRORED never gets promoted onto the
        // alias — the alias just keeps serving whatever deployment was
        // last successful. That means `verification.verified` above can be
        // `true` purely because an OLDER build still works, even while the
        // LATEST build is broken. Reporting `verified: true` in that case
        // would tell a caller the demo reflects their latest change when it
        // actually doesn't — the build's own terminal state must win over
        // a URL check that may be looking at stale content.
        const buildFailed = !!status?.state && /ERROR|FAILED/i.test(status.state)

        let buildErrorLines: string[] | undefined
        const deploymentIdForLogs = existing.demoDeploymentId || (status as any)?.id
        if (buildFailed && deploymentIdForLogs) {
          const logs = await getDeploymentBuildLogs(deploymentIdForLogs).catch(() => null)
          if (logs) buildErrorLines = logs.errorLines.slice(-20)
        }

        const structured = {
          deployed: true,
          demoUrl: existing.demoUrl,
          deploymentId: existing.demoDeploymentId,
          state: status?.state,
          verified: buildFailed ? false : verification.verified,
          verificationError: buildFailed
            ? `Latest build ${status?.state}.${verification.verified ? " The URL above is still serving a PREVIOUS successful deployment, not this one." : ""} Check buildErrorLines.`
            : verification.error,
          buildErrorLines,
          message: buildFailed
            ? `Latest build FAILED (${status?.state}) — this demo does NOT reflect the latest changes${verification.verified ? ", even though its URL still responds (serving an older deployment)" : ""}. Check buildErrorLines, fix the source, and call redeploy_website_template_demo.`
            : verification.verified
              ? `Demo is live and rendering at ${existing.demoUrl}.`
              : `Demo is NOT currently verified: ${verification.error || "unknown reason"}. Call redeploy_website_template_demo to try a fresh deploy.`,
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "redeploy_website_template_demo",
      {
        title: "Redeploy Website Template Demo",
        description: "Re-deploy a Website Template's demo using its CURRENTLY STORED files and schema — no need to resend anything. Use this to retry after a failed demo build (check get_website_template_demo_status / get_deployment_build_logs-equivalent info first to see why), or just to force a fresh deploy+verification without changing anything about the template itself.",
        inputSchema: {
          id: z.string().describe("Website Template id or slug"),
        },
        outputSchema: {
          ...WEBSITE_TEMPLATE_OUTPUT_SHAPE,
          demoDeployment: DEMO_DEPLOYMENT_OUTPUT_SHAPE,
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const existing = await db.websiteTemplate.findFirst({
          where: { OR: [{ id }, { slug: id }] },
          include: { schemaTemplate: { select: { id: true, slug: true, name: true, schema: true, demoTenantId: true } } },
        })
        if (!existing) return notFound("Website Template", id)

        const { deployWebsiteTemplateDemo } = await import("@/lib/infrastructure/deploy-website-template-demo")
        const demo = await deployWebsiteTemplateDemo({
          id: existing.id,
          slug: existing.slug,
          files: existing.files as unknown as { path: string; content: string }[],
          schemaTemplate: existing.schemaTemplate,
        })

        const saved = (await db.websiteTemplate.findUnique({ where: { id: existing.id } })) || existing
        const structured = { ...serializeWebsiteTemplate(saved), demoDeployment: describeDemoDeployment(demo) }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        }
      },
    )
  },
  {
    serverInfo: { name: "sacms-global-schema-mcp", version: "1.9.0" },
    instructions:
      "This server manages SaCMS's platform-wide template catalog ONLY — Schema Templates (reusable CMS " +
      "blueprints: Content Types, Single Types, Components) and Website Templates (frontend source bundles " +
      "that follow a Schema Template's structure). It has no access to any tenant's own content, deployment, " +
      "or settings; for that, connect to a workspace's own MCP server at /api/mcp instead. Call " +
      "list_field_types before writing any schema field (it has the real options/relationSlug shape per type, " +
      "and flags options that are silently ignored — never guess one). Its entry for richText/markdown also " +
      "tells you how the FRONTEND you're writing must render that field: richText's value is REAL HTML (from " +
      "a WYSIWYG editor) and needs a sanitized dangerouslySetInnerHTML, never `{value}`/string interpolation — " +
      "confirmed live, a template that renders it as plain text only looks fine with unwrapped test prose and " +
      "shows literal <p>/<strong>/<ul> tags the moment real formatted content is used; markdown's value is raw " +
      "Markdown source and needs a Markdown renderer (react-markdown or equivalent), not an HTML sink. And " +
      "list_website_templates before " +
      "creating a new one, to avoid a near-duplicate. BUILD SCHEMA AND FRONTEND TOGETHER in one call: pass " +
      "`schema` directly to create_website_template — it auto-creates the backing Schema Template for you, no " +
      "separate create_schema_template step needed for the common case. Only use `schemaTemplateId` (and the " +
      "standalone create_schema_template/update_schema_template/list_schema_templates/get_schema_template " +
      "tools) when deliberately reusing an existing structure for a second frontend skin. For anything " +
      "non-trivial, call create_website_template with dryRun: true FIRST — it validates files, schema shape, " +
      "every relationSlug/componentSlug/allowedComponents reference against the rest of the SAME bundle, and " +
      "select/multiselect choices, returning exact paths like \"schema.contentTypes[2].fields[4].options.choices\" " +
      "for anything wrong, without creating or deploying anything. Pass idempotencyKey to create_website_template " +
      "if you want a lost response's retry to resolve to the same template instead of a duplicate (and, worse, a " +
      "second orphaned backing Schema Template). delete_schema_template refuses with HAS_DEPENDENTS (listing " +
      "them) instead of silently cascade-deleting every Website Template built on it — only pass " +
      "confirmCascade: true after telling the user exactly what else will be deleted. Every " +
      "create_website_template and update_website_template(files/changedFiles/schema: ...) call automatically " +
      "(re)deploys a live preview at https://demo-<slug>.sites.sacms.cloud, fed by sample content — never a " +
      "real customer's data — so you can test in a real browser before publishing. The response's " +
      "`demoDeployment` reports `status` (ok/failed/skipped), `verified` (SaCMS actually fetched the URL and " +
      "confirmed it renders — Vercel accepting the build is NOT the same as it working), and `error`/" +
      "`verificationError` when something's wrong; `status: \"ok\"` alone doesn't mean verified is true, check " +
      "both before telling a human the preview is ready. `verified` reflects the LATEST build specifically — a " +
      "build that errors reports `status: \"failed\"`/`verified: false` even when the demo URL still happens to " +
      "render a previous successful deployment (that staleness is called out explicitly in `verificationError`, " +
      "never silently reported as success). A metadata-only update (no files/changedFiles/schema) " +
      "returns `demoDeployment.status: \"skipped\"` and does not redeploy. For a TARGETED revision of an " +
      "existing template (\"ubah warna header\"), call get_website_template to see the current bundle, then " +
      "update_website_template with changedFiles/deletedFiles instead of resending every file via `files`. " +
      "list_field_types's `contentApiContract` has real request/response examples for the frontend's actual " +
      "Content API calls (collection list, single entry, a populated relation) — read it before writing any " +
      "fetch call, and note it also explains why the demo preview shows media/relation/component/repeater " +
      "fields EMPTY (the demo fixture deliberately never seeds those). get_website_template_demo_status reads " +
      "a demo's current build state and does a FRESH live check of its URL without triggering any deploy, and " +
      "the same build-vs-URL distinction applies there: `verified` is forced false whenever the latest build " +
      "errored, regardless of what the URL itself currently serves. " +
      "redeploy_website_template_demo re-deploys using the template's already-stored files/schema — use it to " +
      "retry after a failed build instead of resending files through update_website_template. " +
      "update_schema_template/update_website_template both accept expectedVersion — pass the `sourceVersion` " +
      "you last read (NOT `updatedAt`, which also moves on every redeploy/demo-metadata write even with no " +
      "source change) — and reject with CONFLICT if files/schema changed since. A structural " +
      "`schema` change to either tool refuses with HAS_DEPENDENTS when another Website Template shares that " +
      "same backing Schema Template, unless confirmSharedUpdate/confirmCascade (as applicable) is set after " +
      "confirming with the user what else will be affected. create_website_template's dryRun: true returns " +
      "{ mode: \"dry_run\", ok, valid, issues, warnings } — a DIFFERENT shape from a real create's response, " +
      "don't expect id/slug/files/demoDeployment on a dry run; dryRun/create/update also validate every " +
      "field's `type` against the real 36-type list (list_field_types) and every `dummyData` entry's values " +
      "against the same per-type rules real content creation uses — a typo'd field type or a value that would " +
      "genuinely be rejected at import time (e.g. a select value outside its own options.choices) is flagged " +
      "here too, not just silently accepted. Every demo deploy injects the three fixed " +
      "NEXT_PUBLIC_SACMS_API_URL/NEXT_PUBLIC_SACMS_TENANT/SACMS_API_KEY vars automatically — a template whose " +
      "frontend reads those exact names needs no .env placeholder for them at all; only a DIFFERENT custom " +
      "name needs a {{SACMS_*}} placeholder. Every structured error response (NOT_FOUND, VALIDATION_FAILED, " +
      "CONFLICT, HAS_DEPENDENTS, INVALID_ARGUMENT, UNAUTHORIZED) uses the same `structuredContent.code` field.",
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
