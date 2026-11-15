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
  idempotencyKey: string | null
  createdAt: Date
  updatedAt: Date
}

/** A claimed-but-unresolved idempotency key older than this is treated as
 *  abandoned (the original caller crashed or never got a second chance to
 *  finish) rather than something still genuinely in flight — a fresh
 *  submit with the same key is then allowed to proceed instead of being
 *  stuck behind a dead claim forever. */
const IDEMPOTENCY_IN_FLIGHT_WINDOW_MS = 2 * 60 * 1000

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
 * its own), or by the idempotencyKey a deploy submission was made with (so
 * "my response never arrived" can be resolved via either handle — see
 * findOrClaimByIdempotencyKey), or, when neither is given, the tenant's
 * most recent run regardless of stage (unlike startOrResumeBuildRun, a
 * plain status check should surface a terminal run too, not just an
 * in-flight one).
 */
export async function getBuildRun(
  tenantId: string,
  runId?: string,
  idempotencyKey?: string,
): Promise<McpBuildRunRecord | null> {
  if (runId) {
    const run = await db.mcpBuildRun.findUnique({ where: { id: runId } })
    return run && run.tenantId === tenantId ? run : null
  }
  if (idempotencyKey) {
    return db.mcpBuildRun.findFirst({ where: { tenantId, idempotencyKey } })
  }
  return db.mcpBuildRun.findFirst({ where: { tenantId }, orderBy: { createdAt: "desc" } })
}

/**
 * Submission-level idempotency for deploy_to_sacms/deploy_website_patch
 * (chatgpt2.md P1): if the caller's first response never arrived and it
 * retries with the SAME idempotencyKey, this must resolve to the SAME
 * build run instead of letting a second deploy happen. Claims the key via
 * an atomic insert — the DB's own unique constraint on (tenantId,
 * idempotencyKey) is what actually makes two concurrent claims race-safe,
 * not the find-then-create order here (a P2002 on create means someone
 * else won the race between our check and our insert; re-reading in that
 * case still returns the correct, single winning row).
 */
export async function findOrClaimByIdempotencyKey(
  tenantId: string,
  idempotencyKey: string,
  intent: McpBuildRunIntent,
): Promise<{ run: McpBuildRunRecord; isNew: boolean }> {
  const existing = await db.mcpBuildRun.findFirst({ where: { tenantId, idempotencyKey } })
  if (existing) return { run: existing, isNew: false }

  try {
    const created = await db.mcpBuildRun.create({
      data: { tenantId, intent, stage: "discover", idempotencyKey },
    })
    return { run: created, isNew: true }
  } catch {
    // Unique constraint race — another request claimed this exact key
    // between our read and our write. Re-read to get the winning row.
    const winner = await db.mcpBuildRun.findFirst({ where: { tenantId, idempotencyKey } })
    if (winner) return { run: winner, isNew: false }
    throw new Error("Failed to claim idempotency key — no row found after a create conflict.")
  }
}

/**
 * Whether a claimed-but-not-yet-completed idempotency key should still
 * block a fresh deploy. A run already marked "failed" is NEVER in flight,
 * regardless of how recently it was touched — this is what makes a retry
 * safe immediately after a rejection (a rate limit, a validation error)
 * that happened BEFORE anything was sent to Vercel (chatgpt3.md: a retry
 * with the same idempotencyKey right after a rate-limited submission was
 * wrongly getting DEPLOY_IN_PROGRESS, because the claimed run was still
 * within this window with no deploymentId yet). Every rejection path that
 * claims a run via resolveIdempotency must advance it to "failed" before
 * returning, precisely so this check lets the very next retry through.
 */
export function isIdempotencyClaimStillInFlight(run: McpBuildRunRecord): boolean {
  if (run.deploymentId) return false
  if (run.stage === "failed") return false
  return Date.now() - run.updatedAt.getTime() < IDEMPOTENCY_IN_FLIGHT_WINDOW_MS
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
