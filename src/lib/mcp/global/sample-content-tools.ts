// registerSampleContentTools — Global MCP: plan and seed sample entries in a Schema
// Template's demo workspace. Writes go through saveDemoContentEntry, so the demo's own
// rules (its locale resolution and content checks) still apply. The demo workspace is
// a test fixture, so publishing here is direct and needs no approval.
import { z } from "zod"
import { db, getTenantDb } from "@/lib/database"
import { requireDemoWorkspace, saveDemoContentEntry, updateDemoSingleTypeEntry, DemoContentError } from "@/lib/infrastructure/demo-content"
import { serializeTenantSchema } from "@/lib/schema-template-sync"
import { buildSamplePlan, MAX_PER_TYPE, type SampleSchema, type PlanOptions } from "@/lib/sample-content/plan"
import { runSamplePlan, type EntryWriter, type SeedLedger, type SeedRecord } from "@/lib/sample-content/run"
import { McpServer, authContext, UNAUTHORIZED, runDemoOperation, scopeDenied } from "./context"
import { registerDemoSampleBatchTools } from "./sample-batch-tools"

const demoSampleShape = {
  schemaTemplateId: z.string().trim().min(1).max(150).describe("Schema Template ID or slug. Its demo workspace receives the sample entries."),
  locale: z.string().default("id").describe("Locale the entries are written in (e.g. 'id', 'en')."),
  perType: z.number().int().min(1).max(MAX_PER_TYPE).default(3).describe(`Entries per Content Type (1–${MAX_PER_TYPE}).`),
  contentTypes: z.array(z.string()).optional().describe("Only these Content Type slugs. Omit for all."),
}

async function loadDemoSample(templateId: string, locale: string) {
  const demo = await requireDemoWorkspace(templateId)
  const tenantDb = await getTenantDb(demo.slug)
  const bundle = await serializeTenantSchema(tenantDb, { tenantId: demo.id, draftTemplateId: null } as any)
  const schema: SampleSchema = {
    contentTypes: bundle.contentTypes,
    singleTypes: bundle.singleTypes,
    components: bundle.components,
  }
  const [types, grouped] = await Promise.all([
    tenantDb.contentType.findMany({ where: { tenantId: demo.id, draftTemplateId: null }, select: { id: true, slug: true } }),
    tenantDb.contentEntry.groupBy({ by: ["contentTypeId"], where: { tenantId: demo.id, deletedAt: null }, _count: { _all: true } }),
  ])
  const slugById = new Map(types.map((t) => [t.id, t.slug]))
  const existingCounts: Record<string, number> = {}
  for (const row of grouped) {
    const slug = slugById.get(row.contentTypeId)
    if (slug) existingCounts[slug] = row._count._all
  }
  // A Single Type counts as populated when this locale already has content.
  const assigned = await tenantDb.tenantSingleTypeAssignment.findMany({
    where: { tenantId: demo.id, locale, singleType: { draftTemplateId: null } },
    select: { data: true, draftData: true, singleType: { select: { slug: true } } },
  })
  for (const a of assigned) {
    if (a.data != null || a.draftData != null) existingCounts[`single:${a.singleType.slug}`] = 1
  }
  return { demo, tenantDb, schema, existingCounts }
}

export function registerSampleContentTools(server: McpServer) {
  registerDemoSampleBatchTools(server)
  // ── plan_demo_sample_content ─────────────────────────────────────────────
  server.registerTool(
      "plan_demo_sample_content",
    {
      title: "Plan Demo Sample Content",
      description: "Read-only. Analyzes a Schema Template's demo workspace schema and returns the sample entries that seed_demo_sample_content would create: order, entries per Content Type, Content Types left out and why, and optional fields that cannot be filled automatically. Needs the demo scope.",
      inputSchema: demoSampleShape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ schemaTemplateId, locale, perType, contentTypes }) => {
      const auth = authContext.getStore()
      if (!auth) return UNAUTHORIZED
      if (!auth.scopes.includes("read")) return scopeDenied("plan_demo_sample_content", "read")

      return runDemoOperation(async () => {
        const { schema, existingCounts } = await loadDemoSample(schemaTemplateId, locale)
        const options: PlanOptions = { locale, perType, contentTypes, existingCounts }
        return buildSamplePlan(schema, options) as unknown as Record<string, unknown>
      })
    },
  )

  // ── seed_demo_sample_content ─────────────────────────────────────────────
  server.registerTool(
      "seed_demo_sample_content",
    {
      title: "Seed Demo Sample Content",
      description: "Creates sample entries in a Schema Template's demo workspace, in dependency order so relations point at real entries. Content Types that already have entries are skipped, so a re-run does not duplicate data. Returns batchId and every created id by Content Type. Entries are PUBLISHED by default, because the demo is the test site the preview reads from. Needs the demo scope.",
      inputSchema: {
        ...demoSampleShape,
        status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED").describe("Status for created entries. PUBLISHED makes them visible in the demo preview."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ schemaTemplateId, locale, perType, contentTypes, status }) => {
      const auth = authContext.getStore()
      if (!auth) return UNAUTHORIZED
      if (!auth.scopes.includes("demo")) return scopeDenied("seed_demo_sample_content", "demo")

      return runDemoOperation(async () => {
        const { demo, schema, existingCounts } = await loadDemoSample(schemaTemplateId, locale)
        const plan = buildSamplePlan(schema, { locale, perType, contentTypes, existingCounts })

        const writer: EntryWriter = {
          create: async (slug, data, entryLocale) => {
            try {
              const saved = await saveDemoContentEntry(schemaTemplateId, {
                contentTypeSlug: slug,
                locale: entryLocale,
                data: data as any,
                status,
              })
              return { ok: true, id: saved.entry.id }
            } catch (error) {
              if (error instanceof DemoContentError) return { ok: false, message: error.message }
              throw error
            }
          },
          upsertSingle: async (slug, data, entryLocale) => {
            try {
              await updateDemoSingleTypeEntry(schemaTemplateId, {
                singleTypeSlug: slug,
                locale: entryLocale,
                data: data as any,
                publish: status === "PUBLISHED",
              })
              const assignment = await db.tenantSingleTypeAssignment.findFirst({
                where: { tenantId: demo.id, locale: entryLocale, singleType: { slug } },
                select: { id: true },
              })
              return assignment ? { ok: true, id: assignment.id } : { ok: false, message: "Assignment tidak ditemukan setelah penulisan." }
            } catch (error) {
              if (error instanceof DemoContentError) return { ok: false, message: error.message }
              throw error
            }
          },
          existingIds: async (slug, entryLocale) => {
            const rows = await db.contentEntry.findMany({
              where: { tenantId: demo.id, deletedAt: null, locale: entryLocale, contentType: { slug } },
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
            await db.setting.upsert({ where: { key }, create: { key, value, tenantId: demo.id }, update: { value } })
          },
        }

        const result = await runSamplePlan({
          schema,
          plan,
          writer,
          ledger,
          ledgerKey: `sample-batch:demo:${demo.id}:${plan.batchKey}`,
        })
        return {
          ok: result.ok,
          batchId: plan.batchKey,
          demoWorkspace: demo.slug,
          alreadySeeded: result.alreadySeeded,
          created: result.created,
          ids: result.ids,
          skipped: result.skipped,
          unfillable: result.unfillable,
          ...(result.error ? { error: result.error } : {}),
        } as Record<string, unknown>
      })
    },
  )
}
