import "server-only"

import { db } from "@/lib/database"

export type McpBuildRunIntent = "create" | "update"
export type McpBuildRunStage = "discover" | "deploying" | "verifying" | "done" | "failed"

/** A run is still "in flight" below this age — older ones are treated as
 *  abandoned rather than resumed, so start_website_build doesn't hand back
 *  a stale run from weeks ago just because it never reached a terminal
 *  stage. */
const RESUMABLE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export interface McpBuildRunRecord {
  id: string
  tenantId: string
  intent: string
  stage: string
  hostingProjectId: string | null
  deploymentId: string | null
  sourceRevision: string | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * The resumable work unit behind start_website_build/get_build_run — lets
 * an agent that loses its conversation mid-flow (ChatGPT session ends,
 * context gets summarized) pick back up via runId instead of guessing from
 * scratch. Resumes the tenant's own most recent non-terminal run within the
 * resumable window when one exists, instead of always starting a fresh one
 * — calling start_website_build again mid-build must not orphan the run
 * already in progress.
 */
export async function startOrResumeBuildRun(
  tenantId: string,
  intent: McpBuildRunIntent,
): Promise<{ run: McpBuildRunRecord; resumed: boolean }> {
  const existing = await db.mcpBuildRun.findFirst({
    where: {
      tenantId,
      stage: { notIn: ["done", "failed"] },
      createdAt: { gte: new Date(Date.now() - RESUMABLE_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
  })
  if (existing) return { run: existing, resumed: true }

  const run = await db.mcpBuildRun.create({
    data: { tenantId, intent, stage: "discover" },
  })
  return { run, resumed: false }
}

/**
 * Fetch a run by id (tenant-scoped — a runId alone carries no isolation of
 * its own) or, when omitted, the tenant's own most recent run regardless of
 * stage (unlike startOrResumeBuildRun, a plain status check should surface
 * a terminal run too, not just an in-flight one).
 */
export async function getBuildRun(
  tenantId: string,
  runId?: string,
): Promise<McpBuildRunRecord | null> {
  if (runId) {
    const run = await db.mcpBuildRun.findUnique({ where: { id: runId } })
    return run && run.tenantId === tenantId ? run : null
  }
  return db.mcpBuildRun.findFirst({ where: { tenantId }, orderBy: { createdAt: "desc" } })
}

/**
 * Best-effort stage advance — called from deploy_to_sacms/
 * verify_deployment_url when the caller passed a runId. Never throws:
 * run-tracking must never fail the real operation that triggered it.
 */
export async function advanceBuildRun(
  tenantId: string,
  runId: string,
  patch: Partial<Pick<McpBuildRunRecord, "stage" | "hostingProjectId" | "deploymentId" | "sourceRevision" | "lastError">>,
): Promise<void> {
  try {
    await db.mcpBuildRun.updateMany({ where: { id: runId, tenantId }, data: patch })
  } catch (err) {
    console.warn("[mcp-build-run] Failed to advance build run:", err)
  }
}
