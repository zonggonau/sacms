// registerSampleBatchTools — Workspace MCP: list, verify, and clear sample batches
// created by seed_sample_content. Only what a batch's ledger recorded is touched.
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { db, getTenantDb } from "@/lib/database"
import { deleteContentEntry, contentRevalidatePaths } from "@/lib/content/entry-service"
import { queryContentForTenant } from "@/lib/cms-introspection"
import { invalidateSingleTypePublication } from "@/lib/single-type-publication"
import { isGlobalWorkspace } from "@/lib/global-workspace"
import { ledgerKeyFor, ledgerPrefixFor, batchKeyFromLedgerKey, parseRecord, summarizeBatch, verifyBatch, type VerifyAdapters } from "@/lib/sample-content/batch-ops"
import { clearSampleBatch, type ClearDeps } from "@/lib/sample-content/clear"
import type { SeedRecord } from "@/lib/sample-content/run"
import { McpServer, authContext, UNAUTHORIZED, hasScope, permissionDenied, mcpEntryContext } from "./context"

const textResult = (value: unknown, isError = false) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  ...(isError ? { isError: true } : {}),
})

// Loaded lazily: the Prisma runtime is only needed when a batch is cleared.
const DbNull = async () => (await import("@prisma/client")).Prisma.DbNull

async function loadRecord(tenantId: string, batchId: string): Promise<SeedRecord | null> {
  const row = await db.setting.findUnique({ where: { key: ledgerKeyFor(tenantId, batchId) } })
  return row ? parseRecord(row.value) : null
}

async function workspaceAdapters(tenantDb: Awaited<ReturnType<typeof getTenantDb>>, tenantId: string): Promise<VerifyAdapters> {
  return {
    entry: async (contentType, id) => {
      const row = await tenantDb.contentEntry.findFirst({
        where: { id, tenantId, deletedAt: null, contentType: { slug: contentType } },
        select: { status: true },
      })
      return row ? { status: String(row.status) } : null
    },
    // What the public content API returns (the same query the website uses).
    publicIds: async (contentType) => {
      const result = await queryContentForTenant(tenantDb, tenantId, {
        contentTypeSlug: contentType, limit: 100, page: 1, status: "PUBLISHED", sortOrder: "desc",
      })
      return new Set(((result?.data ?? []) as Array<{ _id: string }>).map((e) => e._id))
    },
    single: async (slug) => {
      const st = await tenantDb.singleType.findFirst({ where: { tenantId, slug, draftTemplateId: null }, select: { id: true } })
      if (!st) return null
      const assignment = await tenantDb.tenantSingleTypeAssignment.findUnique({
        where: { tenantId_singleTypeId: { tenantId, singleTypeId: st.id } },
        select: { data: true },
      })
      return assignment ? { published: assignment.data != null } : null
    },
  }
}

export function registerSampleBatchTools(server: McpServer) {
  // ── list_sample_batches ──────────────────────────────────────────────────
  server.registerTool(
    "list_sample_batches",
    {
      title: "List Sample Batches",
      description: "Lists the sample-content batches seeded in this workspace, with time, how many entries each Content Type received, and whether each batch was already cleared.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const auth = authContext.getStore()
      if (!auth) return UNAUTHORIZED
      if (!hasScope(auth, "read")) return permissionDenied("read")

      const rows = await db.setting.findMany({
        where: { tenantId: auth.tenantId, key: { startsWith: ledgerPrefixFor(auth.tenantId) } },
        select: { key: true, value: true },
      })
      const batches = rows.flatMap((row) => {
        const batchId = batchKeyFromLedgerKey(row.key)
        const record = parseRecord(row.value)
        return batchId && record ? [summarizeBatch(batchId, record)] : []
      })
      return textResult({ batches })
    },
  )

  // ── verify_sample_batch ──────────────────────────────────────────────────
  server.registerTool(
    "verify_sample_batch",
    {
      title: "Verify Sample Batch",
      description: "Reads back every entry a batch created. Checks each still exists and, when PUBLISHED, is returned by the public content API the website reads. Drafts are reported as not public, not as failures. Read-only.",
      inputSchema: { batchId: z.string().min(1).describe("batchId from seed_sample_content or list_sample_batches") },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ batchId }) => {
      const auth = authContext.getStore()
      if (!auth) return UNAUTHORIZED
      if (!hasScope(auth, "read")) return permissionDenied("read")

      const record = await loadRecord(auth.tenantId, batchId)
      if (!record) return textResult({ ok: false, code: "NOT_FOUND", message: `No sample batch "${batchId}" in this workspace.` }, true)

      const tenantDb = await getTenantDb(auth.tenantSlug)
      const report = await verifyBatch(record, await workspaceAdapters(tenantDb, auth.tenantId))
      return textResult({ batchId, ...report })
    },
  )

  // ── clear_sample_batch ───────────────────────────────────────────────────
  server.registerTool(
    "clear_sample_batch",
    {
      title: "Clear Sample Batch",
      description: "Removes the entries one sample batch created. Entries are soft-deleted (they stay in the trash for the trash window), and Single Type content the batch wrote is emptied. Only ids the batch recorded are touched. A cleared batch is marked and a second call does nothing. Requires confirm: true. Not available on the SaCMS Global workspace.",
      inputSchema: {
        batchId: z.string().min(1),
        confirm: z.literal(true).describe("Must be true. Confirms the entries will be removed."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ batchId }) => {
      const auth = authContext.getStore()
      if (!auth) return UNAUTHORIZED
      if (!hasScope(auth, "write")) return permissionDenied("write")
      if (await isGlobalWorkspace({ id: auth.tenantId, slug: auth.tenantSlug })) {
        return textResult({ ok: false, code: "FORBIDDEN", message: "Sample batches cannot be cleared on the SaCMS Global workspace." }, true)
      }

      const record = await loadRecord(auth.tenantId, batchId)
      if (!record) return textResult({ ok: false, code: "NOT_FOUND", message: `No sample batch "${batchId}" in this workspace.` }, true)

      const tenantDb = await getTenantDb(auth.tenantSlug)
      const { ctx, actor } = await mcpEntryContext(auth, tenantDb)
      const deps: ClearDeps = {
        deleteEntry: async (contentType, id) => {
          const res = await deleteContentEntry(ctx, actor, { contentTypeSlug: contentType, entryId: id })
          if (res.ok) return "deleted"
          if (res.code === "not_found") return "gone"
          throw new Error(res.message)
        },
        clearSingle: async (singleType) => {
          const result = await tenantDb.tenantSingleTypeAssignment.updateMany({
            where: { tenantId: auth.tenantId, singleType: { slug: singleType } },
            data: { data: await DbNull(), draftData: await DbNull(), publishedAt: null },
          })
          await invalidateSingleTypePublication(auth.tenantId, singleType)
          return result.count > 0
        },
        saveRecord: async (updated) => {
          await db.setting.update({ where: { key: ledgerKeyFor(auth.tenantId, batchId) }, data: { value: JSON.stringify(updated) } })
        },
      }

      const result = await clearSampleBatch(record, deps)
      for (const group of result.targets.collections) {
        for (const path of contentRevalidatePaths(auth.tenantSlug, group.contentType)) revalidatePath(path)
      }
      return textResult({
        ok: result.failures.length === 0,
        batchId,
        alreadyCleared: result.alreadyCleared,
        deletedEntries: result.deletedEntries,
        clearedSingles: result.clearedSingles,
        failures: result.failures,
      }, result.failures.length > 0)
    },
  )
}
