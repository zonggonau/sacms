import { db } from "@/lib/database"

/** Longer than any real budget (a sandbox build polls ~3 min, a demo
 *  deploy ~1 min): a row still "running" past this means the process
 *  restarted mid-run, so the promise that would have finished it is gone. */
const STALE_AFTER_MS = 20 * 60 * 1000

export type OperationKind =
  | "create_website_template"
  | "update_website_template"
  | "redeploy_website_template_demo"
  | "apply_website_template"
  | "deploy_site_version"
  | "deploy_to_sacms"
  | "verify_build"

export interface OperationOutcome {
  /** Stored as the operation's `result` — normally the tool's own
   *  structuredContent, so a poller gets the same shape a synchronous call
   *  would have returned. */
  result: unknown
  failed?: boolean
  error?: string
}

/**
 * Records a running operation and executes `run` WITHOUT awaiting it, so the
 * MCP request can return the operationId immediately. AsyncLocalStorage
 * context (the MCP auth) propagates into `run` because it starts inside the
 * same async chain as the request.
 */
export async function startBackgroundOperation(kind: OperationKind, tokenId: string | null, run: () => Promise<OperationOutcome>, tenantId?: string) {
  const operation = await db.globalMcpOperation.create({ data: { kind, tokenId, ...(tenantId ? { tenantId } : {}), status: "running" } })

  void (async () => {
    try {
      const outcome = await run()
      await db.globalMcpOperation.update({
        where: { id: operation.id },
        data: {
          status: outcome.failed ? "failed" : "succeeded",
          result: (outcome.result ?? null) as object,
          error: outcome.error ?? null,
          finishedAt: new Date(),
        },
      })
    } catch (err: any) {
      await db.globalMcpOperation
        .update({
          where: { id: operation.id },
          data: { status: "failed", error: err?.message || String(err), finishedAt: new Date() },
        })
        .catch((e) => console.warn(`[global-mcp-operations] Failed to record failure for ${operation.id}:`, e))
    }
  })()

  return operation
}

export async function getOperation(id: string, tenantId: string | null = null) {
  const operation = await db.globalMcpOperation.findUnique({ where: { id } })
  if (!operation || (operation.tenantId ?? null) !== tenantId) return null
  if (operation.status === "running" && Date.now() - operation.startedAt.getTime() > STALE_AFTER_MS) {
    return db.globalMcpOperation.update({
      where: { id },
      data: {
        status: "failed",
        error: "Interrupted: the server restarted before this operation finished. Check the template's current state (get_website_template / get_website_template_demo_status) before retrying.",
        finishedAt: new Date(),
      },
    })
  }
  return operation
}
