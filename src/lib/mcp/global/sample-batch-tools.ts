// registerDemoSampleBatchTools — Global MCP: list, verify, and clear the sample batches
// seed_demo_sample_content created in a Schema Template's demo workspace.
import { z } from "zod"
import { db } from "@/lib/database"
import { requireDemoWorkspace, DemoContentError } from "@/lib/infrastructure/demo-content"
import { deleteContentEntry } from "@/lib/content/entry-service"
import { invalidateSingleTypePublication } from "@/lib/single-type-publication"
import { ledgerKeyFor, ledgerPrefixFor, batchKeyFromLedgerKey, parseRecord, summarizeBatch, verifyBatch, type VerifyAdapters } from "@/lib/sample-content/batch-ops"
import { clearSampleBatch, type ClearDeps } from "@/lib/sample-content/clear"
import { McpServer, authContext, UNAUTHORIZED, runDemoOperation, scopeDenied } from "./context"

const schemaTemplateIdInput = z.string().trim().min(1).max(150).describe("Schema Template ID or slug whose demo workspace holds the batch.")

// Loaded lazily: the Prisma runtime is only needed when a batch is cleared.
const DbNull = () => require("@prisma/client").Prisma.DbNull

// Demo ledgers are scoped as `demo:<demoWorkspaceId>`, matching seed_demo_sample_content.
const demoScope = (demoId: string) => `demo:${demoId}`

export function registerDemoSampleBatchTools(server: McpServer) {
  server.registerTool(
      "list_demo_sample_batches",
    {
      title: "List Demo Sample Batches",
      description: "Lists the sample batches seeded into a Schema Template's demo workspace, with locale, time, and entry counts per Content Type. Needs the demo scope.",
      inputSchema: { schemaTemplateId: schemaTemplateIdInput },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ schemaTemplateId }) => {
      const auth = authContext.getStore()
      if (!auth) return UNAUTHORIZED
      if (!auth.scopes.includes("read")) return scopeDenied("list_demo_sample_batches", "read")
      return runDemoOperation(async () => {
        const demo = await requireDemoWorkspace(schemaTemplateId)
        const rows = await db.setting.findMany({
          where: { tenantId: demo.id, key: { startsWith: ledgerPrefixFor(demoScope(demo.id)) } },
          select: { key: true, value: true },
        })
        const batches = rows.flatMap((row) => {
          const batchId = batchKeyFromLedgerKey(row.key)
          const record = parseRecord(row.value)
          return batchId && record ? [summarizeBatch(batchId, record)] : []
        })
        return { demoWorkspace: demo.slug, batches } as Record<string, unknown>
      })
    },
  )

  server.registerTool(
      "verify_demo_sample_batch",
    {
      title: "Verify Demo Sample Batch",
      description: "Reads back every entry a demo batch created. Checks each still exists, is in the batch's locale, and, when PUBLISHED, is the content the demo preview reads. Drafts are reported as not public, not as failures. Read-only. Needs the demo scope.",
      inputSchema: {
        schemaTemplateId: schemaTemplateIdInput,
        batchId: z.string().min(1).describe("batchId from seed_demo_sample_content or list_demo_sample_batches"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ schemaTemplateId, batchId }) => {
      const auth = authContext.getStore()
      if (!auth) return UNAUTHORIZED
      if (!auth.scopes.includes("read")) return scopeDenied("verify_demo_sample_batch", "read")
      return runDemoOperation(async () => {
        const demo = await requireDemoWorkspace(schemaTemplateId)
        const row = await db.setting.findUnique({ where: { key: ledgerKeyFor(demoScope(demo.id), batchId) } })
        const record = row ? parseRecord(row.value) : null
        if (!record) throw new DemoContentError("NOT_FOUND", `No sample batch "${batchId}" in this demo workspace.`)

        const adapters: VerifyAdapters = {
          entry: async (contentType, id) => {
            const e = await db.contentEntry.findFirst({
              where: { id, tenantId: demo.id, deletedAt: null, contentType: { slug: contentType } },
              select: { status: true, locale: true },
            })
            return e ? { status: String(e.status), locale: e.locale } : null
          },
          publicIds: async (contentType, locale) => {
            const rows = await db.contentEntry.findMany({
              where: { tenantId: demo.id, deletedAt: null, status: "PUBLISHED", locale, contentType: { slug: contentType } },
              select: { id: true },
            })
            return new Set(rows.map((r) => r.id))
          },
          single: async (slug, locale) => {
            const st = await db.singleType.findFirst({ where: { tenantId: demo.id, slug, draftTemplateId: null }, select: { id: true } })
            if (!st) return null
            const a = await db.tenantSingleTypeAssignment.findUnique({
              where: { tenantId_singleTypeId_locale: { tenantId: demo.id, singleTypeId: st.id, locale } },
              select: { data: true },
            })
            return a ? { published: a.data != null } : null
          },
        }
        const report = await verifyBatch(record, adapters)
        return { batchId, demoWorkspace: demo.slug, ...report } as unknown as Record<string, unknown>
      })
    },
  )

  server.registerTool(
      "clear_demo_sample_batch",
    {
      title: "Clear Demo Sample Batch",
      description: "Removes the entries one demo sample batch created, so the demo can be re-seeded from a clean state. Entries are soft-deleted and Single Type content the batch wrote is emptied. Only ids the batch recorded are touched. A second call does nothing. Requires confirm: true. Needs the demo scope.",
      inputSchema: {
        schemaTemplateId: schemaTemplateIdInput,
        batchId: z.string().min(1),
        confirm: z.literal(true).describe("Must be true. Confirms the demo entries will be removed."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ schemaTemplateId, batchId }) => {
      const auth = authContext.getStore()
      if (!auth) return UNAUTHORIZED
      if (!auth.scopes.includes("demo")) return scopeDenied("clear_demo_sample_batch", "demo")
      return runDemoOperation(async () => {
        const demo = await requireDemoWorkspace(schemaTemplateId)
        const key = ledgerKeyFor(demoScope(demo.id), batchId)
        const row = await db.setting.findUnique({ where: { key } })
        const record = row ? parseRecord(row.value) : null
        if (!record) throw new DemoContentError("NOT_FOUND", `No sample batch "${batchId}" in this demo workspace.`)

        const context = { tenantId: demo.id, tenantSlug: demo.slug, client: db }
        const deps: ClearDeps = {
          deleteEntry: async (contentType, id) => {
            const res = await deleteContentEntry(context, { kind: "system" }, { contentTypeSlug: contentType, entryId: id })
            if (res.ok) return "deleted"
            if (res.code === "not_found") return "gone"
            throw new Error(res.message)
          },
          clearSingle: async (singleType, locale) => {
            const result = await db.tenantSingleTypeAssignment.updateMany({
              where: { tenantId: demo.id, locale, singleType: { slug: singleType } },
              data: { data: DbNull(), draftData: DbNull(), publishedAt: null },
            })
            await invalidateSingleTypePublication(demo.id, singleType, locale)
            return result.count > 0
          },
          saveRecord: async (updated) => {
            await db.setting.update({ where: { key }, data: { value: JSON.stringify(updated) } })
          },
        }
        const result = await clearSampleBatch(record, deps)
        return {
          ok: result.failures.length === 0,
          batchId,
          demoWorkspace: demo.slug,
          alreadyCleared: result.alreadyCleared,
          deletedEntries: result.deletedEntries,
          clearedSingles: result.clearedSingles,
          failures: result.failures,
        } as Record<string, unknown>
      })
    },
  )
}
