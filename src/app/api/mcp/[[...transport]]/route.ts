/**
 * SaCMS Model Context Protocol (MCP) Server
 *
 * Full CRUD capabilities for Content Types, Single Types, Components,
 * Content Entries, and Webhooks.
 *
 * Documented/supported IDE agents: Antigravity and VS Code (GitHub Copilot
 * Chat, Agent mode). The server itself speaks standard MCP over Streamable
 * HTTP, so any compliant MCP client can in principle connect — see
 * docs/11-User_Manual_and_Integrations.md §15 for the two supported setups.
 *
 * Auth: Standard HTTP Bearer token (Authorization: Bearer <API_TOKEN>)
 * URL:  /api/mcp
 */

import { createMcpHandler } from "mcp-handler"
import { z } from "zod"
import { db, getTenantDb } from "@/lib/database"
import { NextResponse } from "next/server"
import { createHash } from "crypto"
import { AsyncLocalStorage } from "async_hooks"
import { deployToVercel, getDeploymentStatus, addDomainToProject, getDomainConfig, upsertVercelProjectEnv, disableVercelDeploymentProtection, type VercelEnvTarget } from "@/lib/vercel-client"
import { FIELD_TYPES, FIELD_CATEGORIES, VALID_FIELD_TYPES } from "@/lib/field-types"
import { safeFetch } from "@/lib/safe-url"
import { rateLimit, getTenantRateLimit } from "@/lib/rate-limit"
import {
  createContentEntry,
  updateContentEntry,
  deleteContentEntry,
  contentRevalidatePaths,
  type EntryWriteContext,
  type ContentActor,
} from "@/lib/content/entry-service"
import { revalidatePath } from "next/cache"
import {
  getFullSchemaForTenant,
  listContentTypesForTenant,
  getContentTypeForTenant,
  queryContentForTenant,
  listComponentsForTenant,
} from "@/lib/cms-introspection"
import { isTenantPlanPaid } from "@/lib/infrastructure/hosting-plan"

// ─── Auth Helper & Payment Gatekeeper ─────────────────────────────────────────

interface AuthContext {
  tenantId: string
  tenantSlug: string
  tenantName: string
  permissions: string[]
  plan: string
  isPaid: boolean
  /** Narrower than `isPaid` — true only on an actual paid plan tier (or
   *  active hosting payment), excludes Free. Gates the Vercel-hosting
   *  tools specifically; `isPaid` gates general MCP access and is
   *  deliberately true for Free tier too. */
  isHostingPlanPaid: boolean
  isSuperAdmin?: boolean
  paymentError?: string
}

const authContext = new AsyncLocalStorage<AuthContext>()

export async function resolveToken(rawToken: string): Promise<AuthContext | null> {
  if (!rawToken?.trim()) return null
  const clean = rawToken.trim()
  const hashed = createHash("sha256").update(clean).digest("hex")

  let tenantData: { id: string; slug: string; name: string; plan: string; status: string; hostingStatus: string | null } | null = null
  let permissions: string[] = ["read", "write", "delete"]

  // Look up by hashed token first, then plain token. MCP is a separate
  // credential system from REST/GraphQL (see public-api-actor.ts) — only
  // type "mcp" ApiToken rows authenticate here, and the legacy ApiKey
  // (REST-only) is not accepted at all.
  const token = await db.apiToken.findFirst({
    where: {
      OR: [
        { token: hashed },
        { token: clean },
      ],
      type: "mcp",
    },
    select: {
      id: true,
      tenantId: true,
      permissions: true,
      tenant: { select: { id: true, slug: true, name: true, plan: true, status: true, hostingStatus: true } }
    },
  })

  if (token?.tenant) {
    db.apiToken.updateMany({
      where: { OR: [{ token: hashed }, { token: clean }], type: "mcp" },
      data: { lastUsedAt: new Date() }
    }).catch(() => {})

    tenantData = token.tenant
    if (Array.isArray(token.permissions)) {
      permissions = token.permissions as string[]
    }
  }

  if (!tenantData) return null

  // ─── Payment Status & Active Subscription Check ────────────────────────────
  // This `isPaid`/`paymentError` pair gates the WHOLE MCP connection (see
  // handleMcpRequest below) — it's an account-good-standing check, not a
  // plan-tier check, so a Free-plan tenant (its own Subscription row is
  // created with status "active" — see actions/tenant.ts) correctly passes
  // it: Free tier is intentionally free, not delinquent, and MCP's
  // schema/content tools are available to every plan. Only a genuinely
  // lapsed/cancelled subscription should trip this.
  const activeSubscription = await db.subscription.findFirst({
    where: {
      tenantId: tenantData.id,
      status: { in: ["active", "paid", "trialing"] }
    }
  })

  const isPaid = (tenantData.status === "active" && !!activeSubscription) || tenantData.hostingStatus === "active"
  let paymentError: string | undefined = undefined

  if (!isPaid) {
    paymentError = `❌ Payment Required: Akses MCP dinonaktifkan untuk workspace '${tenantData.slug}'. Status langganan Anda belum aktif/dibayar (status: ${activeSubscription?.status || "unpaid"}). Silakan aktifkan pembayaran melalui dashboard workspace.`
  }

  // Separate, narrower check for the Vercel-hosting tools specifically
  // (deploy_to_sacms, configure_deployment_domain, add_deployment_env,
  // make_deployment_public) — these must exclude Free tier, unlike the
  // general `isPaid` above. Confirmed live: `isPaid` above was always true
  // for Free tenants too, so the 4 individual `if (!auth.isPaid)` checks
  // inside those tool handlers never actually blocked anyone — this plan-
  // slug check (same helper the dashboard's own deploy route already
  // gates on) is the real fix.
  const isHostingPlanPaid = isTenantPlanPaid(tenantData.plan) || tenantData.hostingStatus === "active"

  return {
    tenantId: tenantData.id,
    tenantSlug: tenantData.slug,
    tenantName: tenantData.name,
    permissions,
    plan: tenantData.plan,
    isPaid,
    isHostingPlanPaid,
    isSuperAdmin: false,
    paymentError,
  }
}

const UNAUTHORIZED = {
  content: [{
    type: "text" as const,
    text: "❌ Unauthorized: Invalid or missing API token. Please provide a valid Bearer token for your SaCMS workspace."
  }]
}

/**
 * Scope enforcement for API tokens.
 *
 * `AuthContext.permissions` was resolved from the token's own `permissions`
 * array (e.g. a token minted as read-only: `["read"]`) but was previously
 * only ever *read* by the `inspect_api_capabilities` tool to describe what a
 * token could do — no write/delete/schema/webhook tool actually checked it,
 * so a read-only token could still call `delete_content_type` and every
 * other mutating tool. Every mutating/schema/webhook tool now calls
 * `hasScope()` right after its `UNAUTHORIZED` check.
 *
 * `full_access` or `isSuperAdmin` bypasses all scopes, matching the
 * `can*` booleans already computed in `inspect_api_capabilities`.
 */
type Scope = "read" | "write" | "delete" | "schema" | "webhooks"

export function hasScope(auth: AuthContext, scope: Scope): boolean {
  if (auth.isSuperAdmin) return true
  if (auth.permissions.includes("full_access")) return true
  return auth.permissions.includes(scope)
}

export function permissionDenied(scope: Scope) {
  const howToGrant = `Ask a workspace admin to grant it under Developer & API → API Tokens, or use a token with "full_access".`
  return {
    content: [{
      type: "text" as const,
      text: `❌ Forbidden: this API token does not have the "${scope}" permission. ${howToGrant}`
    }],
    isError: true,
  }
}

// ─── Webhook response shaping ───────────────────────────────────────────────
// The signing secret must never round-trip back out of any tool — a reader
// (or a trivial update that doesn't even touch the secret) could otherwise
// recover it and forge validly-signed requests to the tenant's receiving
// endpoint. `hasSecret` tells the caller whether one is configured without
// exposing its value, matching how API tokens are handled elsewhere in this
// file (shown once at creation/rotation, never again on plain reads).
function redactWebhook(w: {
  id: string; name: string; url: string; events: unknown; enabled: boolean
  hookType: string; secret: string | null; failureCount: number
  lastTriggeredAt: Date | null; createdAt: Date
}) {
  return {
    id: w.id,
    name: w.name,
    url: w.url,
    events: w.events,
    enabled: w.enabled,
    hookType: w.hookType,
    hasSecret: !!w.secret,
    failureCount: w.failureCount,
    lastTriggeredAt: w.lastTriggeredAt,
    createdAt: w.createdAt,
  }
}

// ─── Deployment project ownership ───────────────────────────────────────────
/**
 * Resolves the Vercel project this tenant's own deployment lives under, and
 * rejects outright if the caller supplied a DIFFERENT project id. `projectId`
 * used to be passed straight through to Vercel's API with no check that it
 * actually belonged to the calling tenant — any tenant that knew (or
 * guessed — Vercel project ids aren't secret) another tenant's project id
 * could attach an attacker-controlled domain to it, overwrite one of its env
 * vars, or lift its deployment protection, none of which touch this app's
 * own Prisma-level tenant scoping since they're calls straight through to
 * Vercel's API under a single shared platform token.
 */
async function resolveOwnProjectId(
  auth: AuthContext,
  suppliedProjectId: string | undefined,
): Promise<{ ok: true; projectId: string } | { ok: false; response: { content: { type: "text"; text: string }[]; isError: true } }> {
  const tenant = await db.tenant.findUnique({
    where: { id: auth.tenantId },
    select: { vercelProjectId: true },
  })
  let ownProjectId = tenant?.vercelProjectId || undefined
  if (!ownProjectId) {
    const row = await db.setting.findFirst({ where: { key: `${auth.tenantId}_vercelProjectId` } })
    ownProjectId = row?.value || undefined
  }

  if (!ownProjectId) {
    return {
      ok: false,
      response: {
        content: [{
          type: "text",
          text: "❌ Tidak ada Deployment Project ID. Deploy dulu dengan deploy_to_sacms, atau berikan parameter projectId.",
        }],
        isError: true,
      },
    }
  }

  if (suppliedProjectId && suppliedProjectId !== ownProjectId) {
    return {
      ok: false,
      response: {
        content: [{ type: "text", text: `❌ Project ID '${suppliedProjectId}' bukan milik workspace ini.` }],
        isError: true,
      },
    }
  }

  return { ok: true, projectId: ownProjectId }
}

// ─── Content entry write context ───────────────────────────────────────────
// Builds the (ctx, actor) pair entry-service.ts needs — the same service
// layer the dashboard's create/updateEntryAction now goes through, so MCP's
// content-entry write tools inherit draftTemplateId filtering, schema/
// relation validation, and optimistic-locking for free instead of
// reimplementing (and drifting from) that logic with raw Prisma calls.
// MCP tokens aren't tied to a human actor or role, so "system" is the right
// actor kind: it bypasses the staff/member ownership checks (there's no
// per-entry "owner" concept for a workspace-wide token) and the workflow-
// transition gate, same as super-admin global content and cron already do.
async function mcpEntryContext(auth: AuthContext, tenantDb: Awaited<ReturnType<typeof getTenantDb>>): Promise<{ ctx: EntryWriteContext; actor: ContentActor }> {
  return {
    ctx: { client: tenantDb, tenantId: auth.tenantId, tenantSlug: auth.tenantSlug, isGlobal: false, enforcePlan: true },
    actor: { kind: "system" },
  }
}

// ─── Slug Normalization ───────────────────────────────────────────────────────

/**
 * Normalizes any input into the same slug shape the manual UI forms enforce
 * via regex (/^[a-z0-9][a-z0-9-]*$/) — the ad hoc per-tool `.replace(...)`
 * calls this replaces could still produce a slug starting with "-" or
 * containing "_", inconsistent with (and looser than) anything created by
 * hand through the Developer Portal.
 */
function toSafeSlug(input: string, fallback = "item"): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || fallback
}

// ─── Relational Dependency Guards ──────────────────────────────────────────────
// Mirror the checks in src/actions/{content-types,single-types,components}.ts
// so an MCP delete tool can't silently leave a relation/component field
// dangling — unlike the Developer Portal UI, an agent calling these tools
// gets no confirmation dialog, so the guard has to be the thing that stops it.

type TenantPrismaClient = Awaited<ReturnType<typeof getTenantDb>>

async function checkRelationDependents(
  tenantDb: TenantPrismaClient,
  tenantId: string,
  targetSlug: string,
  exclude: { contentTypeId: string } | { singleTypeId: string },
): Promise<{ fieldName: string; parentName: string } | null> {
  const fields = await tenantDb.schemaField.findMany({
    where: {
      relationSlug: targetSlug,
      NOT: exclude,
      OR: [
        { contentType: { tenantId } },
        { singleType: { tenantId } },
        { component: { tenantId } },
        { contentType: { tenantId: null } },
        { singleType: { tenantId: null } },
        { component: { tenantId: null } },
      ],
    },
    include: { contentType: true, singleType: true, component: true },
  })
  if (fields.length === 0) return null
  const f = fields[0]
  return {
    fieldName: f.name,
    parentName: f.contentType?.name || f.singleType?.name || f.component?.name || "skema lain",
  }
}

async function countComponentDependents(
  tenantDb: TenantPrismaClient,
  tenantId: string,
  targetSlug: string,
): Promise<number> {
  const allFields = await tenantDb.schemaField.findMany({
    where: {
      OR: [
        { contentType: { tenantId } },
        { singleType: { tenantId } },
        { component: { tenantId } },
        { contentType: { tenantId: null } },
        { singleType: { tenantId: null } },
        { component: { tenantId: null } },
      ],
    },
    select: { options: true },
  })
  return allFields.filter((field) => {
    if (!field.options) return false
    let parsedOptions: any = field.options
    if (typeof parsedOptions === "string") {
      try {
        parsedOptions = JSON.parse(parsedOptions)
      } catch {
        return false
      }
    }
    return parsedOptions?.componentSlug === targetSlug
  }).length
}

// ─── MCP Handler with Complete CRUD Capabilities ─────────────────────────────

const handler = createMcpHandler(
  async (server) => {

    // =========================================================================
    // 1. FULL SCHEMA & INTROSPECTION TOOLS
    // =========================================================================

    // ── get_full_schema ──────────────────────────────────────────────────────
    server.registerTool(
      "get_full_schema",
      {
        title: "Get Full Schema",
        description: "Get the complete database schema of the workspace — all Content Types (collections), Single Types (one-off pages), and Components (reusable blocks) with their fields and configurations. Call this FIRST when building or scaffolding frontend applications.",
        inputSchema: {},
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const schema = await getFullSchemaForTenant(tenantDb, auth.tenantId, {
          id: auth.tenantId,
          name: auth.tenantName,
          slug: auth.tenantSlug,
        })

        return { content: [{ type: "text" as const, text: JSON.stringify(schema, null, 2) }] }
      }
    )

    // ── list_field_types ─────────────────────────────────────────────────────
    server.registerTool(
      "list_field_types",
      {
        title: "List Supported Field Types",
        description: "List all 33 supported field types in SaCMS (text, textarea, richText, markdown, number, currency, percent, date, datetime, time, dateRange, select, multiselect, tags, icon, boolean, email, password, url, phone, uid, media, mediaMultiple, file, relation, component, repeater, location, seo, code, json, color, rating). Call this to discover allowed types, validation rules, and schema configuration options before creating or modifying content types.",
        inputSchema: {
          category: z.enum([
            "Basic",
            "Number",
            "Date & Time",
            "Selection",
            "Boolean",
            "Validation",
            "Media",
            "Relations",
            "Advanced"
          ]).optional().describe("Optional category to filter field types"),
        },
      },
      async ({ category }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        let types = FIELD_TYPES as unknown as any[]
        if (category) {
          types = types.filter(t => t.category.toLowerCase() === category.toLowerCase())
        }

        const fieldDocs = types.map((ft) => {
          const supportedOptions: Record<string, string> = {
            required: "boolean (default false)",
            unique: "boolean (default false)",
            localizable: "boolean (default true - i18n translation)",
          }
          const exampleField: Record<string, any> = {
            name: ft.label,
            slug: ft.type.toLowerCase().replace(/[^a-z0-9]/g, "_"),
            type: ft.type,
            required: false,
          }

          if (ft.type === "relation") {
            supportedOptions.relationSlug = "string (target collection slug, e.g. 'categories')"
            supportedOptions.relationType = "oneToOne | oneToMany | manyToOne | manyToMany"
            exampleField.relationSlug = "categories"
          } else if (ft.type === "component") {
            supportedOptions.options = "{ componentSlug: string } (e.g. { componentSlug: 'hero_section' })"
            exampleField.options = { componentSlug: "hero_section" }
          } else if (ft.type === "repeater") {
            supportedOptions.options = "{ componentSlugs: string[] } (dynamic polymorphic zone)"
            exampleField.options = { componentSlugs: ["hero_section", "cta_banner", "testimonial_card"] }
          } else if (ft.type === "select" || ft.type === "multiselect") {
            supportedOptions.options = "{ choices: Array<{ label: string, value: string }> }"
            exampleField.options = {
              choices: [
                { label: "Option A", value: "option_a" },
                { label: "Option B", value: "option_b" }
              ]
            }
          } else if (ft.type === "currency") {
            supportedOptions.options = "{ currencyCode: 'IDR' | 'USD' | 'EUR', min?: number, max?: number }"
            exampleField.options = { currencyCode: "IDR", min: 0 }
          } else if (ft.type === "number" || ft.type === "percent") {
            supportedOptions.options = "{ min?: number, max?: number, step?: number }"
            exampleField.options = { min: 0, max: 100 }
          } else if (ft.type === "media" || ft.type === "mediaMultiple") {
            supportedOptions.options = "{ allowedTypes: ['image', 'video', 'document'], maxFileSizeMb?: number }"
            exampleField.options = { allowedTypes: ["image"] }
          }

          return {
            type: ft.type,
            label: ft.label,
            category: ft.category,
            description: ft.description,
            supportedOptions,
            exampleSchemaField: exampleField,
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              totalCount: fieldDocs.length,
              categories: FIELD_CATEGORIES,
              fieldTypes: fieldDocs,
              usageNote: "Pass these field definitions in the 'fields' array of 'create_content_type', 'create_single_type', or 'create_component'."
            }, null, 2)
          }]
        }
      }
    )

    // =========================================================================
    // 2. CONTENT TYPES (COLLECTIONS) CRUD
    // =========================================================================

    // ── list_content_types ───────────────────────────────────────────────────
    server.registerTool(
      "list_content_types",
      {
        title: "List Content Types",
        description: "List all Content Types (collections like articles, products, categories, authors) with their field schemas and total entry counts.",
        inputSchema: {},
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const result = await listContentTypesForTenant(tenantDb, auth.tenantId)

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── get_content_type ─────────────────────────────────────────────────────
    server.registerTool(
      "get_content_type",
      {
        title: "Get Content Type Schema",
        description: "Get detailed field schema and metadata for a specific Content Type by its slug or ID.",
        inputSchema: {
          slug: z.string().describe("Slug of the Content Type (e.g. 'articles', 'products')"),
        },
      },
      async ({ slug }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const result = await getContentTypeForTenant(tenantDb, auth.tenantId, slug)

        if (!result) return { content: [{ type: "text" as const, text: `❌ Content Type '${slug}' not found.` }] }

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── create_content_type ──────────────────────────────────────────────────
    server.registerTool(
      "create_content_type",
      {
        title: "Create Content Type",
        description: "Create a new Content Type collection schema with fields. Call 'list_field_types' to discover all 33 supported field types (text, textarea, richText, markdown, number, currency, percent, date, datetime, time, dateRange, select, multiselect, tags, icon, boolean, email, password, url, phone, uid, media, mediaMultiple, file, relation, component, repeater, location, seo, code, json, color, rating).",
        inputSchema: {
          name: z.string().describe("Display name (e.g. 'Blog Post', 'Product Item')"),
          slug: z.string().describe("URL-safe slug (e.g. 'articles', 'products')"),
          description: z.string().optional().describe("Description of this collection"),
          showInCms: z.boolean().default(true).describe("Whether to display in CMS sidebar"),
          fields: z.array(
            z.object({
              name: z.string().describe("Field display name (e.g. 'Title', 'Price')"),
              slug: z.string().describe("Field slug (e.g. 'title', 'price')"),
              type: z.enum(VALID_FIELD_TYPES).describe("Field type identifier (e.g. 'text', 'textarea', 'richText', 'currency', 'date', 'mediaMultiple', 'relation', 'repeater', etc. See 'list_field_types' for full list)"),
              required: z.boolean().optional().default(false),
              unique: z.boolean().optional().default(false),
              localizable: z.boolean().optional().default(true),
              relationSlug: z.string().optional().describe("For relation type: slug of target content type"),
              options: z.record(z.string(), z.any()).optional().describe("Extra field options (e.g. { currencyCode: 'IDR' }, { choices: [{label, value}] }, { componentSlug: 'hero' })"),
            })
          ).optional().describe("List of field definitions to create for this Content Type"),
        },
      },
      async ({ name, slug, description, showInCms, fields }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const cleanSlug = toSafeSlug(slug)
        const tenantDb = await getTenantDb(auth.tenantSlug)

        // Check if slug already exists
        const existing = await tenantDb.contentType.findFirst({
          where: { tenantId: auth.tenantId, slug: cleanSlug, draftTemplateId: null }
        })
        if (existing) {
          return { content: [{ type: "text" as const, text: `❌ A Content Type with slug '${cleanSlug}' already exists.` }] }
        }

        const created = await tenantDb.contentType.create({
          data: {
            tenantId: auth.tenantId,
            name: name.trim(),
            slug: cleanSlug,
            description: description || null,
            showInCms: showInCms ?? true,
            isPublished: true,
            schemaFields: {
              create: (fields || []).map((f, idx) => ({
                name: f.name,
                slug: toSafeSlug(f.slug),
                type: f.type,
                required: f.required || false,
                unique: f.unique || false,
                localizable: f.localizable ?? true,
                relationSlug: f.relationSlug || null,
                options: f.options || {},
                order: idx,
              }))
            },
            tenants: {
              create: {
                tenantId: auth.tenantId,
              }
            }
          },
          include: {
            schemaFields: { orderBy: { order: "asc" } }
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Content Type '${created.name}' (slug: '${created.slug}') created successfully with ${created.schemaFields.length} fields.\n\n${JSON.stringify(created, null, 2)}`
          }]
        }
      }
    )

    // ── update_content_type ──────────────────────────────────────────────────
    server.registerTool(
      "update_content_type",
      {
        title: "Update Content Type",
        description: "Update an existing Content Type's name, description, or add/replace its schema fields.",
        inputSchema: {
          slug: z.string().describe("Current slug or ID of the Content Type to update"),
          name: z.string().optional().describe("New display name"),
          description: z.string().optional().describe("New description"),
          showInCms: z.boolean().optional().describe("Show in CMS navigation"),
          fields: z.array(
            z.object({
              name: z.string(),
              slug: z.string(),
              type: z.enum(VALID_FIELD_TYPES),
              required: z.boolean().optional().default(false),
              unique: z.boolean().optional().default(false),
              localizable: z.boolean().optional().default(true),
              relationSlug: z.string().optional(),
              options: z.record(z.string(), z.any()).optional(),
            })
          ).optional().describe("New list of fields. If provided (including an empty array), replaces the schema field set."),
        },
      },
      async ({ slug, name, description, showInCms, fields }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const ct = await tenantDb.contentType.findFirst({
          where: {
            draftTemplateId: null,
            OR: [
              { slug, tenantId: auth.tenantId },
              { id: slug, tenantId: auth.tenantId },
            ]
          }
        })
        if (!ct) return { content: [{ type: "text" as const, text: `❌ Content Type '${slug}' not found.` }] }

        // Update fields if provided — an explicit empty array clears them.
        if (fields !== undefined) {
          await tenantDb.schemaField.deleteMany({
            where: { contentTypeId: ct.id }
          })
          if (fields.length > 0) {
            await tenantDb.schemaField.createMany({
              data: fields.map((f, idx) => ({
                contentTypeId: ct.id,
                name: f.name,
                slug: toSafeSlug(f.slug),
                type: f.type,
                required: f.required || false,
                unique: f.unique || false,
                localizable: f.localizable ?? true,
                relationSlug: f.relationSlug || null,
                options: f.options || {},
                order: idx,
              }))
            })
          }
        }

        const updated = await tenantDb.contentType.update({
          where: { id: ct.id },
          data: {
            ...(name ? { name: name.trim() } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(showInCms !== undefined ? { showInCms } : {}),
          },
          include: {
            schemaFields: { orderBy: { order: "asc" } }
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Content Type '${updated.name}' updated successfully.\n\n${JSON.stringify(updated, null, 2)}`
          }]
        }
      }
    )

    // ── delete_content_type ──────────────────────────────────────────────────
    server.registerTool(
      "delete_content_type",
      {
        title: "Delete Content Type",
        description: "Permanently delete a Content Type collection, its schema fields, and all its stored content entries.",
        inputSchema: {
          slug: z.string().describe("Slug or ID of the Content Type to delete"),
        },
      },
      async ({ slug }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "delete")) return permissionDenied("delete")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const ct = await tenantDb.contentType.findFirst({
          where: {
            draftTemplateId: null,
            OR: [
              { slug, tenantId: auth.tenantId },
              { id: slug, tenantId: auth.tenantId },
            ]
          }
        })
        if (!ct) return { content: [{ type: "text" as const, text: `❌ Content Type '${slug}' not found.` }] }

        const dependent = await checkRelationDependents(tenantDb, auth.tenantId, ct.slug, { contentTypeId: ct.id })
        if (dependent) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Cannot delete Content Type '${ct.name}' — field '${dependent.fieldName}' on '${dependent.parentName}' still references it via relationSlug. Remove or repoint that field first.`
            }],
            isError: true,
          }
        }

        await tenantDb.contentType.delete({
          where: { id: ct.id }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Content Type '${ct.name}' (slug: '${ct.slug}') has been permanently deleted.`
          }]
        }
      }
    )

    // =========================================================================
    // 3. CONTENT ENTRIES CRUD (DATA ENTITIES)
    // =========================================================================

    // ── query_content ────────────────────────────────────────────────────────
    server.registerTool(
      "query_content",
      {
        title: "Query Content Entries",
        description: "Fetch published or draft content entries from a Content Type collection with pagination, search, locale filtering, and sorting.",
        inputSchema: {
          contentTypeSlug: z.string().describe("Slug of the Content Type (e.g. 'articles', 'products')"),
          limit: z.number().default(10).describe("Number of items to return (max 100)"),
          page: z.number().default(1).describe("Page number (1-indexed)"),
          status: z.enum(["PUBLISHED", "DRAFT", "IN_REVIEW", "ARCHIVED", "ALL"]).default("PUBLISHED"),
          search: z.string().optional().describe("Search term"),
          locale: z.string().optional().describe("Filter by locale code (e.g. 'id', 'en')"),
          sortOrder: z.enum(["asc", "desc"]).default("desc"),
        },
      },
      async ({ contentTypeSlug, limit, page, status, search, locale, sortOrder }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const result = await queryContentForTenant(tenantDb, auth.tenantId, {
          contentTypeSlug, limit, page, status, search, locale, sortOrder,
        })
        if (!result) return { content: [{ type: "text" as const, text: `❌ Content Type '${contentTypeSlug}' not found.` }] }

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── get_content_entry ────────────────────────────────────────────────────
    server.registerTool(
      "get_content_entry",
      {
        title: "Get Content Entry",
        description: "Fetch a specific content entry record by its unique ID, including all JSON fields, locale, status, and metadata.",
        inputSchema: {
          id: z.string().describe("Unique ID of the content entry (e.g. 'cmtcsh...')"),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const entry = await tenantDb.contentEntry.findFirst({
          where: { id, tenantId: auth.tenantId, deletedAt: null },
          include: {
            contentType: {
              select: { id: true, name: true, slug: true }
            }
          }
        })
        if (!entry) {
          return {
            content: [{ type: "text" as const, text: `❌ Content entry with ID '${id}' not found.` }],
            isError: true,
          }
        }

        const result = {
          _id: entry.id,
          _contentType: entry.contentType.slug,
          _contentTypeName: entry.contentType.name,
          _status: entry.status,
          _locale: entry.locale,
          _createdAt: entry.createdAt,
          _updatedAt: entry.updatedAt,
          _publishedAt: entry.publishedAt,
          ...(typeof entry.data === "object" && entry.data !== null ? entry.data : {}),
        }

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── create_content_entry ─────────────────────────────────────────────────
    server.registerTool(
      "create_content_entry",
      {
        title: "Create Content Entry",
        description: "Insert a new content entry record into a Content Type collection with JSON payload data.",
        inputSchema: {
          contentTypeSlug: z.string().describe("Slug of the target Content Type (e.g. 'articles')"),
          data: z.record(z.string(), z.any()).describe("JSON object containing the field values (e.g. { title: 'Hello', slug: 'hello', content: '...' })"),
          status: z.enum(["PUBLISHED", "DRAFT", "IN_REVIEW"]).default("PUBLISHED").describe("Initial entry status"),
          locale: z.string().default("id").describe("Content locale (default 'id')"),
        },
      },
      async ({ contentTypeSlug, data, status, locale }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const { ctx, actor } = await mcpEntryContext(auth, tenantDb)

        const result = await createContentEntry(ctx, actor, {
          contentTypeSlug,
          data: data || {},
          status,
          locale,
        })
        if (!result.ok) {
          return { content: [{ type: "text" as const, text: `❌ ${result.message}` }], isError: true }
        }

        for (const path of contentRevalidatePaths(auth.tenantSlug, contentTypeSlug)) revalidatePath(path)

        return {
          content: [{
            type: "text" as const,
            text: `✅ Content entry created successfully in '${contentTypeSlug}' with ID '${result.data.id}'.\n\n${JSON.stringify(result.data, null, 2)}`
          }]
        }
      }
    )

    // ── update_content_entry ─────────────────────────────────────────────────
    server.registerTool(
      "update_content_entry",
      {
        title: "Update Content Entry",
        description: "Update an existing content entry record by its ID.",
        inputSchema: {
          id: z.string().describe("ID of the content entry to update"),
          data: z.record(z.string(), z.any()).optional().describe("Updated JSON field values (will be merged with existing data)"),
          status: z.enum(["PUBLISHED", "DRAFT", "IN_REVIEW", "ARCHIVED"]).optional().describe("Updated status"),
        },
      },
      async ({ id, data, status }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const existing = await tenantDb.contentEntry.findFirst({
          where: { id, tenantId: auth.tenantId, deletedAt: null },
          include: { contentType: { select: { slug: true } } },
        })
        if (!existing) return { content: [{ type: "text" as const, text: `❌ Content entry with ID '${id}' not found.` }], isError: true }

        const { ctx, actor } = await mcpEntryContext(auth, tenantDb)
        const result = await updateContentEntry(ctx, actor, {
          contentTypeSlug: existing.contentType.slug,
          entryId: id,
          data,
          status,
          locale: existing.locale,
        })
        if (!result.ok) {
          return { content: [{ type: "text" as const, text: `❌ ${result.message}` }], isError: true }
        }

        for (const path of contentRevalidatePaths(auth.tenantSlug, existing.contentType.slug)) revalidatePath(path)

        return {
          content: [{
            type: "text" as const,
            text: `✅ Content entry '${id}' updated successfully.\n\n${JSON.stringify(result.data, null, 2)}`
          }]
        }
      }
    )

    // ── delete_content_entry ─────────────────────────────────────────────────
    server.registerTool(
      "delete_content_entry",
      {
        title: "Delete Content Entry",
        description: "Delete a specific content entry by its ID.",
        inputSchema: {
          id: z.string().describe("ID of the content entry to delete"),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "delete")) return permissionDenied("delete")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const existing = await tenantDb.contentEntry.findFirst({
          where: { id, tenantId: auth.tenantId, deletedAt: null },
          include: { contentType: { select: { slug: true } } },
        })
        if (!existing) return { content: [{ type: "text" as const, text: `❌ Content entry with ID '${id}' not found.` }], isError: true }

        const { ctx, actor } = await mcpEntryContext(auth, tenantDb)
        const result = await deleteContentEntry(ctx, actor, {
          contentTypeSlug: existing.contentType.slug,
          entryId: id,
        })
        if (!result.ok) {
          return { content: [{ type: "text" as const, text: `❌ ${result.message}` }], isError: true }
        }

        for (const path of contentRevalidatePaths(auth.tenantSlug, existing.contentType.slug)) revalidatePath(path)

        return {
          content: [{
            type: "text" as const,
            text: `✅ Content entry '${id}' deleted successfully.`
          }]
        }
      }
    )

    // =========================================================================
    // 4. SINGLE TYPES (SINGLETON PAGES) CRUD
    // =========================================================================

    // ── list_single_types ────────────────────────────────────────────────────
    server.registerTool(
      "list_single_types",
      {
        title: "List Single Types",
        description: "List all Single Types (one-off page schemas like Homepage, About Page, Global Site Settings).",
        inputSchema: {},
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const singleTypes = await tenantDb.singleType.findMany({
          where: { tenantId: auth.tenantId, draftTemplateId: null },
          include: {
            schemaFields: { orderBy: { order: "asc" } },
            tenants: { where: { tenantId: auth.tenantId }, take: 1 }
          },
          orderBy: { name: "asc" },
        })

        const result = singleTypes.map((st) => ({
          id: st.id,
          name: st.name,
          slug: st.slug,
          description: st.description,
          hasData: !!st.tenants[0]?.data,
          fields: st.schemaFields.map((f) => ({
            name: f.name,
            slug: f.slug,
            type: f.type,
            required: f.required,
            unique: f.unique,
          })),
        }))

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── get_single_type ──────────────────────────────────────────────────────
    server.registerTool(
      "get_single_type",
      {
        title: "Get Single Type Content & Schema",
        description: "Fetch the schema fields and actual saved content data for a specific Single Type.",
        inputSchema: {
          singleTypeSlug: z.string().describe("Slug or ID of the Single Type (e.g. 'homepage', 'global-settings', 'about')"),
          locale: z.string().optional().default("id").describe("Content locale (default 'id')"),
        },
      },
      async ({ singleTypeSlug, locale }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const targetLocale = locale || "id"
        const st = await tenantDb.singleType.findFirst({
          where: {
            draftTemplateId: null,
            OR: [
              { slug: singleTypeSlug, tenantId: auth.tenantId },
              { id: singleTypeSlug, tenantId: auth.tenantId },
            ]
          },
          include: {
            schemaFields: { orderBy: { order: "asc" } },
            tenants: { where: { tenantId: auth.tenantId } }
          },
        })
        if (!st) return { content: [{ type: "text" as const, text: `❌ Single Type '${singleTypeSlug}' not found.` }], isError: true }

        const matchingAssignment = st.tenants.find(t => t.locale === targetLocale) || st.tenants[0]

        const result = {
          singleType: {
            id: st.id,
            name: st.name,
            slug: st.slug,
            description: st.description,
            fields: st.schemaFields.map(f => ({
              name: f.name,
              slug: f.slug,
              type: f.type,
              required: f.required,
              options: f.options
            })),
          },
          locale: matchingAssignment?.locale || targetLocale,
          data: matchingAssignment?.data || {}
        }

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── create_single_type ───────────────────────────────────────────────────
    server.registerTool(
      "create_single_type",
      {
        title: "Create Single Type",
        description: "Create a new Single Type (singleton page schema e.g. 'Homepage', 'Contact Page') with fields and optional initial content data.",
        inputSchema: {
          name: z.string().describe("Display name (e.g. 'Homepage', 'Site Settings')"),
          slug: z.string().describe("URL-friendly slug (e.g. 'homepage', 'site-settings')"),
          description: z.string().optional().describe("Description of this single type"),
          fields: z.array(
            z.object({
              name: z.string(),
              slug: z.string(),
              type: z.enum(VALID_FIELD_TYPES),
              required: z.boolean().optional().default(false),
              options: z.record(z.string(), z.any()).optional(),
            })
          ).optional().describe("Field definitions"),
          initialData: z.record(z.string(), z.any()).optional().describe("Initial singleton content values"),
          locale: z.string().default("id").describe("Initial content locale (default 'id')"),
        },
      },
      async ({ name, slug, description, fields, initialData, locale }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const cleanSlug = toSafeSlug(slug)
        const tenantDb = await getTenantDb(auth.tenantSlug)

        const existing = await tenantDb.singleType.findFirst({
          where: { tenantId: auth.tenantId, slug: cleanSlug, draftTemplateId: null }
        })
        if (existing) return { content: [{ type: "text" as const, text: `❌ Single Type '${cleanSlug}' already exists.` }] }

        const initialLocale = locale || "id"
        const created = await tenantDb.singleType.create({
          data: {
            tenantId: auth.tenantId,
            name: name.trim(),
            slug: cleanSlug,
            description: description || null,
            isPublished: true,
            schemaFields: {
              create: (fields || []).map((f, idx) => ({
                name: f.name,
                slug: toSafeSlug(f.slug),
                type: f.type,
                required: f.required || false,
                options: f.options || {},
                order: idx,
              }))
            },
            tenants: {
              create: {
                tenantId: auth.tenantId,
                locale: initialLocale,
                data: initialData || {},
                publishedAt: new Date()
              }
            }
          },
          include: {
            schemaFields: { orderBy: { order: "asc" } },
            tenants: true
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Single Type '${created.name}' (slug: '${created.slug}') created successfully.\n\n${JSON.stringify(created, null, 2)}`
          }]
        }
      }
    )

    // ── update_single_type_content ───────────────────────────────────────────
    server.registerTool(
      "update_single_type_content",
      {
        title: "Update Single Type Content",
        description: "Save or update the singleton content values stored in a Single Type (e.g. hero banner title, footer links).",
        inputSchema: {
          singleTypeSlug: z.string().describe("Slug of the Single Type (e.g. 'homepage')"),
          data: z.record(z.string(), z.any()).describe("JSON object of content values"),
          locale: z.string().default("id").describe("Content locale (default 'id')"),
        },
      },
      async ({ singleTypeSlug, data, locale }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const targetLocale = locale || "id"
        const st = await tenantDb.singleType.findFirst({
          where: {
            draftTemplateId: null,
            OR: [
              { slug: singleTypeSlug, tenantId: auth.tenantId },
              { id: singleTypeSlug, tenantId: auth.tenantId },
            ]
          }
        })
        if (!st) return { content: [{ type: "text" as const, text: `❌ Single Type '${singleTypeSlug}' not found.` }] }

        const assignment = await tenantDb.tenantSingleTypeAssignment.upsert({
          where: {
            tenantId_singleTypeId_locale: {
              tenantId: auth.tenantId,
              singleTypeId: st.id,
              locale: targetLocale
            }
          },
          update: {
            data: data || {},
            publishedAt: new Date(),
          },
          create: {
            tenantId: auth.tenantId,
            singleTypeId: st.id,
            locale: targetLocale,
            data: data || {},
            publishedAt: new Date(),
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Single Type '${st.slug}' (${targetLocale}) content saved successfully.\n\n${JSON.stringify(assignment, null, 2)}`
          }]
        }
      }
    )

    // ── update_single_type ───────────────────────────────────────────────────
    server.registerTool(
      "update_single_type",
      {
        title: "Update Single Type Schema",
        description: "Update an existing Single Type's name, description, or add/replace its schema fields.",
        inputSchema: {
          singleTypeSlug: z.string().describe("Slug or ID of the Single Type to update"),
          name: z.string().optional().describe("New display name"),
          description: z.string().optional().describe("New description"),
          fields: z.array(
            z.object({
              name: z.string(),
              slug: z.string(),
              type: z.enum(VALID_FIELD_TYPES),
              required: z.boolean().optional().default(false),
              options: z.record(z.string(), z.any()).optional(),
            })
          ).optional().describe("New list of fields. If provided (including an empty array), replaces the schema field set."),
        },
      },
      async ({ singleTypeSlug, name, description, fields }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const st = await tenantDb.singleType.findFirst({
          where: {
            draftTemplateId: null,
            OR: [
              { slug: singleTypeSlug, tenantId: auth.tenantId },
              { id: singleTypeSlug, tenantId: auth.tenantId },
            ]
          }
        })
        if (!st) return { content: [{ type: "text" as const, text: `❌ Single Type '${singleTypeSlug}' not found.` }] }

        // Update fields if provided — an explicit empty array clears them.
        if (fields !== undefined) {
          await tenantDb.schemaField.deleteMany({
            where: { singleTypeId: st.id }
          })
          if (fields.length > 0) {
            await tenantDb.schemaField.createMany({
              data: fields.map((f, idx) => ({
                singleTypeId: st.id,
                name: f.name,
                slug: toSafeSlug(f.slug),
                type: f.type,
                required: f.required || false,
                options: f.options || {},
                order: idx,
              }))
            })
          }
        }

        const updated = await tenantDb.singleType.update({
          where: { id: st.id },
          data: {
            ...(name ? { name: name.trim() } : {}),
            ...(description !== undefined ? { description } : {}),
          },
          include: {
            schemaFields: { orderBy: { order: "asc" } },
            tenants: { where: { tenantId: auth.tenantId }, take: 1 },
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Single Type '${updated.name}' updated successfully.\n\n${JSON.stringify(updated, null, 2)}`
          }]
        }
      }
    )

    // ── delete_single_type ───────────────────────────────────────────────────
    server.registerTool(
      "delete_single_type",
      {
        title: "Delete Single Type",
        description: "Permanently delete a Single Type, its schema fields, and its stored content data.",
        inputSchema: {
          singleTypeSlug: z.string().describe("Slug or ID of the Single Type to delete"),
        },
      },
      async ({ singleTypeSlug }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "delete")) return permissionDenied("delete")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const st = await tenantDb.singleType.findFirst({
          where: {
            draftTemplateId: null,
            OR: [
              { slug: singleTypeSlug, tenantId: auth.tenantId },
              { id: singleTypeSlug, tenantId: auth.tenantId },
            ]
          }
        })
        if (!st) return { content: [{ type: "text" as const, text: `❌ Single Type '${singleTypeSlug}' not found.` }] }

        const dependent = await checkRelationDependents(tenantDb, auth.tenantId, st.slug, { singleTypeId: st.id })
        if (dependent) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Cannot delete Single Type '${st.name}' — field '${dependent.fieldName}' on '${dependent.parentName}' still references it via relationSlug. Remove or repoint that field first.`
            }],
            isError: true,
          }
        }

        await tenantDb.singleType.delete({ where: { id: st.id } })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Single Type '${st.name}' (slug: '${st.slug}') deleted successfully.`
          }]
        }
      }
    )

    // =========================================================================
    // 5. COMPONENTS (REUSABLE NESTED BLOCKS) CRUD
    // =========================================================================

    // ── list_components ──────────────────────────────────────────────────────
    server.registerTool(
      "list_components",
      {
        title: "List Components",
        description: "List all reusable Components (e.g. Hero Section, Feature Card, FAQ Item, SEO Meta block) with their field schemas.",
        inputSchema: {},
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const result = await listComponentsForTenant(tenantDb, auth.tenantId)

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── create_component ─────────────────────────────────────────────────────
    server.registerTool(
      "create_component",
      {
        title: "Create Component",
        description: "Create a new reusable Component schema definition that can be embedded inside Content Types and Single Types.",
        inputSchema: {
          name: z.string().describe("Display name (e.g. 'Hero Banner', 'Call To Action')"),
          slug: z.string().describe("Slug identifier (e.g. 'hero-banner', 'cta-box')"),
          category: z.string().optional().default("sections").describe("Component category (e.g. 'sections', 'elements', 'meta')"),
          description: z.string().optional().describe("Description of this component"),
          fields: z.array(
            z.object({
              name: z.string(),
              slug: z.string(),
              type: z.enum(VALID_FIELD_TYPES),
              required: z.boolean().optional().default(false),
              options: z.record(z.string(), z.any()).optional(),
            })
          ).optional().describe("List of component field definitions"),
        },
      },
      async ({ name, slug, category, description, fields }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const cleanSlug = toSafeSlug(slug)
        const tenantDb = await getTenantDb(auth.tenantSlug)

        const existing = await tenantDb.component.findFirst({
          where: { tenantId: auth.tenantId, slug: cleanSlug, draftTemplateId: null }
        })
        if (existing) return { content: [{ type: "text" as const, text: `❌ Component '${cleanSlug}' already exists.` }] }

        const created = await tenantDb.component.create({
          data: {
            tenantId: auth.tenantId,
            name: name.trim(),
            slug: cleanSlug,
            category: category || "sections",
            description: description || null,
            schemaFields: {
              create: (fields || []).map((f, idx) => ({
                name: f.name,
                slug: toSafeSlug(f.slug),
                type: f.type,
                required: f.required || false,
                options: f.options || {},
                order: idx,
              }))
            },
            tenants: {
              create: {
                tenantId: auth.tenantId,
              }
            }
          },
          include: {
            schemaFields: { orderBy: { order: "asc" } }
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Component '${created.name}' (slug: '${created.slug}') created successfully.\n\n${JSON.stringify(created, null, 2)}`
          }]
        }
      }
    )

    // ── get_component ────────────────────────────────────────────────────────
    server.registerTool(
      "get_component",
      {
        title: "Get Component",
        description: "Fetch schema fields and metadata for a specific Component.",
        inputSchema: {
          componentSlug: z.string().describe("Slug or ID of the Component (e.g. 'hero-banner', 'cta-box')"),
        },
      },
      async ({ componentSlug }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const c = await tenantDb.component.findFirst({
          where: {
            draftTemplateId: null,
            OR: [
              { slug: componentSlug, tenantId: auth.tenantId },
              { id: componentSlug, tenantId: auth.tenantId },
            ]
          },
          include: { schemaFields: { orderBy: { order: "asc" } } },
        })
        if (!c) return { content: [{ type: "text" as const, text: `❌ Component '${componentSlug}' not found.` }] }

        const result = {
          id: c.id,
          name: c.name,
          slug: c.slug,
          category: c.category,
          description: c.description,
          fields: c.schemaFields.map(f => ({
            id: f.id,
            name: f.name,
            slug: f.slug,
            type: f.type,
            required: f.required,
            options: f.options
          }))
        }

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── update_component ─────────────────────────────────────────────────────
    server.registerTool(
      "update_component",
      {
        title: "Update Component",
        description: "Update an existing Component's name, category, description, or add/replace its schema fields.",
        inputSchema: {
          componentSlug: z.string().describe("Current slug or ID of the Component to update"),
          name: z.string().optional().describe("New display name"),
          category: z.string().optional().describe("New category (e.g. 'sections', 'elements', 'meta')"),
          description: z.string().optional().describe("New description"),
          fields: z.array(
            z.object({
              name: z.string(),
              slug: z.string(),
              type: z.enum(VALID_FIELD_TYPES),
              required: z.boolean().optional().default(false),
              options: z.record(z.string(), z.any()).optional(),
            })
          ).optional().describe("New list of fields. If provided (including an empty array), replaces the component's field set."),
        },
      },
      async ({ componentSlug, name, category, description, fields }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const c = await tenantDb.component.findFirst({
          where: {
            draftTemplateId: null,
            OR: [
              { slug: componentSlug, tenantId: auth.tenantId },
              { id: componentSlug, tenantId: auth.tenantId },
            ]
          }
        })
        if (!c) return { content: [{ type: "text" as const, text: `❌ Component '${componentSlug}' not found.` }] }

        // Update fields if provided — an explicit empty array clears them.
        if (fields !== undefined) {
          await tenantDb.schemaField.deleteMany({
            where: { componentId: c.id }
          })
          if (fields.length > 0) {
            await tenantDb.schemaField.createMany({
              data: fields.map((f, idx) => ({
                componentId: c.id,
                name: f.name,
                slug: toSafeSlug(f.slug),
                type: f.type,
                required: f.required || false,
                options: f.options || {},
                order: idx,
              }))
            })
          }
        }

        const updated = await tenantDb.component.update({
          where: { id: c.id },
          data: {
            ...(name ? { name: name.trim() } : {}),
            ...(category ? { category: category.trim() } : {}),
            ...(description !== undefined ? { description } : {}),
          },
          include: {
            schemaFields: { orderBy: { order: "asc" } }
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Component '${updated.name}' updated successfully.\n\n${JSON.stringify(updated, null, 2)}`
          }]
        }
      }
    )

    // ── delete_component ─────────────────────────────────────────────────────
    server.registerTool(
      "delete_component",
      {
        title: "Delete Component",
        description: "Permanently delete a Component and its schema fields.",
        inputSchema: {
          componentSlug: z.string().describe("Slug or ID of the Component to delete"),
        },
      },
      async ({ componentSlug }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "delete")) return permissionDenied("delete")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const c = await tenantDb.component.findFirst({
          where: {
            draftTemplateId: null,
            OR: [
              { slug: componentSlug, tenantId: auth.tenantId },
              { id: componentSlug, tenantId: auth.tenantId },
            ]
          }
        })
        if (!c) return { content: [{ type: "text" as const, text: `❌ Component '${componentSlug}' not found.` }] }

        const usedByCount = await countComponentDependents(tenantDb, auth.tenantId, c.slug)
        if (usedByCount > 0) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Cannot delete Component '${c.name}' — still used by ${usedByCount} schema field${usedByCount === 1 ? "" : "s"}. Remove or repoint those fields first.`
            }],
            isError: true,
          }
        }

        await tenantDb.component.delete({ where: { id: c.id } })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Component '${c.name}' (slug: '${c.slug}') deleted successfully.`
          }]
        }
      }
    )

    // =========================================================================
    // 6. WEBHOOKS CRUD & AUTOMATION
    // =========================================================================

    // ── list_webhooks ────────────────────────────────────────────────────────
    server.registerTool(
      "list_webhooks",
      {
        title: "List Webhooks",
        description: "List all configured webhooks, their subscribed events, URLs, and status.",
        inputSchema: {},
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const webhooks = await tenantDb.webhook.findMany({
          where: { tenantId: auth.tenantId },
          orderBy: { createdAt: "desc" },
        })

        const result = webhooks.map(redactWebhook)

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── get_webhook ──────────────────────────────────────────────────────────
    server.registerTool(
      "get_webhook",
      {
        title: "Get Webhook",
        description: "Fetch details, subscribed events, endpoint URL, and status of a specific webhook by ID.",
        inputSchema: {
          id: z.string().describe("ID of the webhook to retrieve"),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const webhook = await tenantDb.webhook.findFirst({
          where: { id, tenantId: auth.tenantId },
        })
        if (!webhook) {
          return {
            content: [{ type: "text" as const, text: `❌ Webhook '${id}' not found.` }],
            isError: true,
          }
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(redactWebhook(webhook), null, 2)
          }]
        }
      }
    )

    // ── create_webhook ───────────────────────────────────────────────────────
    server.registerTool(
      "create_webhook",
      {
        title: "Create Webhook",
        description: "Register a new webhook endpoint to receive notifications on CMS events (e.g. 'content.created', 'content.published', 'content.updated', 'content.deleted', 'media.uploaded').",
        inputSchema: {
          name: z.string().describe("Descriptive name (e.g. 'Build Trigger', 'Discord Notification')"),
          url: z.string().url().describe("Destination endpoint URL (must start with https:// or http://)"),
          events: z.array(z.string()).min(1).describe("Array of event names (e.g. ['content.created', 'content.published', 'content.deleted']) — at least one required, or the webhook will never fire"),
          secret: z.string().optional().describe("Optional HMAC signature secret"),
          enabled: z.boolean().default(true).describe("Whether the webhook is immediately active"),
          hookType: z.enum(["async", "sync"]).default("async").describe("Hook type ('async' background dispatch or 'sync' pre-save validation)"),
        },
      },
      async ({ name, url, events, secret, enabled, hookType }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        try {
          const { assertPublicUrl } = await import("@/lib/safe-url")
          await assertPublicUrl(url.trim())
        } catch (e: any) {
          return { content: [{ type: "text" as const, text: `❌ Webhook URL rejected: ${e?.message || "not allowed"}` }] }
        }

        const tenantDb = await getTenantDb(auth.tenantSlug)

        // One tenant-level cap, same bucket the dashboard's own webhook
        // creation lacks today too — bounded here first since this is a
        // new, easily-scriptable trigger for an unbounded "webhook storm".
        const existingCount = await tenantDb.webhook.count({ where: { tenantId: auth.tenantId } })
        if (existingCount >= 20) {
          return { content: [{ type: "text" as const, text: `❌ Batas maksimum 20 webhook per workspace sudah tercapai. Hapus webhook yang tidak terpakai sebelum membuat yang baru.` }], isError: true }
        }

        const webhook = await tenantDb.webhook.create({
          data: {
            tenantId: auth.tenantId,
            name: name.trim(),
            url: url.trim(),
            events: events as any,
            secret: secret || null,
            enabled: enabled ?? true,
            hookType: hookType || "async",
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Webhook '${webhook.name}' (ID: '${webhook.id}') created successfully targeting ${webhook.url}.\n\n${JSON.stringify(redactWebhook(webhook), null, 2)}`
          }]
        }
      }
    )

    // ── update_webhook ───────────────────────────────────────────────────────
    server.registerTool(
      "update_webhook",
      {
        title: "Update Webhook",
        description: "Update an existing webhook configuration (name, URL, subscribed events, active state).",
        inputSchema: {
          id: z.string().describe("ID of the webhook to update"),
          name: z.string().optional(),
          url: z.string().url().optional(),
          events: z.array(z.string()).min(1).optional(),
          enabled: z.boolean().optional(),
          secret: z.string().optional(),
        },
      },
      async ({ id, name, url, events, enabled, secret }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const existing = await tenantDb.webhook.findFirst({
          where: { id, tenantId: auth.tenantId }
        })
        if (!existing) return { content: [{ type: "text" as const, text: `❌ Webhook '${id}' not found.` }], isError: true }

        if (url) {
          try {
            const { assertPublicUrl } = await import("@/lib/safe-url")
            await assertPublicUrl(url.trim())
          } catch (e: any) {
            return { content: [{ type: "text" as const, text: `❌ Webhook URL rejected: ${e?.message || "not allowed"}` }] }
          }
        }

        const updated = await tenantDb.webhook.update({
          where: { id, tenantId: auth.tenantId },
          data: {
            ...(name ? { name: name.trim() } : {}),
            ...(url ? { url: url.trim() } : {}),
            ...(events ? { events: events as any } : {}),
            ...(enabled !== undefined ? { enabled } : {}),
            ...(secret !== undefined ? { secret } : {}),
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Webhook '${updated.name}' updated successfully.\n\n${JSON.stringify(redactWebhook(updated), null, 2)}`
          }]
        }
      }
    )

    // ── delete_webhook ───────────────────────────────────────────────────────
    server.registerTool(
      "delete_webhook",
      {
        title: "Delete Webhook",
        description: "Permanently delete a webhook configuration and its log history.",
        inputSchema: {
          id: z.string().describe("ID of the webhook to delete"),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "delete")) return permissionDenied("delete")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const existing = await tenantDb.webhook.findFirst({
          where: { id, tenantId: auth.tenantId }
        })
        if (!existing) return { content: [{ type: "text" as const, text: `❌ Webhook '${id}' not found.` }], isError: true }

        await tenantDb.webhook.delete({ where: { id, tenantId: auth.tenantId } })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Webhook '${existing.name}' (${existing.url}) deleted successfully.`
          }]
        }
      }
    )

    // ── test_webhook ─────────────────────────────────────────────────────────
    server.registerTool(
      "test_webhook",
      {
        title: "Test Webhook",
        description: "Dispatch a mock test event to a webhook endpoint to verify its connectivity and response status.",
        inputSchema: {
          id: z.string().describe("ID of the webhook to test"),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const webhook = await tenantDb.webhook.findFirst({
          where: { id, tenantId: auth.tenantId }
        })
        if (!webhook) return { content: [{ type: "text" as const, text: `❌ Webhook '${id}' not found.` }] }

        const testPayload = {
          event: "webhook.test",
          timestamp: new Date().toISOString(),
          workspace: {
            id: auth.tenantId,
            name: auth.tenantName,
            slug: auth.tenantSlug
          },
          message: "This is a test notification from SaCMS MCP Server."
        }

        const start = Date.now()
        try {
          const res = await safeFetch(webhook.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "SaCMS-MCP-Webhook/1.0",
              ...(webhook.secret ? { "X-SaCMS-Signature": "test-signature" } : {}),
            },
            body: JSON.stringify(testPayload),
          })
          const duration = Date.now() - start

          return {
            content: [{
              type: "text" as const,
              text: `✅ Webhook test completed in ${duration}ms with HTTP Status ${res.status} (${res.statusText}).`
            }]
          }
        } catch (error: any) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Webhook test failed: ${error.message || "Endpoint unreachable"}`
            }]
          }
        }
      }
    )

    // =========================================================================
    // 7. API INFORMATION & CAPABILITY INSPECTOR
    // =========================================================================

    // ── inspect_api_capabilities ─────────────────────────────────────────────
    server.registerTool(
      "inspect_api_capabilities",
      {
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
        const { resolveApiOrigin } = await import("@/lib/infrastructure/frontend-env")
        const origin = baseUrl?.replace(/\/$/, "") || resolveApiOrigin()
        const apiBase = `${origin}/api/public/${auth.tenantSlug}`

        const docs = `# SaCMS API & MCP Integration Guide — Workspace: ${auth.tenantName}

## Base URL
${apiBase}

## Authentication Header
Authorization: Bearer YOUR_API_TOKEN

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
    headers: { Authorization: \`Bearer \${process.env.SACMS_TOKEN}\` },
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
        title: "Get Agent Playbook (Start Here)",
        description: "Read this FIRST when you connect to this MCP server. Returns the recommended, ordered workflow for building or updating a frontend against this SaCMS workspace — which tools to call, in what order, and how schema, content, and deployment fit together. Call with no arguments.",
        inputSchema: {},
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const playbook = `# SaCMS Agent Playbook — Workspace: ${auth.tenantName}

You are connected to a live, real headless CMS workspace via MCP. Follow these phases IN ORDER — do not invent Content Types, fields, or data; everything must come from these tools.

## Phase 1 — Discover the real schema
1. Call \`get_full_schema\` (or \`get_openapi_spec\` if you want it as an OpenAPI document) to get every Content Type, Single Type, and Component with their exact fields and types.
2. Call \`list_field_types\` if you need to know what a given field \`type\` (e.g. \`relation\`, \`component\`, \`seo\`, \`media\`) actually means and how it's shaped in API responses.
3. If the schema is missing something the user asked for, use \`create_content_type\` / \`update_content_type\` / \`create_component\` / \`create_single_type\` etc. to extend it — the schema has no "finalized/locked" state, it's always editable.

## Phase 2 — Explore real content before writing any UI
4. Call \`query_content\` (or \`get_single_type\`) for each relevant type to see ACTUAL records — real field values, not assumptions. This tells you what's actually populated vs. empty.
5. Never hardcode placeholder text/images in the frontend for anything that has a schema field — render from the real data instead, even if a given record is currently empty.

## Phase 3 — Scaffold the frontend
6. For each Content Type: build a list page + a detail page. For each Single Type: build its one dedicated page (e.g. homepage, about, site-settings feed the header/footer).
7. Map every field type to the right UI primitive: \`media\`→image/file, \`mediaMultiple\`→gallery, \`richText\`/\`markdown\`→rendered HTML, \`relation\`→linked record, \`component\`/\`repeater\`→nested group, \`seo\`→meta tags, \`color\`→theme token, \`currency\`/\`percent\`/\`rating\`→formatted number.
8. Fetch data either by calling these MCP tools directly during generation, OR from the generated app's own runtime via the REST/GraphQL API — call \`get_api_info\` for the base URL, auth header, filtering/pagination syntax, and a ready-to-paste Next.js sample. Call \`get_or_create_api_key\` if the generated app needs its own long-lived token.
9. If the frontend needs a third-party API key (e.g. a payment, print-on-demand, or maps provider), call \`list_deployment_env\` FIRST to check whether it's already configured — if the key name is already there, just reference \`process.env.<KEY>\` in your code; do not ask the user to paste the secret into chat, and do not invent an env var name without checking. If it's missing, tell the user the exact variable name to set (via the dashboard's Environment tab or \`add_deployment_env\`) before the code can work end to end.

## Phase 4 — Ship it
10. Once the frontend works, call \`deploy_to_sacms\` to publish it to this workspace's managed hosting (one Vercel project per workspace, idempotent — safe to call again after edits).
11. Check \`get_deployment_status\` to confirm it's live. Use \`configure_deployment_domain\` for a custom domain, \`add_deployment_env\`/\`list_deployment_env\` to manage env vars, and \`make_deployment_public\` if a preview URL needs to be opened up.

## Rules that apply throughout
- Never guess a base URL, token, or domain — every tool above resolves the real one for this workspace automatically.
- Content Entry mutations (\`create_content_entry\`/\`update_content_entry\`/\`delete_content_entry\`) go through the same validation/RBAC as the dashboard — they will reject invalid data, that's expected.
- Webhooks (\`list_webhooks\`/\`create_webhook\`/\`test_webhook\`) exist if the user wants this workspace to notify an external system on content changes — unrelated to frontend scaffolding.
- This playbook applies to every connection — re-read it any time you're unsure what to do next, instead of guessing the shape of this workspace's data.`

        return { content: [{ type: "text" as const, text: playbook }] }
      }
    )

    // ── get_openapi_spec ─────────────────────────────────────────────────────
    server.registerTool(
      "get_openapi_spec",
      {
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
                note: "This key already existed. Its secret was shown only once at creation and cannot be recovered here — ask the workspace owner, or revoke it from Developer & API → API Keys and call this tool again to mint a fresh one.",
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
    // 8. HOSTING & CLOUD DEPLOYMENT TOOLS (SACMS CLOUD HOSTING)
    // =========================================================================

    // ── deploy_to_sacms ──────────────────────────────────────────────────────
    server.registerTool(
      "deploy_to_sacms",
      {
        title: "Deploy Website / App to SaCMS Cloud Hosting",
        description: "Deploy generated website frontend files (Next.js, HTML, React) directly to SaCMS Cloud Hosting. Returns the live production deployment URL. Always deploys to this workspace's single hosting project (same one the dashboard's deploy button and AI Site's Publish use) — repeat calls update that same project rather than creating a new one.",
        inputSchema: {
          projectName: z.string().optional().describe("Ignored — kept only for backward compatibility with older callers. The deploy always targets this workspace's one locked hosting project, never a caller-chosen name (a different name here would silently orphan the previous project from configure_deployment_domain/add_deployment_env/make_deployment_public, which only ever manage the workspace's current project)."),
          files: z.array(z.object({
            name: z.string().describe("File path (e.g. 'app/page.tsx', 'index.html', 'styles.css')"),
            content: z.string().describe("Raw source code content of the file")
          })).describe("Array of files to deploy"),
          envVars: z.record(z.string(), z.string()).optional().describe("Extra env vars for this deploy, merged on top of the workspace's saved Environment vars (the SaCMS API URL/tenant/key are always injected automatically)")
        },
      },
      async ({ files, envVars }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        if (!auth.isHostingPlanPaid) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Payment Required: Fitur deploy SaCMS Cloud Hosting memerlukan workspace berstatus PAID. Silakan selesaikan pembayaran di dashboard: /dashboard/${auth.tenantSlug}/subscriptions`
            }],
            isError: true,
          }
        }

        // A dedicated cooldown, separate from the general per-tenant MCP
        // rate limit (shared with cheap read calls) — each deploy triggers
        // a real Vercel build, so an uncapped loop here runs up real
        // hosting/build cost even within the general limit's budget.
        const deployLimit = await rateLimit(`mcp_deploy:${auth.tenantId}`, { limit: 3, windowSeconds: 300 })
        if (!deployLimit.success) {
          return {
            content: [{ type: "text" as const, text: "❌ Terlalu banyak percobaan deploy. Maksimal 3 deploy per 5 menit per workspace — coba lagi sebentar." }],
            isError: true,
          }
        }

        try {
          // Assemble the workspace's full frontend env (saved Environment
          // vars + fixed SACMS_* connection vars), then let the caller's
          // envVars override any non-reserved key.
          const { resolveFrontendEnv, pushEnvToVercelProject, resolveApiOrigin } = await import(
            "@/lib/infrastructure/frontend-env"
          )
          const resolvedEnv = await resolveFrontendEnv(auth.tenantId, auth.tenantSlug, resolveApiOrigin())
          const mergedEnv: Record<string, string> = { ...(envVars as Record<string, string> | undefined), ...resolvedEnv }

          // Same fixed naming convention as deployTenantFrontend()
          // (dashboard deploy button, AI Site Publish) — one hosting
          // project per tenant, always. A caller-chosen name here would
          // create a second, parallel project on a later call and orphan
          // the first one from configure_deployment_domain/
          // add_deployment_env/make_deployment_public, which only ever
          // resolve the workspace's *current* vercelProjectId.
          const lockedProjectName = `sacms-${auth.tenantSlug}`
          const result = await deployToVercel(lockedProjectName, files, mergedEnv)

          if (result.projectId && !result.simulated) {
            pushEnvToVercelProject(result.projectId, mergedEnv).catch((e) =>
              console.warn("[MCP deploy_to_sacms] env push failed:", e),
            )
          }

          if (auth.tenantId && result.url) {
            try {
              await Promise.all([
                db.tenant.update({
                  where: { id: auth.tenantId },
                  data: {
                    vercelDeploymentUrl: result.url,
                    vercelProjectId: result.projectId || undefined,
                  }
                }),
                db.setting.upsert({
                  where: { key: `${auth.tenantId}_vercelDeploymentUrl` },
                  update: { value: result.url },
                  create: { tenantId: auth.tenantId, key: `${auth.tenantId}_vercelDeploymentUrl`, value: result.url }
                }),
                db.setting.upsert({
                  where: { key: `${auth.tenantId}_vercelProjectId` },
                  update: { value: result.projectId || "" },
                  create: { tenantId: auth.tenantId, key: `${auth.tenantId}_vercelProjectId`, value: result.projectId || "" }
                }),
              ])
            } catch (persistErr) {
              console.warn("[MCP deploy_to_sacms] Failed to persist deployment to database:", persistErr)
            }
          }

          return {
            content: [{
              type: "text" as const,
              text: `🚀 Deploy ke SaCMS Cloud Hosting Sukses!\n- Deployment ID: ${result.id}\n- Live URL: ${result.url}\n- Status: ${result.state}\n- Project: ${result.projectName || lockedProjectName}\n- Env terkirim: ${Object.keys(mergedEnv).join(", ")}`
            }]
          }
        } catch (err: any) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Gagal deploy ke SaCMS Cloud Hosting: ${err.message}`
            }],
            isError: true,
          }
        }
      }
    )

    // ── get_deployment_status ────────────────────────────────────────────────
    server.registerTool(
      "get_deployment_status",
      {
        title: "Get Deployment Status",
        description: "Check the build progress, ready state, and live URL of an existing SaCMS Cloud Hosting deployment.",
        inputSchema: {
          deploymentId: z.string().describe("Deployment ID (e.g. 'dpl_xxx')"),
        },
      },
      async ({ deploymentId }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        try {
          const status = await getDeploymentStatus(deploymentId)

          // Reject a deployment that belongs to a different tenant's
          // project — deploymentId alone carries no tenant scoping, so
          // without this any token could poll any tenant's build state and
          // live URL by guessing/observing an id.
          if (status.projectId) {
            const tenant = await db.tenant.findUnique({ where: { id: auth.tenantId }, select: { vercelProjectId: true } })
            if (tenant?.vercelProjectId && tenant.vercelProjectId !== status.projectId) {
              return {
                content: [{ type: "text" as const, text: `❌ Deployment '${deploymentId}' bukan milik workspace ini.` }],
                isError: true,
              }
            }
          }

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                deploymentId,
                state: status.state,
                url: status.url,
                isReady: status.state === "READY",
              }, null, 2)
            }]
          }
        } catch (err: any) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Error memeriksa status deployment: ${err.message}`
            }],
            isError: true,
          }
        }
      }
    )

    // ── configure_deployment_domain ──────────────────────────────────────────
    server.registerTool(
      "configure_deployment_domain",
      {
        title: "Configure Custom Domain on a Deployment Project",
        description: "Attach and verify a custom apex domain or subdomain to a SaCMS Cloud Hosting deployment project, with DNS diagnostics.",
        inputSchema: {
          projectId: z.string().optional().describe("Deployment Project ID. Defaults to this workspace's linked deployment project."),
          domain: z.string().describe("Custom domain name (e.g. 'mysite.com' or 'blog.mysite.com')"),
        },
      },
      async ({ projectId, domain }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        if (!auth.isHostingPlanPaid) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Payment Required: Konfigurasi custom domain memerlukan workspace berstatus PAID. Silakan selesaikan pembayaran di dashboard: /dashboard/${auth.tenantSlug}/subscriptions`
            }],
            isError: true,
          }
        }

        try {
          const resolved = await resolveOwnProjectId(auth, projectId)
          if (!resolved.ok) return resolved.response

          const result = await addDomainToProject(resolved.projectId, domain)
          const config = await getDomainConfig(domain)

          if (auth.tenantId) {
            try {
              await db.setting.upsert({
                where: { key: `${auth.tenantId}_customDomain` },
                update: { value: domain },
                create: { tenantId: auth.tenantId, key: `${auth.tenantId}_customDomain`, value: domain }
              })
            } catch (err) {
              console.warn("[MCP configure_deployment_domain] Failed to save customDomain setting:", err)
            }
          }
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                domain: result.name,
                verified: result.verified,
                verificationRequired: result.verificationRequired,
                dnsConfig: {
                  cnameTarget: config.cname,
                  aRecordTarget: config.aRecord,
                  configured: config.configured,
                  // When set, the check against the hosting provider itself
                  // failed — `configured: false` above does NOT mean the
                  // domain's DNS is actually wrong, just that we couldn't
                  // verify it.
                  checkError: config.error,
                },
                message: config.error
                  ? "⚠️ Domain ditambahkan, tapi pengecekan status DNS gagal — coba cek lagi nanti, ini bukan berarti DNS Anda salah."
                  : result.verified ? "✅ Domain terverifikasi dan aktif!" : "⚠️ Domain ditambahkan, silakan konfigurasi DNS record di registrar domain Anda."
              }, null, 2)
            }]
          }
        } catch (err: any) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Gagal mengonfigurasi domain: ${err.message}`
            }],
            isError: true,
          }
        }
      }
    )

    // ── add_deployment_env ───────────────────────────────────────────────────
    server.registerTool(
      "add_deployment_env",
      {
        title: "Add / Update Deployment Environment Variable",
        description:
          "Create or update an environment variable on this workspace's SaCMS Cloud Hosting deployment project (upsert). " +
          "Values are stored encrypted unless the key is prefixed NEXT_PUBLIC_. The variable also " +
          "shows up in the dashboard's Environment tab and is re-applied on the next SaCMS deploy. " +
          "Note: an existing deployment must be redeployed for the change to take effect.",
        inputSchema: {
          key: z
            .string()
            .regex(/^[A-Z_][A-Z0-9_]*$/, "Use UPPER_SNAKE_CASE (letters, digits, underscore; not starting with a digit)")
            .describe("Variable name, e.g. STRIPE_SECRET_KEY or NEXT_PUBLIC_ANALYTICS_ID"),
          value: z.string().describe("Variable value"),
          projectId: z
            .string()
            .optional()
            .describe("Deployment Project ID. Defaults to this workspace's linked deployment project."),
          targets: z
            .array(z.enum(["production", "preview", "development"]))
            .optional()
            .describe("Which environments to apply to. Default: all three."),
        },
      },
      async ({ key, value, projectId, targets }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        // Same PAID gate as deploy_to_sacms/configure_deployment_domain/
        // make_deployment_public — this tool was missing it, which let a
        // workspace whose subscription had lapsed since its last real
        // deploy still rewrite production env vars (including secrets) on
        // the project that deploy created.
        if (!auth.isHostingPlanPaid) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Payment Required: Mengatur environment variable deployment memerlukan workspace berstatus PAID. Silakan selesaikan pembayaran di dashboard: /dashboard/${auth.tenantSlug}/subscriptions`
            }],
            isError: true,
          }
        }

        const { RESERVED_ENV_KEYS } = await import("@/lib/infrastructure/frontend-env")
        if (RESERVED_ENV_KEYS.includes(key)) {
          return {
            content: [{ type: "text" as const, text: `❌ "${key}" adalah variabel sistem SaCMS dan tidak bisa ditimpa.` }],
            isError: true,
          }
        }

        try {
          const resolved = await resolveOwnProjectId(auth, projectId)
          if (!resolved.ok) return resolved.response
          const resolvedProjectId = resolved.projectId

          const result = await upsertVercelProjectEnv(
            resolvedProjectId,
            key,
            value,
            targets as VercelEnvTarget[] | undefined,
          )

          // Mirror into the tenant's stored custom env set so the dashboard
          // Environment tab stays in sync and the next SaCMS deploy re-applies it.
          if (auth.tenantId) {
            try {
              const { upsertTenantCustomEnvVar } = await import("@/lib/infrastructure/frontend-env")
              await upsertTenantCustomEnvVar(auth.tenantId, key, value)
            } catch (err) {
              console.warn("[MCP add_deployment_env] Failed to mirror env var into settings:", err)
            }
          }

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                key: result.key,
                type: result.type,
                targets: result.targets,
                action: result.simulated ? "simulated" : result.created ? "created" : "updated",
                projectId: resolvedProjectId,
                message: result.simulated
                  ? "⚠️ Kredensial deploy belum diset di platform — perubahan disimulasikan (tersimpan di dashboard, belum diterapkan ke hosting)."
                  : `✅ Variabel "${key}" ${result.created ? "dibuat" : "diperbarui"}. Redeploy project agar berlaku.`,
              }, null, 2),
            }],
          }
        } catch (err: any) {
          return {
            content: [{ type: "text" as const, text: `❌ Gagal set env: ${err.message}` }],
            isError: true,
          }
        }
      },
    )

    // ── list_deployment_env ──────────────────────────────────────────────────
    server.registerTool(
      "list_deployment_env",
      {
        title: "List Deployment Environment Variables",
        description:
          "List the environment variable KEY NAMES already configured for this workspace's deployment — " +
          "both system vars (auto-injected on every deploy, e.g. the SaCMS API connection vars) and custom " +
          "vars set via add_deployment_env or the dashboard's Environment tab. Returns NAMES ONLY, never " +
          "values — secrets are injected directly into the deployed app's own process.env at runtime and " +
          "never pass through this tool or this conversation. Call this BEFORE writing code that needs a " +
          "third-party API key (e.g. PRINTFUL_API_KEY) to check whether it's already configured, instead of " +
          "guessing a name or asking the user to paste the secret into chat — if it's already set, just " +
          "reference process.env.<KEY> in the generated code.",
        inputSchema: {},
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const { SYSTEM_ENV_VARS, getTenantCustomEnvVarList } = await import("@/lib/infrastructure/frontend-env")
        const customVars = auth.tenantId ? await getTenantCustomEnvVarList(auth.tenantId) : []

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              systemVars: SYSTEM_ENV_VARS.map((v) => ({ key: v.key, note: v.note })),
              customVars: customVars.map((v) => ({ key: v.key })),
            }, null, 2),
          }],
        }
      },
    )

    // ── make_deployment_public ───────────────────────────────────────────────
    server.registerTool(
      "make_deployment_public",
      {
        title: "Make Deployment Publicly Viewable",
        description:
          "Turn off deployment protection on this workspace's SaCMS Cloud Hosting project, so " +
          "its deployment links (including the per-deployment URL with a random suffix, e.g. " +
          "my-site-abc123-team.example.com — not just the clean production alias) can be opened by anyone with the " +
          "link, without needing to log in. This is a project-wide security setting change — only call it " +
          "when the user explicitly wants the deployment publicly viewable.",
        inputSchema: {
          projectId: z.string().optional().describe("Deployment Project ID. Defaults to this workspace's linked deployment project."),
        },
      },
      async ({ projectId }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        if (!auth.isHostingPlanPaid) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Payment Required: Mengatur visibilitas deployment memerlukan workspace berstatus PAID. Silakan selesaikan pembayaran di dashboard: /dashboard/${auth.tenantSlug}/subscriptions`
            }],
            isError: true,
          }
        }

        try {
          const resolved = await resolveOwnProjectId(auth, projectId)
          if (!resolved.ok) return resolved.response
          const resolvedProjectId = resolved.projectId

          const result = await disableVercelDeploymentProtection(resolvedProjectId)
          if (!result.ok) {
            return {
              content: [{ type: "text" as const, text: `❌ Gagal menonaktifkan proteksi: ${result.error}` }],
              isError: true,
            }
          }

          return {
            content: [{
              type: "text" as const,
              text: "✅ Proteksi deployment dinonaktifkan. Semua URL deployment project ini (termasuk URL per-deployment dengan akhiran acak) sekarang bisa dibuka siapa saja tanpa login.",
            }],
          }
        } catch (err: any) {
          return {
            content: [{ type: "text" as const, text: `❌ Gagal menonaktifkan proteksi: ${err.message}` }],
            isError: true,
          }
        }
      },
    )

    // Member (end-user) management intentionally has no MCP tools. Members
    // are the tenant's own app's end-users, managed through the dashboard's
    // Users & Permissions section (Strapi-parity model) — an AI agent
    // building schemas/content via MCP has no legitimate reason to create,
    // promote, or delete end-user accounts, and the tools that used to live
    // here skipped the dashboard's role-existence/status-enum validation
    // entirely. Removed rather than patched.

  },
  {
    serverInfo: { name: "sacms-mcp", version: "2.5.0" },
    // Many MCP clients (Claude Desktop/Code, Cursor, Windsurf, VS Code
    // Copilot) load a server's `instructions` into the model's context
    // automatically on connect — no manual invocation needed. This is the
    // mechanism behind "connect this MCP server and the agent already knows
    // the workflow" (as opposed to a slash-command/@-mention, which is a
    // per-client UI convention this protocol field doesn't control). Kept
    // short since it's injected into every conversation; the full ordered
    // workflow lives in the get_agent_playbook tool for clients that ignore
    // this field or that an agent wants to re-read on demand.
    instructions:
      "This server gives you live access to one SaCMS workspace's headless CMS: its schema, content, and deploy pipeline. Before writing any frontend code or answering questions about this workspace's data, call get_agent_playbook once — it has the full ordered workflow (discover schema → explore real content → scaffold → deploy). Never invent Content Types, fields, or data; everything must come from these tools. Never guess a base URL, token, or domain — call get_api_info / get_openapi_spec instead, they resolve the real ones automatically.",
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
async function handleMcpRequest(req: Request): Promise<Response> {
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
      return NextResponse.json({ error: "Unauthorized: Invalid or missing API token." }, { status: 401 })
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
