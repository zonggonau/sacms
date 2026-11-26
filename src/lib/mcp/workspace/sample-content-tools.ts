// registerSampleContentTools — Workspace MCP: plan and seed schema-driven sample entries.
// The plan is read-only. The seed writes through the same createContentEntry path as
// create_content_entry, so validation, locale and plan limits apply unchanged.
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { db, getTenantDb } from "@/lib/database"
import { createContentEntry, contentRevalidatePaths } from "@/lib/content/entry-service"
import { serializeTenantSchema } from "@/lib/schema-template-sync"
import { isGlobalWorkspace } from "@/lib/global-workspace"
import { buildSamplePlan, MAX_PER_TYPE, type SampleSchema, type PlanOptions } from "@/lib/sample-content/plan"
import { runSamplePlan, type EntryWriter, type SeedLedger, type SeedRecord } from "@/lib/sample-content/run"
import { McpServer, authContext, UNAUTHORIZED, hasScope, permissionDenied, mcpEntryContext } from "./context"

const sampleInputShape = {
  locale: z.string().default("id").describe("Locale the entries are written in (e.g. 'id', 'en'). Use the locale the website shows."),
  perType: z.number().int().min(1).max(MAX_PER_TYPE).default(3).describe(`Entries per Content Type (1–${MAX_PER_TYPE}).`),
  contentTypes: z.array(z.string()).optional().describe("Only these Content Type slugs. Omit for all."),
}

async function loadWorkspaceSample(tenantId: string, tenantSlug: string) {
  const tenantDb = await getTenantDb(tenantSlug)
  const bundle = await serializeTenantSchema(tenantDb, { tenantId, draftTemplateId: null } as any)
  const schema: SampleSchema = {
    contentTypes: bundle.contentTypes,
    singleTypes: bundle.singleTypes,
    components: bundle.components,
  }
  const [types, grouped] = await Promise.all([
    tenantDb.contentType.findMany({ where: { tenantId, draftTemplateId: null }, select: { id: true, slug: true } }),
    tenantDb.contentEntry.groupBy({ by: ["contentTypeId"], where: { tenantId, deletedAt: null }, _count: { _all: true } }),
  ])
  const slugById = new Map(types.map((t) => [t.id, t.slug]))
  const existingCounts: Record<string, number> = {}
  for (const row of grouped) {
    const slug = slugById.get(row.contentTypeId)
    if (slug) existingCounts[slug] = row._count._all
  }
  return { tenantDb, schema, existingCounts }
}

const textResult = (value: unknown, isError = false) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  ...(isError ? { isError: true } : {}),
})

export function registerSampleContentTools(server: McpServer) {
  // ── plan_sample_content ──────────────────────────────────────────────────
  server.registerTool(
    "plan_sample_content",
    {
      title: "Plan Sample Content",
      description: "Read-only. Analyzes this workspace's schema and returns the sample entries that would be created: order (relation targets first), entries per Content Type, Content Types left out and why, and optional fields that cannot be filled automatically (media, Member relations). Writes nothing. Call before seed_sample_content.",
      inputSchema: sampleInputShape,
    },
    async ({ locale, perType, contentTypes }) => {
      const auth = authContext.getStore()
      if (!auth) return UNAUTHORIZED
      if (!hasScope(auth, "read")) return permissionDenied("read")

      const { schema, existingCounts } = await loadWorkspaceSample(auth.tenantId, auth.tenantSlug)
      const options: PlanOptions = { locale, perType, contentTypes, existingCounts }
      return textResult(buildSamplePlan(schema, options))
    },
  )

  // ── seed_sample_content ──────────────────────────────────────────────────
  server.registerTool(
    "seed_sample_content",
    {
      title: "Seed Sample Content",
      description: "Creates sample entries from the workspace schema, in dependency order, so relations point at real entries. Content Types that already have entries are skipped, so running it again does not duplicate data. Returns batchId (the plan's batchKey) and every created id by Content Type, for cleanup. Entries are DRAFT unless status says otherwise. Not available on the SaCMS Global workspace.",
      inputSchema: {
        ...sampleInputShape,
        status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT").describe("Status for created entries. Use PUBLISHED only in a demo or staging workspace whose data may be public."),
      },
    },
    async ({ locale, perType, contentTypes, status }) => {
      const auth = authContext.getStore()
      if (!auth) return UNAUTHORIZED
      if (!hasScope(auth, "write")) return permissionDenied("write")
      if (await isGlobalWorkspace({ id: auth.tenantId, slug: auth.tenantSlug })) {
        return textResult({ ok: false, code: "FORBIDDEN", message: "Sample content cannot be seeded into the SaCMS Global workspace." }, true)
      }

      const tenantDb = await getTenantDb(auth.tenantSlug)
      const { schema, existingCounts } = await loadWorkspaceSample(auth.tenantId, auth.tenantSlug)
      const plan = buildSamplePlan(schema, { locale, perType, contentTypes, existingCounts })
      const { ctx, actor } = await mcpEntryContext(auth, tenantDb)

      const writer: EntryWriter = {
        create: async (slug, data, entryLocale) => {
          const result = await createContentEntry(ctx, actor, { contentTypeSlug: slug, data, status, locale: entryLocale })
          return result.ok ? { ok: true, id: result.data.id } : { ok: false, message: result.message }
        },
        existingIds: async (slug, entryLocale) => {
          const rows = await tenantDb.contentEntry.findMany({
            where: { tenantId: auth.tenantId, deletedAt: null, locale: entryLocale, contentType: { slug } },
            select: { id: true },
            orderBy: { createdAt: "asc" },
            take: 50,
          })
          return rows.map((r) => r.id)
        },
      }
      const ledger: SeedLedger = {
        load: async (key) => {
          const row = await db.setting.findUnique({ where: { key } })
          return row ? (JSON.parse(row.value) as SeedRecord) : null
        },
        save: async (key, record) => {
          const value = JSON.stringify(record)
          await db.setting.upsert({ where: { key }, create: { key, value, tenantId: auth.tenantId }, update: { value } })
        },
      }

      const result = await runSamplePlan({
        schema,
        plan,
        writer,
        ledger,
        ledgerKey: `sample-batch:${auth.tenantId}:${plan.batchKey}`,
      })

      for (const slug of Object.keys(result.ids)) {
        for (const path of contentRevalidatePaths(auth.tenantSlug, slug)) revalidatePath(path)
      }

      return textResult({
        ok: result.ok,
        batchId: plan.batchKey,
        alreadySeeded: result.alreadySeeded,
        created: result.created,
        ids: result.ids,
        skipped: result.skipped,
        unfillable: result.unfillable,
        ...(result.error ? { error: result.error } : {}),
      }, !result.ok)
    },
  )
}
