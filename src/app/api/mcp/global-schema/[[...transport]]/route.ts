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
 * "skins" for the same structure). It can inspect a template's linked
 * internal demo schema. Customer workspaces use the separate /api/mcp server.
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
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { slugify } from "@/lib/slug"
import { rateLimit } from "@/lib/rate-limit"
import { schemaTemplateBundleSchema, schemaTemplateFieldSchema } from "@/lib/validations/schema-template"
import { websiteTemplateFilesSchema } from "@/lib/validations/website-template"
import { createGlobalComponentSchema, updateGlobalComponentSchema } from "@/lib/validations/global-component"
import { FIELD_TYPES, FIELD_CATEGORIES } from "@/lib/field-types"
import { FIELD_TYPE_GUIDE, CONTENT_API_CONTRACT_EXAMPLES } from "@/lib/field-type-guide"
import { formatZodPath, validateBundleReferences, splitIssuesBySeverity, validateGlobalComponentFields } from "@/lib/schema-template-validation"
import { composeTemplateStarterSchema, protectedSchemaModelIssues } from "@/lib/infrastructure/template-starter-schema"
import { serializeTenantSchema, type SchemaBlob } from "@/lib/schema-template-sync"
import type { Prisma } from "@prisma/client"
import {
  DEMO_MEDIA_MAX_BYTES, DEMO_MEDIA_TYPES, DemoContentError,
  getDemoSingleTypeEntry, updateDemoSingleTypeEntry, listDemoContentEntries, saveDemoContentEntry, uploadDemoMedia, resetDemoContent,
} from "@/lib/infrastructure/demo-content"

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
function notFound(entity: "Schema Template" | "Website Template" | "Global Component", id: string) {
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

/**
 * chatgpt (Kabar Nusa report) P0: this used to spread `...t` — every scalar
 * AND relation Prisma handed back, not just what WEBSITE_TEMPLATE_OUTPUT_SHAPE
 * declares. get_website_template's own query does `include: { schemaTemplate:
 * {...} } }`, so the result carried an undeclared `schemaTemplate: {...}`
 * object (plus `createdBy`) alongside the real fields — confirmed live as
 * exactly why Claude Code rejected get_website_template/get_schema_template's
 * output at the protocol layer (an MCP client validates structuredContent
 * against outputSchema and has no reason to accept extra, undeclared keys).
 * Pick exactly the declared shape instead of trusting every caller's query
 * to never select more than that.
 */
function serializeWebsiteTemplate(t: {
  id: string
  name: string
  slug: string
  schemaTemplateId: string
  icon: string
  description: string | null
  files: unknown
  published: boolean
  createdAt: Date
  updatedAt: Date
  sourceVersion: Date
  demoVercelProjectId: string | null
  demoUrl: string | null
  demoDeployedAt: Date | null
  demoDeploymentId: string | null
}) {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    schemaTemplateId: t.schemaTemplateId,
    icon: t.icon,
    description: t.description,
    files: t.files,
    published: t.published,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    sourceVersion: t.sourceVersion.toISOString(),
    demoVercelProjectId: t.demoVercelProjectId,
    demoUrl: t.demoUrl,
    demoDeployedAt: t.demoDeployedAt ? t.demoDeployedAt.toISOString() : null,
    demoDeploymentId: t.demoDeploymentId,
  }
}

/**
 * Fourth external audit, OUT-9: create_website_template/update_website_template/
 * redeploy_website_template_demo all returned the FULL `files` array (often
 * ~150-200KB) on every single call — a caller who just created/updated the
 * template already HAS the files it sent, and a redeploy doesn't change
 * them at all, so resending the whole bundle back is pure waste. Only
 * get_website_template (whose entire purpose IS reading `files`, with its
 * own listPathsOnly/paths filtering) keeps the full shape.
 */
const { files: _omitFiles, ...WEBSITE_TEMPLATE_SUMMARY_SHAPE } = WEBSITE_TEMPLATE_OUTPUT_SHAPE
function serializeWebsiteTemplateSummary(t: Parameters<typeof serializeWebsiteTemplate>[0]) {
  const { files, ...summary } = serializeWebsiteTemplate(t)
  return summary
}

/**
 * Shared output shape + serializer for get_schema_template/
 * create_schema_template/update_schema_template — same rationale as
 * serializeWebsiteTemplate above. Report P1/P2 follow-up: create/update's
 * own handlers still did `{ ...template, ... }` (only get_schema_template's
 * read path had been fixed to pick exact fields) — leaking the undeclared
 * `createdBy` column on every create/update response, the same bug class
 * already fixed for Website Templates.
 */
const SCHEMA_DEMO_WORKSPACE_SHAPE = z.object({
  id: z.string(), slug: z.string(), cmsPath: z.string(), developerPath: z.string(),
  schema: z.any().optional(),
})

const DEMO_IDENTITY = z.object({ id: z.string(), slug: z.string() })
const DEMO_VALUES = z.record(z.string(), z.unknown())
const DEMO_SINGLE_ENTRY = {
  demo: DEMO_IDENTITY,
  singleType: z.object({ id: z.string(), slug: z.string(), name: z.string() }),
  locale: z.string(), status: z.enum(["empty", "draft", "published", "disabled"]),
  hasPendingDraft: z.boolean(), version: z.string().nullable(), publishedAt: z.string().nullable(),
  data: DEMO_VALUES, publishedData: DEMO_VALUES.nullable(),
}
const DEMO_COLLECTION_ENTRY = z.object({
  id: z.string(), locale: z.string(), status: z.string(), data: DEMO_VALUES,
  version: z.string(), publishedAt: z.string().nullable(),
})
const DEMO_TEMPLATE_INPUT = {
  schemaTemplateId: z.string().trim().min(1).max(150).describe("Schema Template ID or slug. Uses its linked internal demo workspace."),
}
const DEMO_LOCALE_INPUT = z.string().trim().min(1).max(30).optional().describe("Exact locale; defaults to the demo's default locale.")
const DEMO_SINGLE_INPUT = {
  ...DEMO_TEMPLATE_INPUT, singleTypeSlug: z.string().trim().min(1).max(128), locale: DEMO_LOCALE_INPUT,
}
const DEMO_COLLECTION_INPUT = {
  ...DEMO_TEMPLATE_INPUT, contentTypeSlug: z.string().trim().min(1).max(128), locale: DEMO_LOCALE_INPUT,
}

function demoFailure(code: string, message: string, details?: unknown) {
  return {
    content: [{ type: "text" as const, text: message }],
    structuredContent: { ok: false, code, message, ...(details ? { details } : {}) },
    isError: true,
  }
}

async function runDemoOperation<T extends Record<string, unknown>>(operation: () => Promise<T>) {
  if (!authContext.getStore()) return UNAUTHORIZED
  try {
    const data = await operation()
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      structuredContent: data,
    }
  } catch (error) {
    const prismaCode = typeof error === "object" && error !== null && "code" in error ? error.code : undefined
    if (error instanceof DemoContentError || prismaCode === "P2025" || prismaCode === "P2034" || prismaCode === "P2002") {
      const code = error instanceof DemoContentError ? error.code : "CONFLICT"
      const message = error instanceof DemoContentError ? error.message : "Demo data changed during the request. Read it again before retrying."
      const details = error instanceof DemoContentError ? error.details : undefined
      return demoFailure(code, message, details)
    }
    console.error("[global MCP demo operation]", error)
    return demoFailure("INTERNAL_ERROR", "The demo operation could not be completed.")
  }
}

function describeSchemaDemoWorkspace(workspace: { id: string; slug: string }) {
  return {
    ...workspace,
    cmsPath: `/dashboard/${workspace.slug}/cms`,
    developerPath: `/dashboard/${workspace.slug}/developer`,
  }
}

const SCHEMA_TEMPLATE_OUTPUT_SHAPE = {
  id: z.string(), name: z.string(), slug: z.string(), category: z.string(), icon: z.string(),
  description: z.string().nullable(), schema: z.any(), published: z.boolean(),
  // Report P4: whether every NEW workspace gets this template's schema
  // auto-materialized at creation time (see seedDefaultTenantSchema). At
  // most one SchemaTemplate is ever true — enforced by
  // setAsDefaultSchemaTemplate, not a DB constraint.
  isDefault: z.boolean(),
  demoTenantId: z.string().nullable(), createdAt: z.string(), updatedAt: z.string(),
  demoWorkspace: SCHEMA_DEMO_WORKSPACE_SHAPE.optional(),
  // chatgpt.md P1: pass THIS back as update_schema_template's
  // expectedVersion, not `updatedAt` (which also moves on the one-time
  // demoTenantId write a first demo deploy makes).
  sourceVersion: z.string(),
}
function serializeSchemaTemplate(t: {
  id: string
  name: string
  slug: string
  category: string
  icon: string
  description: string | null
  schema: unknown
  published: boolean
  isDefault: boolean
  demoTenantId: string | null
  createdAt: Date
  updatedAt: Date
  sourceVersion: Date
}) {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    category: t.category,
    icon: t.icon,
    description: t.description,
    schema: t.schema,
    published: t.published,
    isDefault: t.isDefault,
    demoTenantId: t.demoTenantId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    sourceVersion: t.sourceVersion.toISOString(),
  }
}

/**
 * Enforces "at most one isDefault: true SchemaTemplate" in app code (no DB
 * constraint — same rationale as demoTenantId's own comment: a unique
 * constraint trips Prisma db push's data-loss guard, which the production
 * deploy hook runs non-interactively with no --accept-data-loss flag).
 * Called right before the real create/update write — if the process dies
 * between the two, ensureDefaultSchemaTemplate's own fallback (find-by-slug)
 * self-heals the next tenant creation rather than leaving the system with
 * no default at all.
 */
async function setAsDefaultSchemaTemplate(excludeId: string | undefined, client: Pick<Prisma.TransactionClient, "schemaTemplate">) {
  await client.schemaTemplate.updateMany({
    where: { isDefault: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
    data: { isDefault: false },
  })
}

/** The demoDeployment sub-object every create/update_website_template response carries. */
const DEMO_DEPLOYMENT_OUTPUT_SHAPE = z.object({
  status: z.enum(["ok", "failed", "skipped"]),
  error: z.string().optional(),
  deploymentId: z.string().optional(),
  verified: z.boolean().optional(),
  verificationError: z.string().optional(),
  // Kabar Nusa report P0: `verified` alone can't tell a caller WHICH route
  // failed when the demo has more than one — see verifyDemoRoutes.
  routes: z.array(z.object({ path: z.string(), verified: z.boolean(), error: z.string().optional() })).optional(),
})

function describeDemoDeployment(demo: { url: string | null; deploymentId?: string; verified?: boolean; verificationError?: string; error?: string; routes?: { path: string; verified: boolean; error?: string }[] }) {
  return demo.url
    ? { status: "ok" as const, deploymentId: demo.deploymentId, verified: demo.verified, verificationError: demo.verificationError, routes: demo.routes }
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

/** Advisory-only issues (componentSlugs typo, missing title-source for a
 *  slug field, an unrecognized dummyData key, ...) never block a save —
 *  surfaced here as a plain text note instead, since none of these tools'
 *  success outputSchemas declare a `warnings` field of their own (only
 *  create_website_template's dry-run shape does). */
function warningsNote(warnings: { path: string; message: string }[]): string {
  if (warnings.length === 0) return ""
  return `\n\n⚠️ ${warnings.length} catatan (tidak memblokir penyimpanan):\n${warnings.map((w) => `- ${w.path}: ${w.message}`).join("\n")}`
}

function referenceIssuesResponse(issues: { path: string; message: string }[]) {
  return {
    content: [{ type: "text" as const, text: `❌ Ditemukan ${issues.length} masalah referensi/opsi:\n${issues.map((i) => `- ${i.path}: ${i.message}`).join("\n")}` }],
    structuredContent: { ok: false, code: "VALIDATION_FAILED", issues, message: `${issues.length} validation issue(s) found.` },
    isError: true,
  }
}

/**
 * Shared output shape + serializer for get_global_component/
 * create_global_component/update_global_component — same rationale as
 * serializeWebsiteTemplate: pick exactly the declared shape instead of
 * trusting every caller's query to never select more than that. `fields`
 * is the same per-field shape as one SchemaTemplate component's own
 * `fields` ({ name, slug, type, required?, unique?, relationSlug?,
 * componentSlug?, options? }) — schema only, no frontend code bundle.
 */
const GLOBAL_COMPONENT_OUTPUT_SHAPE = {
  id: z.string(), name: z.string(), slug: z.string(), icon: z.string(),
  description: z.string().nullable(), category: z.string().nullable(),
  fields: z.array(z.any()),
  published: z.boolean(), createdAt: z.string(), updatedAt: z.string(),
}
function serializeGlobalComponent(c: {
  id: string
  name: string
  slug: string
  icon: string
  description: string | null
  category: string | null
  fields: unknown
  published: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    description: c.description,
    category: c.category,
    fields: c.fields,
    published: c.published,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

/** Same OUT-9 rationale as WEBSITE_TEMPLATE_SUMMARY_SHAPE — list_global_components
 *  shouldn't resend every component's full field array just to list
 *  names/metadata; get_global_component is the one that reads fields. */
const { fields: _omitComponentFields, ...GLOBAL_COMPONENT_SUMMARY_SHAPE } = GLOBAL_COMPONENT_OUTPUT_SHAPE
function serializeGlobalComponentSummary(c: Parameters<typeof serializeGlobalComponent>[0]) {
  const { fields, ...summary } = serializeGlobalComponent(c)
  return summary
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
    // ── get_builder_guide ──────────────────────────────────────────────────
    // Kabar Nusa report bug 4: the full workflow used to live entirely in
    // this server's top-level `instructions` field (6,178 characters) —
    // confirmed live, Claude Code truncates a long MCP `instructions`
    // string outright, cutting it off mid-sentence ("get_w… [truncated]")
    // before it ever reached the guidance that mattered. Same fix as the
    // per-workspace server's own get_agent_playbook: keep `instructions`
    // short (a pointer + the few rules too safety-critical to risk never
    // being read), move the full detail into a tool callable on demand.
    server.registerTool(
      "get_builder_guide",
      {
        title: "Get Builder Guide (Start Here)",
        description: "Read this FIRST when you connect to this MCP server. Returns the full workflow for building a Schema Template + Website Template together, dry-run validation, the demo preview/verification contract, and every structured error code — call with no arguments.",
        inputSchema: {},
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const guide = `# SaCMS Platform Template-Builder Guide

This server manages SaCMS's platform-wide template catalog, including each Schema Template's linked internal demo workspace. Customer workspaces use their own MCP server at /api/mcp and the apply_website_template tool.

Call \`get_website_agent_workflow\` for analysis and task assignment, demo setup, UI/UX, defensive security review, and release verification. This guide documents the tool contracts used in that workflow.

## Before writing any schema field
Call \`list_field_types\` first — it has the real options/relationSlug shape per type, flags options that are silently ignored, and its \`contentApiContract\` has real request/response examples for the frontend's actual Content API calls. Its entry for richText/markdown also tells you how the FRONTEND you're writing must render that field: richText's value is REAL HTML (from a WYSIWYG editor) and needs a sanitized dangerouslySetInnerHTML, never \`{value}\`/string interpolation — a template that renders it as plain text only looks fine with unwrapped test prose and shows literal <p>/<strong>/<ul> tags the moment real formatted content is used; markdown's value is raw Markdown source and needs a Markdown renderer (react-markdown or equivalent), not an HTML sink.

Call \`list_website_templates\` before creating a new one, to avoid a near-duplicate.

## Build schema and frontend together
Start a new website with \`create_schema_template\` and omit \`schema\`. SaCMS creates a linked demo workspace immediately with the starter Content Types, Single Types (including site-settings), and Components. Open the returned demoWorkspace.cmsPath or call \`get_schema_template\` with includeDemoSchema: true to inspect the workspace itself before writing the frontend.

Map the required pages, header, footer, editorial data, and reusable blocks to this schema. Reuse fields and models that fit. Add missing models or fields with \`update_schema_template\` and pass the sourceVersion you inspected as expectedVersion. You may remove Content Types such as kategori, posts or pages if the brief does not need them. Resolve references in retained models before removing their targets. Keep Single Types and Components available by slug.

Pass the resulting \`schemaTemplateId\` to \`create_website_template\` so the frontend uses the same workspace. When the schema is already decided, an inline \`schema\` still works. SaCMS merges the starter by slug and provisions the demo automatically. Use \`excludeDefaultContentTypes\` to omit optional starter collections in that flow.

Separately from any Website Template a user opts into, exactly ONE SchemaTemplate can be marked \`isDefault: true\` (via \`create_schema_template\`/\`update_schema_template\`) — its Content Types/Single Types are auto-materialized into EVERY new workspace at creation time, alongside every published Global Component, before that workspace has applied any template at all. Setting a new one \`isDefault: true\` automatically un-defaults whichever template held it before. Only change this when the user explicitly asks what every new workspace should start with — it's not part of the normal per-request template-building flow above.

Before writing a new Component (testimonial, pricing tier, team member, etc.) into a Schema Template's \`components\`, call \`list_global_components\` — if a close match already exists in the platform-wide catalog, call \`get_global_component\` and splice its \`fields\` straight in instead of inventing a near-duplicate shape. A Global Component is schema ONLY (no frontend code) — once published it's also readable by every workspace's own per-workspace MCP server (\`list_global_components\`/\`get_global_component\` there), which an agent can call to materialize it into a tenant's own schema via \`create_component\`.

## Design & visual quality
Default stack (standard baseline for every Website Template, not optional unless the user explicitly asks for something else): Next.js (App Router) + TypeScript + shadcn/ui — every component AND every color token comes from shadcn's own system, not a hand-rolled design system or a different component library.

A tenant previews a template's live demo before ever applying it to their own workspace — it's judged on first impression. Build the frontend on shadcn/ui conventions (Tailwind CSS + Radix primitives): compose pages from shadcn's own component patterns (Button, Card, Badge, Input, Dialog, etc. with their standard \`variant\`/\`size\` props) instead of one-off custom markup. Theme it with CSS variables (\`--background\`, \`--foreground\`, \`--primary\`, \`--border\`, \`--radius\`, etc. in \`:root\` plus a \`.dark\` override) and pick real values that actually fit the template's topic (a law firm shouldn't look like a kids' toy store) — never ship shadcn's own default zinc/slate palette untouched. Typography follows the same convention: load a real font via \`next/font\` bound to a \`--font-sans\` CSS variable and reference it through Tailwind's \`font-sans\` (shadcn's own generator does exactly this) — never ship a page with no font loaded, chosen to fit the topic rather than left at whatever the browser defaults to. Keep one consistent radius and spacing scale across every component. Avoid generic AI-template tells: a purple-to-blue gradient hero, emoji as section icons, everything centered — a well-themed shadcn look already reads as professional without any of that.

If you're working inside a real local Next.js project with shell access (Claude Code, Cursor, etc. — not just producing file content for this tool's \`files\` bundle), consider installing shadcn's own Skill (\`npx/pnpm/bun dlx skills add shadcn/ui\` — activates once it finds your project's \`components.json\`) for live, authoritative CLI reference, theming (OKLCH colors, dark mode, radius/variants for Tailwind v3 and v4), composition rules (e.g. \`FieldGroup\` for forms, \`ToggleGroup\` for option sets, semantic colors, base-specific APIs for \`base\`/\`radix\`/\`aria\`), and its own MCP server for component search — more current than this prose summary can ever be kept.

## Validate before you save
For anything non-trivial, call \`create_website_template\` with \`dryRun: true\` FIRST — it validates files, schema shape, every relationSlug/componentSlug/allowedComponents reference against the rest of the SAME bundle, every field's \`type\` against the real 36-type list, and select/multiselect choices (including every \`dummyData\` entry's values against the same per-type rules real content creation uses), returning exact paths like \"schema.contentTypes[2].fields[4].options.choices\" for anything wrong, without creating or deploying anything. Write REAL, representative \`dummyData\` per Content Type/Single Type — the demo preview now seeds it directly instead of generic placeholder text (see "Demo preview" below), so vague/generic dummyData means a vague/generic-looking demo. Pass \`idempotencyKey\` if you want a lost response's retry to resolve to the same template instead of a duplicate.

## Demo preview and verification
\`create_website_template\` initializes empty demo models from sample data. Read actual values with \`get_demo_single_type_entry\` or \`list_demo_content_entries\`. Read both editor and published values before diagnosing a frontend that appears empty. Use \`upload_demo_media\` to obtain a demo media ID, then \`update_demo_single_type_entry\` or \`save_demo_content_entry\` to store it, including inside Component and Repeater fields.

Frontend redeploy preserves demo content. A schema update synchronizes model and field definitions in place. Removing a collection that still contains entries requires \`confirmRemoveDemoContent: true\` after user approval. Use \`reset_demo_content\` with \`confirmReset: true\` only after authorization to replace the demo entries with sample data. Reset runs independently of frontend deployment and preserves the demo media library.

The demo response's \`demoDeployment\` reports \`status\` (ok/failed/skipped), \`verified\`, and \`routes\`. A successful submission is verified only when \`verified: true\`. Metadata-only updates skip redeployment.

For a TARGETED revision of an existing template ("ubah warna header"), call \`get_website_template\` to see the current bundle, then \`update_website_template\` with changedFiles/deletedFiles instead of resending every file via \`files\`.

\`get_website_template_demo_status\` reads a demo's current build state and does a FRESH live check (same multi-route + sitemap behavior as above) without triggering any deploy — when a route fails AFTER the build itself succeeded, it also pulls RUNTIME log error lines (a request-time 500 never shows up in build logs). \`redeploy_website_template_demo\` re-deploys using the template's already-stored files/schema — use it to retry after a failed build instead of resending files through update_website_template.

## Conflict and dependency safety
\`update_schema_template\`/\`update_website_template\` both accept \`expectedVersion\` — pass the \`sourceVersion\` you last read (NOT \`updatedAt\`, which also moves on every redeploy/demo-metadata write even with no source change) — and reject with CONFLICT if files/schema changed since. A structural \`schema\` change to either tool refuses with HAS_DEPENDENTS when another Website Template shares that same backing Schema Template, unless confirmSharedUpdate/confirmCascade (as applicable) is set after confirming with the user what else will be affected. \`delete_schema_template\` refuses with HAS_DEPENDENTS (listing them) instead of silently cascade-deleting every Website Template built on it — only pass confirmCascade: true after telling the user exactly what else will be deleted.

## Response shapes
\`create_website_template\`'s \`dryRun: true\` returns \`{ mode: "dry_run", ok, valid, issues, warnings }\` — a DIFFERENT shape from a real create's response, don't expect id/slug/files/demoDeployment on a dry run. Every demo deploy injects the three fixed NEXT_PUBLIC_SACMS_API_URL/NEXT_PUBLIC_SACMS_TENANT/SACMS_API_KEY vars automatically — a template whose frontend reads those exact names needs no .env placeholder for them at all; only a DIFFERENT custom name needs a {{SACMS_*}} placeholder. Every structured error response (NOT_FOUND, VALIDATION_FAILED, CONFLICT, HAS_DEPENDENTS, INVALID_ARGUMENT, UNAUTHORIZED) uses the same \`structuredContent.code\` field.`

        return { content: [{ type: "text" as const, text: guide }] }
      },
    )

    server.registerTool(
      "get_website_agent_workflow",
      {
        title: "SaCMS Global Website Agent Workflow",
        description: "Read the website workflow from brief and task assignment through demo workspace, SaCMS schema, UI/UX, frontend, security review, and verified demo deployment.",
        inputSchema: {},
        outputSchema: { skill: z.literal("sacms-global-website"), workflow: z.string() },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async () => {
        if (!authContext.getStore()) return UNAUTHORIZED
        const workflow = await readFile(
          join(process.cwd(), "src/lib/infrastructure/sacms-global-website-workflow.md"),
          "utf8",
        )
        return {
          content: [{ type: "text" as const, text: workflow }],
          structuredContent: { skill: "sacms-global-website" as const, workflow },
        }
      },
    )

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
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
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
            description: z.string().nullable(), published: z.boolean(), isDefault: z.boolean(),
            createdAt: z.string(), updatedAt: z.string(),
          })),
        },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
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
            description: true, published: true, isDefault: true, createdAt: true, updatedAt: true,
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
          includeDemoSchema: z.boolean().optional().describe("Read the actual schema rows from this template's own demo workspace."),
        },
        outputSchema: SCHEMA_TEMPLATE_OUTPUT_SHAPE,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ id, includeDemoSchema }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const template = await db.schemaTemplate.findFirst({ where: { OR: [{ id }, { slug: id }] } })
        if (!template) return notFound("Schema Template", id)
        const { findSchemaDemoWorkspace } = await import("@/lib/infrastructure/demo-tenant")
        const demo = await findSchemaDemoWorkspace(db, template)
        const structured = {
          ...serializeSchemaTemplate(template),
          ...(demo ? {
            demoWorkspace: {
              ...describeSchemaDemoWorkspace(demo),
              ...(includeDemoSchema ? { schema: await serializeTenantSchema(db, { tenantId: demo.id, draftTemplateId: null }) } : {}),
            },
          } : {}),
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "get_demo_single_type_entry",
      {
        title: "Read Demo Single Type Entry",
        description: "Read actual demo Single Type values for an exact locale. Returns editor data, public data, publication status, pending draft, and the write version.",
        inputSchema: DEMO_SINGLE_INPUT,
        outputSchema: DEMO_SINGLE_ENTRY,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ schemaTemplateId, ...input }) => runDemoOperation(() => getDemoSingleTypeEntry(schemaTemplateId, input)),
    )

    server.registerTool(
      "update_demo_single_type_entry",
      {
        title: "Save Demo Single Type Entry",
        description: "Patch an entry in the linked demo only. Top-level fields not included in the patch are preserved. A supplied Component or Repeater replaces that entire field. Use demo media IDs or returned media URLs. Saves as a draft by default.",
        inputSchema: {
          ...DEMO_SINGLE_INPUT, data: z.record(z.string(), z.json()),
          publish: z.boolean().default(false).describe("Publish the merged values to the demo Content API."),
          expectedVersion: z.string().nullable().optional().describe("Version from get_demo_single_type_entry, or null for a missing assignment."),
        },
        outputSchema: DEMO_SINGLE_ENTRY,
        annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      async ({ schemaTemplateId, ...input }) => runDemoOperation(() => updateDemoSingleTypeEntry(schemaTemplateId, input)),
    )

    server.registerTool(
      "list_demo_content_entries",
      {
        title: "List Demo Collection Entries",
        description: "List actual Content Type entries and status for an exact demo locale. Use the entry IDs for related data or an update.",
        inputSchema: { ...DEMO_COLLECTION_INPUT, limit: z.number().int().min(1).max(25).default(10), offset: z.number().int().min(0).max(10_000).default(0) },
        outputSchema: { demo: DEMO_IDENTITY, contentTypeSlug: z.string(), locale: z.string(), entries: z.array(DEMO_COLLECTION_ENTRY), hasMore: z.boolean() },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ schemaTemplateId, ...input }) => runDemoOperation(() => listDemoContentEntries(schemaTemplateId, input)),
    )

    server.registerTool(
      "save_demo_content_entry",
      {
        title: "Create or Update a Demo Collection Entry",
        description: "Create a demo collection entry, or patch an existing entry by ID. New entries default to draft. Specify the status when editing an already published entry to control whether the update stays public.",
        inputSchema: {
          ...DEMO_COLLECTION_INPUT, data: z.record(z.string(), z.json()),
          entryId: z.string().trim().min(1).max(150).optional(),
          status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
          expectedVersion: z.string().optional(),
        },
        outputSchema: { demo: DEMO_IDENTITY, contentTypeSlug: z.string(), entry: DEMO_COLLECTION_ENTRY },
        annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      async ({ schemaTemplateId, ...input }) => runDemoOperation(() => saveDemoContentEntry(schemaTemplateId, input)),
    )

    server.registerTool(
      "upload_demo_media",
      {
        title: "Upload a Demo Image",
        description: "Upload a PNG, JPEG, WebP, or GIF into the linked demo's media library. Use the returned media ID or stored URL in Media, Component, or Repeater fields.",
        inputSchema: {
          ...DEMO_TEMPLATE_INPUT,
          filename: z.string().trim().min(1).max(150), mimeType: z.enum(DEMO_MEDIA_TYPES),
          base64: z.string().min(4).max(Math.ceil(DEMO_MEDIA_MAX_BYTES / 3) * 4).describe("Base64 image bytes without a data URI prefix, up to 2 MB decoded."),
          alt: z.string().max(500).optional(),
        },
        outputSchema: {
          demo: DEMO_IDENTITY, reused: z.boolean(),
          media: z.object({ id: z.string(), url: z.string(), mimeType: z.string(), size: z.number() }),
        },
        annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: true },
      },
      async ({ schemaTemplateId, ...input }) => runDemoOperation(() => uploadDemoMedia(schemaTemplateId, input)),
    )

    server.registerTool(
      "reset_demo_content",
      {
        title: "Reset Demo Content from Sample Data",
        description: "Explicitly replace demo collection and singleton entries with the template's sample data. Preserves schema and media. Runs independently of frontend deployment.",
        inputSchema: {
          ...DEMO_TEMPLATE_INPUT,
          confirmReset: z.boolean().default(false).describe("Set true only after the user authorizes deleting the current demo entries."),
        },
        outputSchema: {
          demo: DEMO_IDENTITY, deletedEntries: z.number(), deletedAssignments: z.number(),
          status: z.enum(["completed", "partial"]), warnings: z.array(z.object({ model: z.string(), message: z.string() })),
        },
        annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
      },
      async ({ schemaTemplateId, confirmReset }) => runDemoOperation(() => {
        if (!confirmReset) throw new DemoContentError("CONFIRMATION_REQUIRED", "Confirm the reset before deleting current demo entries.")
        return resetDemoContent(schemaTemplateId)
      }),
    )

    server.registerTool(
      "create_schema_template",
      {
        title: "Create Schema Template",
        description:
          "Create a new Schema Template — a reusable CMS schema blueprint (Content Types, Single Types, and " +
          "Components with their fields) for one type of website/system (e.g. 'Company Profile', 'E-Commerce " +
          "Storefront', 'Blog & News Portal'). Creates a matching internal demo workspace immediately, " +
          "with schema models ready in CMS Studio before any frontend deployment. For a new website, " +
          "omit schema to inspect the platform starter and use update_schema_template to tailor it.",
        inputSchema: {
          name: z.string().min(1).max(150).describe("Template display name, e.g. 'Company Profile'"),
          category: z.string().min(1).max(100).describe("Catalog category, e.g. 'Business', 'E-Commerce', 'Portfolio'"),
          icon: z.string().max(10).optional().describe("A single emoji shown on the template card, e.g. '🏢'"),
          description: z.string().max(500).optional().describe("Short catalog-card blurb shown alongside the name/category — not shown to end content editors."),
          schema: schemaTemplateBundleSchema.optional().describe(
            "{ groups?: [...], contentTypes: [...], singleTypes: [...], components: [...] } — each model: " +
            "{ name, slug, description?, fields: [{ name, slug, type, required?, unique?, relationSlug?, componentSlug?, options? }], dummyData?: [...] }. " +
            "Call list_field_types FIRST — it has the real options/relationSlug shape and entry-value shape " +
            "per field type, and flags options that look plausible but are silently ignored. Never guess one. " +
            "Optionally organize Content Types into sidebar folders via `groups`: [{ slug, name, parentSlug? }] " +
            "— `slug` here is a template-local key, NOT a real database id (list parents before children, max " +
            "3 levels) — then set `group: '<that slug>'` on each contentTypes[] entry that belongs in it. " +
            "Single Types and Components have no grouping concept in SaCMS — `group` on those is ignored. " +
            "Omit to load the full starter. Supplied models are merged by slug unless authoring the platform default with isDefault: true.",
          ),
          excludeDefaultContentTypes: z.array(z.string().min(1).max(100)).max(100).optional().describe(
            "Optional starter Content Type slugs to omit once you know the website's needs, such as kategori, posts or pages. Single Types and Components are retained.",
          ),
          published: z.boolean().optional().describe(
            "Default false (visible only to SaCMS Global staff until reviewed). Set true to make it immediately browsable by every workspace.",
          ),
          isDefault: z.boolean().optional().describe(
            "Set true to make this THE template auto-materialized (schema only, no frontend) into every NEW workspace at creation time — unsets any other template currently marked default. At most one template is ever isDefault. Omit/false for an ordinary template a user opts into via a Website Template.",
          ),
          idempotencyKey: z.string().optional().describe("A key unique to THIS submission. If this tool's response is ever lost, retry with the SAME key — you'll get back the already-created template (and its already-provisioned demo workspace) instead of a duplicate."),
        },
        outputSchema: SCHEMA_TEMPLATE_OUTPUT_SHAPE,
        annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      async ({ name, category, icon, description, schema, published, isDefault, idempotencyKey, excludeDefaultContentTypes = [] }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        // Idempotent replay — before anything else, so a lost response's
        // retry never creates a second template + a second orphaned demo
        // workspace (createDraftDemoWorkspace below is exactly the kind of
        // expensive, hard-to-undo side effect this key exists to protect).
        if (idempotencyKey) {
          const already = await db.schemaTemplate.findFirst({
            where: { idempotencyKey },
            include: { demoTenant: { select: { id: true, slug: true } } },
          })
          if (already?.demoTenant) {
            const structured = { ...serializeSchemaTemplate(already), demoWorkspace: describeSchemaDemoWorkspace(already.demoTenant) }
            return {
              content: [{ type: "text" as const, text: `🔁 Replay idempoten — Schema Template '${already.id}' sudah dibuat untuk idempotencyKey ini.\n${JSON.stringify(structured, null, 2)}` }],
              structuredContent: structured,
            }
          }
        }

        const parsedSchema = schemaTemplateBundleSchema.safeParse(schema ?? {})
        if (!parsedSchema.success) return invalidSchema(parsedSchema.error)
        let bundle = parsedSchema.data
        if (isDefault && schema !== undefined && excludeDefaultContentTypes.length) {
          return referenceIssuesResponse([{ path: "excludeDefaultContentTypes", message: "Set the platform default's Content Types in its explicit schema." }])
        }
        if (!(isDefault && schema !== undefined)) {
          const composed = await composeTemplateStarterSchema(bundle, excludeDefaultContentTypes)
          if (!composed.success) return invalidSchema(composed.error)
          if (composed.issues.length) return referenceIssuesResponse(composed.issues)
          bundle = composed.data
        }

        const { blocking, warnings } = splitIssuesBySeverity(validateBundleReferences(bundle))
        if (blocking.length > 0) return referenceIssuesResponse(blocking)

        const { createDraftDemoWorkspace } = await import("@/lib/infrastructure/demo-tenant")
        const { template, demo } = await db.$transaction(async (tx) => {
          const slug = await dedupeSlug(slugify(name) || "schema-template", (s) => tx.schemaTemplate.findUnique({ where: { slug: s } }))
          if (isDefault) await setAsDefaultSchemaTemplate(undefined, tx)
          const demo = await createDraftDemoWorkspace(tx, { slug, name }, bundle)
          const template = await tx.schemaTemplate.create({
            data: {
              name, slug, category,
              icon: icon || "📦",
              description: description || null,
              schema: bundle,
              published: published ?? false,
              isDefault: isDefault ?? false,
              demoTenantId: demo.id,
              idempotencyKey: idempotencyKey || null,
            },
          })
          return { template, demo }
        }, { timeout: 20000 })
        const structured = { ...serializeSchemaTemplate(template), demoWorkspace: describeSchemaDemoWorkspace(demo) }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) + warningsNote(warnings) }],
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
          name: z.string().min(1).max(150).optional().describe("New display name, if renaming."),
          category: z.string().min(1).max(100).optional().describe("New catalog category, if recategorizing."),
          icon: z.string().max(10).optional().describe("New single-emoji card icon, if changing."),
          description: z.string().max(500).optional().describe("New catalog-card blurb, if changing."),
          schema: schemaTemplateBundleSchema.optional().describe(
            "Full replacement for groups/contentTypes/singleTypes/components. Call list_field_types first, " +
            "same as create_schema_template — don't guess an options shape. Same `groups`/`group` convention " +
            "too (template-local slugs, Content Types only).",
          ),
          published: z.boolean().optional().describe("Set true to make this template immediately browsable by every workspace, or false to hide it again."),
          isDefault: z.boolean().optional().describe(
            "Set true to make THIS the template auto-materialized into every NEW workspace at creation time, unsetting any other template currently marked default. Set false to un-default it (no other template becomes default automatically).",
          ),
          expectedVersion: z.string().optional().describe("The `sourceVersion` you last read for this template (from get_schema_template) — NOT `updatedAt`, which also moves on a first demo deploy's one-time bookkeeping write even with no `schema` change. If someone else changed `schema` since, this rejects with code: \"CONFLICT\" instead of silently overwriting their change — re-read and retry with the fresh value."),
          confirmSharedUpdate: z.boolean().optional().describe("Required (after confirming with the user) when `schema` is being changed AND one or more Website Templates already follow this Schema Template — see this tool's own description."),
          confirmRemoveDemoContent: z.boolean().optional().describe("Required after user approval to remove a Content Type that still contains demo entries."),
        },
        outputSchema: SCHEMA_TEMPLATE_OUTPUT_SHAPE,
        annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ id, name, category, icon, description, schema, published, isDefault, expectedVersion, confirmSharedUpdate, confirmRemoveDemoContent }) => {
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
        let schemaWarnings: { path: string; message: string }[] = []
        if (schema !== undefined) {
          const parsedSchema = schemaTemplateBundleSchema.safeParse(schema)
          if (!parsedSchema.success) return invalidSchema(parsedSchema.error)
          const protectedIssues = protectedSchemaModelIssues(existing.schema, parsedSchema.data)
          if (protectedIssues.length) return referenceIssuesResponse(protectedIssues)
          const { blocking, warnings } = splitIssuesBySeverity(validateBundleReferences(parsedSchema.data))
          if (blocking.length > 0) return referenceIssuesResponse(blocking)
          schemaWarnings = warnings

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

        const { findSchemaDemoWorkspace, syncDraftDemoWorkspace } = await import("@/lib/infrastructure/demo-tenant")
        const result = await db.$transaction(async (tx) => {
          const changed = await tx.schemaTemplate.updateMany({
            where: { id: existing.id, sourceVersion: existing.sourceVersion },
            data: {
              ...(name !== undefined ? { name } : {}),
              ...(category !== undefined ? { category } : {}),
              ...(icon !== undefined ? { icon } : {}),
              ...(description !== undefined ? { description } : {}),
              ...(schemaData !== undefined ? { schema: schemaData } : {}),
              ...(published !== undefined ? { published } : {}),
              ...(isDefault !== undefined ? { isDefault } : {}),
              ...(schemaData !== undefined ? { sourceVersion: new Date() } : {}),
            },
          })
          if (!changed.count) return null
          if (isDefault) await setAsDefaultSchemaTemplate(existing.id, tx)
          const template = await tx.schemaTemplate.findUniqueOrThrow({ where: { id: existing.id } })
          const demo = await findSchemaDemoWorkspace(tx, template)
          if (schemaData && template.demoTenantId && !demo) {
            throw new DemoContentError("DEMO_NOT_AVAILABLE", "The configured demo workspace could not be verified.")
          }
          if (schemaData && demo) {
            await syncDraftDemoWorkspace(tx, demo.id, existing.schema as SchemaBlob, schemaData, { allowContentRemoval: confirmRemoveDemoContent })
          }
          return { template, demo }
        }, { timeout: 20000 }).catch((error: unknown) => {
          if (error instanceof DemoContentError) return error
          throw error
        })
        if (result instanceof DemoContentError) return demoFailure(result.code, result.message)
        if (!result) {
          return {
            content: [{ type: "text" as const, text: "Schema Template berubah selama permintaan. Baca versi terbaru sebelum mencoba kembali." }],
            structuredContent: { ok: false, code: "CONFLICT", message: "Schema Template changed during the update." },
            isError: true,
          }
        }
        const structured = {
          ...serializeSchemaTemplate(result.template),
          ...(result.demo ? { demoWorkspace: describeSchemaDemoWorkspace(result.demo) } : {}),
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) + warningsNote(schemaWarnings) }],
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
        outputSchema: { ok: z.literal(true), deletedDependents: z.number() },
        annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
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
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
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
        description: "Get one Website Template's full detail, including its demo deployment state (demoUrl/demoDeploymentId). By default `files` carries the COMPLETE bundle (path + content for every source file, often ~150-200KB) — use `listPathsOnly` first to see what's there cheaply, then `paths` to pull just the handful of files you actually need to read, instead of the whole bundle every time you just want to check or patch one file.",
        inputSchema: {
          id: z.string().describe("Website Template id or slug"),
          paths: z.array(z.string()).optional().describe("Only return these exact file paths' content, instead of every file in the bundle. Ignored when listPathsOnly is true."),
          listPathsOnly: z.boolean().optional().describe("Return every file's path and byte size (see `fileSizes`) with `files` empty — skips sending any file content at all. Use this to decide which `paths` to actually fetch next."),
        },
        outputSchema: {
          ...WEBSITE_TEMPLATE_OUTPUT_SHAPE,
          fileSizes: z.array(z.object({ path: z.string(), bytes: z.number() })).optional().describe("Only populated when listPathsOnly was true."),
        },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ id, paths, listPathsOnly }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const template = await db.websiteTemplate.findFirst({
          where: { OR: [{ id }, { slug: id }] },
          include: { schemaTemplate: { select: { id: true, name: true, slug: true } } },
        })
        if (!template) return notFound("Website Template", id)

        const allFiles = template.files as unknown as { path: string; content: string }[]
        let files: { path: string; content: string }[] = allFiles
        let fileSizes: { path: string; bytes: number }[] | undefined
        if (listPathsOnly) {
          fileSizes = allFiles.map((f) => ({ path: f.path, bytes: Buffer.byteLength(f.content, "utf-8") }))
          files = []
        } else if (paths && paths.length > 0) {
          const wanted = new Set(paths)
          files = allFiles.filter((f) => wanted.has(f.path))
        }

        const structured = { ...serializeWebsiteTemplate({ ...template, files }), ...(fileSizes ? { fileSizes } : {}) }
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
          "instead when attaching files to the Schema Template you prepared, or when reusing an existing structure — " +
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
            "SaCMS merges the starter schema and prepares a demo workspace for the backing Schema Template. Mutually exclusive with `schemaTemplateId`.",
          ),
          excludeDefaultContentTypes: z.array(z.string().min(1).max(100)).max(100).optional().describe(
            "Inline schema only. Omit optional starter Content Types by slug, such as kategori, posts or pages.",
          ),
          category: z.string().min(1).max(100).optional().describe("Catalog category for the auto-created backing Schema Template when `schema` is given (e.g. 'Business', 'Blog & News'). Ignored when `schemaTemplateId` is given. Defaults to 'Custom'."),
          name: z.string().min(1).max(150).describe("Template display name, e.g. 'Company Profile — Modern Dark'"),
          icon: z.string().max(10).optional().describe("A single emoji shown on the template card, e.g. '🖥️'"),
          description: z.string().max(500).optional().describe("Short catalog-card blurb shown alongside the name/category."),
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
          z.object({ ...WEBSITE_TEMPLATE_SUMMARY_SHAPE, demoDeployment: DEMO_DEPLOYMENT_OUTPUT_SHAPE }),
        ]),
        annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: true },
      },
      async ({ schemaTemplateId, schema, category, name, icon, description, files, published, idempotencyKey, dryRun, excludeDefaultContentTypes = [] }) => {
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
            const structured = { ...serializeWebsiteTemplateSummary(already), demoDeployment }
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
        if (schemaTemplateId && excludeDefaultContentTypes.length) {
          return referenceIssuesResponse([{ path: "excludeDefaultContentTypes", message: "Update the existing Schema Template before attaching a website." }])
        }

        // Validate EVERYTHING before writing anything — files used to be
        // validated only after a `schema`-given call had already created
        // its backing Schema Template, so an invalid `files` payload left
        // that Schema Template permanently orphaned (a real, confirmed
        // bug class: schema+website creation must be all-or-nothing).
        const parsedFiles = websiteTemplateFilesSchema.safeParse(files)
        if (!parsedFiles.success) return invalidSchema(parsedFiles.error)

        // Third external audit, VAL-16 (upgraded from a dry-run-only
        // warning): a bundle with no package.json at all can never
        // actually build on Vercel — blocks BOTH dryRun and a real save,
        // the same way an invalid `files` payload already does, instead of
        // only surfacing as an opaque failed deploy afterward.
        const hasPackageJson = parsedFiles.data.some((f) => f.path === "package.json")
        if (!hasPackageJson) {
          return referenceIssuesResponse([{ path: "files", message: "No package.json found at the bundle root — a real deploy has no dependencies/scripts to build with." }])
        }

        let bundleData: z.infer<typeof schemaTemplateBundleSchema> | undefined
        let bundleWarnings: { path: string; message: string }[] = []
        if (!schemaTemplateId) {
          const parsedBundle = schemaTemplateBundleSchema.safeParse(schema)
          if (!parsedBundle.success) return invalidSchema(parsedBundle.error)
          const composed = await composeTemplateStarterSchema(parsedBundle.data, excludeDefaultContentTypes)
          if (!composed.success) return invalidSchema(composed.error)
          if (composed.issues.length) return referenceIssuesResponse(composed.issues)
          const { blocking, warnings } = splitIssuesBySeverity(validateBundleReferences(composed.data))
          if (blocking.length > 0) return referenceIssuesResponse(blocking)
          bundleWarnings = warnings
          bundleData = composed.data
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
          const warnings: { path: string; message: string }[] = [...bundleWarnings]
          if (!hasEnvExample) {
            warnings.push({ path: "files", message: "No .env.example found — this is advisory only (it won't block a real save), but env vars won't be auto-declared on the workspace's Environment tab when a customer applies this template." })
          }
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
        let seedMissingContent: boolean
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
              const schemaSlug = await dedupeSlug(slugify(name) || "schema-template", (s) => tx.schemaTemplate.findUnique({ where: { slug: s } }))
              const { createDraftDemoWorkspace } = await import("@/lib/infrastructure/demo-tenant")
              const demo = await createDraftDemoWorkspace(tx, { name, slug: schemaSlug }, bundleData!)
              resolvedSchemaTemplate = await tx.schemaTemplate.create({
                data: {
                  name,
                  slug: schemaSlug,
                  category: category || "Custom",
                  icon: icon || "📦",
                  description: null,
                  schema: bundleData!,
                  published: false,
                  demoTenantId: demo.id,
                },
              })
            }

            // Same transaction as the Schema Template create above (when
            // one happened) — a failure here (including the idempotencyKey
            // unique-constraint race below) rolls BOTH back together,
            // instead of leaving that Schema Template orphaned.
            const slug = await dedupeSlug(slugify(name), (s) => tx.websiteTemplate.findUnique({ where: { slug: s } }))
            const firstWebsite = !schemaTemplateId || (await tx.websiteTemplate.count({ where: { schemaTemplateId: resolvedSchemaTemplate.id } })) === 0
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
            return { schemaTemplate: resolvedSchemaTemplate, template: createdTemplate, firstWebsite }
          }, { timeout: 20000 })
          schemaTemplate = result.schemaTemplate
          template = result.template
          seedMissingContent = result.firstWebsite
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
              const structured = { ...serializeWebsiteTemplateSummary(winner), demoDeployment }
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
          seedMissingContent,
        })

        // Re-read rather than patch the in-memory `template` by hand —
        // deployWebsiteTemplateDemo persists the authoritative demo* fields
        // itself (or leaves them untouched on a hard failure), so this is
        // the one query that can't drift from what it actually wrote.
        const saved = (await db.websiteTemplate.findUnique({ where: { id: template.id } })) || template
        const structured = { ...serializeWebsiteTemplateSummary(saved), demoDeployment: describeDemoDeployment(demo) }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) + warningsNote(bundleWarnings) }],
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
          name: z.string().min(1).max(150).optional().describe("New display name, if renaming."),
          icon: z.string().max(10).optional().describe("New single-emoji card icon, if changing."),
          description: z.string().max(500).optional().describe("New catalog-card blurb, if changing."),
          files: websiteTemplateFilesSchema.optional().describe("Full replacement for the file bundle. Do not combine with changedFiles/deletedFiles — pick one."),
          changedFiles: z.array(z.object({ path: z.string().trim().min(1).max(300), content: z.string().max(200_000) })).optional().describe("Only the files being added or changed — every other file in the stored bundle is kept as-is."),
          deletedFiles: z.array(z.string()).optional().describe("File paths to remove from the stored bundle entirely."),
          schema: schemaTemplateBundleSchema.optional().describe("Full replacement for the backing Schema Template's groups/contentTypes/singleTypes/components. Call list_field_types first — don't guess an options shape."),
          published: z.boolean().optional().describe("Set true to make this template immediately browsable by every workspace, or false to hide it again."),
          expectedVersion: z.string().optional().describe("The `sourceVersion` you last read for this template (from get_website_template) — NOT `updatedAt`, which also moves on every demo redeploy even with no source change. If someone else changed files/schema since, this rejects with code: \"CONFLICT\" instead of silently overwriting their change — re-read and retry with the fresh value."),
          confirmSharedUpdate: z.boolean().optional().describe("Required (after confirming with the user) when `schema` is being changed AND another Website Template also follows the same backing Schema Template — see this tool's own description."),
          confirmRemoveDemoContent: z.boolean().optional().describe("Required after user approval to remove a Content Type that still contains demo entries."),
          dryRun: z.boolean().optional().describe("Validate everything (merged files, schema shape/references, expectedVersion conflict, HAS_DEPENDENTS) WITHOUT writing anything or redeploying the demo — same idea as create_website_template's dryRun, call this first for a non-trivial change."),
        },
        outputSchema: z.union([
          DRY_RUN_OUTPUT_SHAPE,
          z.object({ ...WEBSITE_TEMPLATE_SUMMARY_SHAPE, demoDeployment: DEMO_DEPLOYMENT_OUTPUT_SHAPE.optional() }),
        ]),
        annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: true },
      },
      async ({ id, name, icon, description, files, changedFiles, deletedFiles, schema, published, expectedVersion, confirmSharedUpdate, confirmRemoveDemoContent, dryRun }) => {
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
          include: { schemaTemplate: { select: { id: true, slug: true, name: true, schema: true, demoTenantId: true, sourceVersion: true } } },
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

        // VAL-16 parity with create_website_template: a files/changedFiles
        // edit that ends up dropping package.json entirely would otherwise
        // only surface as an opaque failed deploy once the redeploy below
        // actually runs.
        if (filesData !== undefined && !filesData.some((f) => f.path === "package.json")) {
          return referenceIssuesResponse([{ path: "files", message: "The resulting bundle has no package.json at the root — a real deploy has no dependencies/scripts to build with." }])
        }

        let schemaUpdated = false
        let parsedBundleData: z.infer<typeof schemaTemplateBundleSchema> | undefined
        let bundleWarnings: { path: string; message: string }[] = []
        if (schema !== undefined) {
          const parsedBundle = schemaTemplateBundleSchema.safeParse(schema)
          if (!parsedBundle.success) return invalidSchema(parsedBundle.error)
          const protectedIssues = protectedSchemaModelIssues(existing.schemaTemplate.schema, parsedBundle.data)
          if (protectedIssues.length) return referenceIssuesResponse(protectedIssues)
          const { blocking, warnings } = splitIssuesBySeverity(validateBundleReferences(parsedBundle.data))
          if (blocking.length > 0) return referenceIssuesResponse(blocking)
          bundleWarnings = warnings
          parsedBundleData = parsedBundle.data
          schemaUpdated = true
        }

        if (dryRun) {
          if (parsedBundleData && existing.schemaTemplate.demoTenantId) {
            const { findSchemaDemoWorkspace, checkDemoContentRemoval } = await import("@/lib/infrastructure/demo-tenant")
            const demo = await findSchemaDemoWorkspace(db, existing.schemaTemplate)
            if (!demo) return demoFailure("DEMO_NOT_AVAILABLE", "The configured demo workspace could not be verified.")
            try {
              await checkDemoContentRemoval(db, demo.id, existing.schemaTemplate.schema as SchemaBlob, parsedBundleData, confirmRemoveDemoContent)
            } catch (error) {
              if (error instanceof DemoContentError) return demoFailure(error.code, error.message)
              throw error
            }
          }
          return {
            content: [{ type: "text" as const, text: "✅ Valid — tidak ada masalah ditemukan. Panggil lagi tanpa dryRun untuk benar-benar menyimpan." }],
            structuredContent: { mode: "dry_run" as const, ok: true as const, valid: true as const, issues: [] as { path: string; message: string }[], warnings: bundleWarnings },
          }
        }

        // One transaction when both are changing — a website-metadata
        // write failing right after the schema write landed would
        // otherwise leave the two inconsistent with each other.
        const template = await db.$transaction(async (tx) => {
          if (parsedBundleData) {
            const changed = await tx.schemaTemplate.updateMany({
              where: { id: existing.schemaTemplate.id, sourceVersion: existing.schemaTemplate.sourceVersion },
              data: { schema: parsedBundleData, sourceVersion: new Date() },
            })
            if (!changed.count) return null
            if (existing.schemaTemplate.demoTenantId) {
              const { findSchemaDemoWorkspace, syncDraftDemoWorkspace } = await import("@/lib/infrastructure/demo-tenant")
              const demo = await findSchemaDemoWorkspace(tx, existing.schemaTemplate)
              if (!demo) throw new DemoContentError("DEMO_NOT_AVAILABLE", "The configured demo workspace could not be verified.")
              await syncDraftDemoWorkspace(tx, demo.id, existing.schemaTemplate.schema as SchemaBlob, parsedBundleData, { allowContentRemoval: confirmRemoveDemoContent })
            }
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
        }, { timeout: 20000 }).catch((error: unknown) => {
          if (error instanceof DemoContentError) return error
          throw error
        })
        if (template instanceof DemoContentError) return demoFailure(template.code, template.message)
        if (!template) {
          return {
            content: [{ type: "text" as const, text: "Schema Template berubah selama permintaan. Baca versi terbaru sebelum mencoba kembali." }],
            structuredContent: { ok: false, code: "CONFLICT", message: "Schema Template changed during the update." },
            isError: true,
          }
        }

        // A real file OR schema change warrants a redeploy (the demo needs
        // to reflect either) — a metadata-only edit (name/icon/description/
        // published) shouldn't rebuild it.
        if (filesData !== undefined || schemaUpdated) {
          // Use the latest definition after an in-place schema update.
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
          const structured = { ...serializeWebsiteTemplateSummary(saved), demoDeployment: describeDemoDeployment(demo) }
          return {
            content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) + warningsNote(bundleWarnings) }],
            structuredContent: structured,
          }
        }

        const structured = { ...serializeWebsiteTemplateSummary(template), demoDeployment: { status: "skipped" as const } }
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
        outputSchema: { ok: z.literal(true) },
        annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: true },
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
        const structured = { ok: true as const }
        return { content: [{ type: "text" as const, text: `✅ Website Template '${existing.name}' dihapus.` }], structuredContent: structured }
      },
    )

    server.registerTool(
      "get_website_template_demo_status",
      {
        title: "Get Website Template Demo Status (Read-Only)",
        description: "Read a Website Template's demo deployment status WITHOUT redeploying anything — the build stage of its most recent deploy, a FRESH HTTP check of the homepage AND (if the demo has a sitemap.xml) up to 5 more real routes from it, and error logs when something's broken: build log errors if the build itself failed, or RUNTIME log errors if the build succeeded but a specific route still 500s at request time. Call this instead of create_website_template/update_website_template just to check on an existing demo, and before deciding whether redeploy_website_template_demo is actually needed.",
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
          routes: z.array(z.object({ path: z.string(), verified: z.boolean(), error: z.string().optional() })).optional(),
          buildErrorLines: z.array(z.string()).optional(),
          runtimeErrorLines: z.array(z.string()).optional(),
          message: z.string(),
        },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
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

        const { getDeploymentStatus, getLatestDeployment, getDeploymentBuildLogs, getRuntimeLogs } = await import("@/lib/vercel-client")
        const { verifyDemoRoutes } = await import("@/lib/infrastructure/deploy-website-template-demo")

        const status = existing.demoDeploymentId
          ? await getDeploymentStatus(existing.demoDeploymentId).catch(() => null)
          : await getLatestDeployment(existing.demoVercelProjectId).catch(() => null)

        // Kabar Nusa report P0: this used to check ONLY the homepage — a
        // demo whose every list/detail route 500'd still reported
        // `verified: true` as long as "/" rendered.
        const verification = existing.demoUrl
          ? await verifyDemoRoutes(existing.demoUrl)
          : { verified: false, routes: [] as { path: string; verified: boolean; error?: string }[] }
        const verificationError = verification.routes.find((r) => !r.verified)?.error

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
        let runtimeErrorLines: string[] | undefined
        const deploymentIdForLogs = existing.demoDeploymentId || (status as any)?.id
        if (buildFailed && deploymentIdForLogs) {
          const logs = await getDeploymentBuildLogs(deploymentIdForLogs).catch(() => null)
          if (logs) buildErrorLines = logs.errorLines.slice(-20)
        } else if (!verification.verified && deploymentIdForLogs) {
          // Kabar Nusa report P0: a route 500ing at REQUEST time (not a
          // build failure) never shows up in build logs at all — that's
          // the whole reason get_deployment_runtime_logs exists on the
          // per-workspace server. Same idea here: only worth fetching when
          // the build itself is fine but something still failed to render.
          const runtime = await getRuntimeLogs(existing.demoVercelProjectId, deploymentIdForLogs).catch(() => null)
          if (runtime && runtime.errorLines.length > 0) {
            runtimeErrorLines = runtime.errorLines.slice(-20).map((l) => `[${l.responseStatusCode ?? "?"}] ${l.requestPath ?? ""} ${l.message}`.trim())
          }
        }

        const structured = {
          deployed: true,
          demoUrl: existing.demoUrl,
          deploymentId: existing.demoDeploymentId,
          state: status?.state,
          verified: buildFailed ? false : verification.verified,
          verificationError: buildFailed
            ? `Latest build ${status?.state}.${verification.verified ? " The URL above is still serving a PREVIOUS successful deployment, not this one." : ""} Check buildErrorLines.`
            : verificationError,
          routes: verification.routes,
          buildErrorLines,
          runtimeErrorLines,
          message: buildFailed
            ? `Latest build FAILED (${status?.state}) — this demo does NOT reflect the latest changes${verification.verified ? ", even though its URL still responds (serving an older deployment)" : ""}. Check buildErrorLines, fix the source, and call redeploy_website_template_demo.`
            : verification.verified
              ? `Demo is live and rendering at ${existing.demoUrl} (${verification.routes.length} route(s) checked).`
              : `Demo is NOT currently verified — ${verification.routes.filter((r) => !r.verified).length} of ${verification.routes.length} checked route(s) failed. ${runtimeErrorLines?.length ? "Check runtimeErrorLines." : "Call redeploy_website_template_demo to try a fresh deploy."}`,
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
        description: "Redeploy the demo frontend from the stored files and verify it while preserving the demo entries. Use get_website_template_demo_status to diagnose a failed build. Reset sample content separately with reset_demo_content.",
        inputSchema: {
          id: z.string().describe("Website Template id or slug"),
        },
        outputSchema: {
          ...WEBSITE_TEMPLATE_SUMMARY_SHAPE,
          demoDeployment: DEMO_DEPLOYMENT_OUTPUT_SHAPE,
        },
        annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: true },
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
        const structured = { ...serializeWebsiteTemplateSummary(saved), demoDeployment: describeDemoDeployment(demo) }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        }
      },
    )

    // ── Global Components ───────────────────────────────────────────────
    // Reusable CMS schema field definitions (a "Testimonial" with name/
    // role/photo/quote, a "Pricing Tier", ...) — built here, and once
    // `published`, readable by every workspace's own per-workspace MCP
    // server (list_global_components/get_global_component there,
    // read-only) so an agent can reuse/adapt a ready-made field shape
    // instead of designing a Component from scratch every time. Schema
    // only, deliberately no frontend code bundle — a workspace that wants
    // to use one reads `fields` here, then calls its own create_component
    // with that same array to materialize a real Component in its own
    // schema. Much simpler than Website Template: no SchemaTemplate link,
    // no demo deployment, no expectedVersion/CONFLICT machinery.
    server.registerTool(
      "list_global_components",
      {
        title: "List Global Components",
        description: "List every reusable Component field-definition in the catalog (both published and draft), with id, name, slug, icon, description, category, published status, and timestamps — without the field array itself (call get_global_component for that). Call this FIRST before creating a new one, to check whether something close enough already exists to reuse or extend.",
        inputSchema: {
          category: z.string().optional().describe("Filter to one category, e.g. 'navigation', 'testimonial', 'pricing', 'form'. Omit to list every category."),
        },
        outputSchema: { components: z.array(z.object(GLOBAL_COMPONENT_SUMMARY_SHAPE)) },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ category }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const rows = await db.globalComponent.findMany({
          where: category ? { category } : undefined,
          orderBy: { createdAt: "desc" },
        })
        const components = rows.map(serializeGlobalComponentSummary)
        const structured = { components }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(components, null, 2) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "get_global_component",
      {
        title: "Get Global Component",
        description: "Get one reusable Component's full detail, including its complete `fields` array — the exact shape a per-workspace MCP server's get_global_component also hands back, ready to pass straight into that workspace's own create_component to materialize it.",
        inputSchema: {
          id: z.string().describe("Global Component id or slug"),
        },
        outputSchema: GLOBAL_COMPONENT_OUTPUT_SHAPE,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const component = await db.globalComponent.findFirst({ where: { OR: [{ id }, { slug: id }] } })
        if (!component) return notFound("Global Component", id)
        const structured = serializeGlobalComponent(component)
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "create_global_component",
      {
        title: "Create Global Component",
        description: "Create a new reusable Component field-definition (e.g. 'Testimonial', 'Pricing Tier', 'Team Member') other templates and workspaces can reuse once published. This is catalog data, same as Schema/Website Templates — it never touches any tenant's own live schema or content. Call list_global_components first to avoid creating a near-duplicate, and list_field_types before writing any field.",
        inputSchema: {
          name: z.string().min(1).max(150).describe("Display name, e.g. 'Testimonial'"),
          slug: z.string().max(150).optional().describe("URL-safe identifier, e.g. 'testimonial'. Auto-derived from name if omitted; a collision gets a numeric suffix."),
          icon: z.string().max(10).optional().describe("A single emoji shown on the component's catalog card, e.g. '💬'"),
          description: z.string().max(500).optional().describe("Short catalog-card blurb — what this component is for and when to reach for it."),
          category: z.string().max(50).optional().describe("Catalog category, e.g. 'navigation', 'testimonial', 'pricing', 'form' — used to filter list_global_components."),
          fields: z.array(schemaTemplateFieldSchema).describe(
            "[{ name, slug, type, required?, unique?, relationSlug?, componentSlug?, options? }, ...] — same per-field shape as one SchemaTemplate component's own `fields`. Call list_field_types FIRST — it has the real options/relationSlug shape per type, never guess one. A relationSlug/componentSlug here legitimately points at something that may not exist yet — it only needs to resolve once a workspace actually applies these fields via its own create_component.",
          ),
          published: z.boolean().optional().describe("Default false (visible only to SaCMS Global staff until reviewed). Set true to make it immediately usable by every workspace's own MCP server."),
        },
        outputSchema: GLOBAL_COMPONENT_OUTPUT_SHAPE,
        annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      async ({ name, slug: slugInput, icon, description, category, fields, published }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const parsed = createGlobalComponentSchema.safeParse({ name, slug: slugInput, icon, description, category, fields, published })
        if (!parsed.success) return invalidSchema(parsed.error)

        const { blocking, warnings } = splitIssuesBySeverity(validateGlobalComponentFields(parsed.data.fields))
        if (blocking.length > 0) return referenceIssuesResponse(blocking)

        const slug = await dedupeSlug(parsed.data.slug || slugify(name), (s) => db.globalComponent.findUnique({ where: { slug: s } }))

        const component = await db.globalComponent.create({
          data: {
            name,
            slug,
            icon: icon || "🧩",
            description: description || null,
            category: category || null,
            fields: parsed.data.fields,
            published: published ?? false,
          },
        })
        const structured = serializeGlobalComponent(component)
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) + warningsNote(warnings) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "update_global_component",
      {
        title: "Update Global Component",
        description: "Update an existing Global Component's metadata, field array, and/or published status. Passing `fields` REPLACES the whole array — include every field you want to keep, not just the ones that changed.",
        inputSchema: {
          id: z.string().describe("Global Component id or slug"),
          name: z.string().min(1).max(150).optional().describe("New display name, if renaming."),
          icon: z.string().max(10).optional().describe("New single-emoji card icon, if changing."),
          description: z.string().max(500).optional().describe("New catalog-card blurb, if changing."),
          category: z.string().max(50).optional().describe("New category, if recategorizing."),
          fields: z.array(schemaTemplateFieldSchema).optional().describe("Full replacement for the `fields` array — same shape as create_global_component."),
          published: z.boolean().optional().describe("Set true to make this component immediately usable by every workspace, or false to hide it again."),
        },
        outputSchema: GLOBAL_COMPONENT_OUTPUT_SHAPE,
        annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ id, name, icon, description, category, fields, published }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const existing = await db.globalComponent.findFirst({ where: { OR: [{ id }, { slug: id }] } })
        if (!existing) return notFound("Global Component", id)

        const parsed = updateGlobalComponentSchema.safeParse({ name, icon, description, category, fields, published })
        if (!parsed.success) return invalidSchema(parsed.error)

        let fieldWarnings: { path: string; message: string }[] = []
        if (parsed.data.fields !== undefined) {
          const { blocking, warnings } = splitIssuesBySeverity(validateGlobalComponentFields(parsed.data.fields))
          if (blocking.length > 0) return referenceIssuesResponse(blocking)
          fieldWarnings = warnings
        }

        const component = await db.globalComponent.update({
          where: { id: existing.id },
          data: {
            ...(name !== undefined ? { name } : {}),
            ...(icon !== undefined ? { icon } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(category !== undefined ? { category } : {}),
            ...(parsed.data.fields !== undefined ? { fields: parsed.data.fields } : {}),
            ...(published !== undefined ? { published } : {}),
          },
        })
        const structured = serializeGlobalComponent(component)
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) + warningsNote(fieldWarnings) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "delete_global_component",
      {
        title: "Delete Global Component",
        description: "Permanently delete a Global Component from the catalog. This has no effect on any real Component already materialized in a tenant's own schema previously — it only stops it from being found/reused in future.",
        inputSchema: {
          id: z.string().describe("Global Component id or slug"),
        },
        outputSchema: { ok: z.literal(true) },
        annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const existing = await db.globalComponent.findFirst({ where: { OR: [{ id }, { slug: id }] } })
        if (!existing) return notFound("Global Component", id)

        await db.globalComponent.delete({ where: { id: existing.id } })
        const structured = { ok: true as const }
        return { content: [{ type: "text" as const, text: `✅ Global Component '${existing.name}' dihapus.` }], structuredContent: structured }
      },
    )

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
    serverInfo: { name: "sacms-global-schema-mcp", version: "1.16.0" },
    // Kept short deliberately — confirmed live that at least one real MCP
    // client (Claude Code) truncates a long `instructions` string outright
    // (this field used to run ~6,178 characters and was cut off mid-word
    // well before the end, so everything past the cut never reached the
    // agent). Call get_builder_guide for the full workflow; this is only
    // the handful of rules too safety-critical to risk never being read.
    instructions:
      "This server manages SaCMS's platform-wide template catalog ONLY — Schema Templates and Website " +
      "Templates and their linked internal demo workspaces. Customer workspaces use /api/mcp. " +
      "Call get_website_agent_workflow when building a website. Analyze the brief before creating or reusing its demo workspace. " +
      "Verify the actual demo schema before building the frontend and review security before deploying. " +
      "get_builder_guide covers the " +
      "workflow (schema+frontend build order, dry-run validation, demo preview contract, every structured " +
      "error code, and reusable Global Components via list_global_components/get_global_component). Four " +
      "rules too important to risk missing: (1) default stack for every Website Template " +
      "is Next.js + TypeScript + shadcn/ui, every component AND color token from shadcn's own system, " +
      "unless the user asks for something else; (2) call list_field_types before writing any " +
      "schema field — it has the real options/relationSlug shape per type and flags silently-ignored " +
      "options, never guess one; (3) richText field values are real HTML needing a sanitized " +
      "dangerouslySetInnerHTML in the frontend, never string interpolation, and markdown values need a " +
      "Markdown renderer, not an HTML sink; (4) for anything non-trivial, call create_website_template with " +
      "dryRun: true first — it validates the whole bundle without creating or deploying anything.",
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
