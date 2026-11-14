import "server-only"

import { createHash } from "crypto"
import { db } from "@/lib/database"

export interface DeploymentSourceFile {
  name: string
  content: string
  encoding: "utf-8" | "base64"
}

export interface DeploymentSourceManifestEntry {
  path: string
  size: number
  encoding: "utf-8" | "base64"
  checksum: string
}

export interface McpDeploymentSourceRecord {
  id: string
  tenantId: string
  deploymentId: string
  projectId: string | null
  manifest: DeploymentSourceManifestEntry[]
  files: DeploymentSourceFile[]
  createdAt: Date
}

/** Rolling window per tenant — this is for round-tripping recent revisions, not a permanent archive. */
const RETAIN_PER_TENANT = 20

export function checksumOf(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

export function buildManifest(files: DeploymentSourceFile[]): DeploymentSourceManifestEntry[] {
  return files.map((f) => ({
    path: f.name,
    size: f.content.length,
    encoding: f.encoding,
    checksum: checksumOf(f.content),
  }))
}

/**
 * Persist a full file snapshot for a successful deploy — the single
 * source-of-truth write every deploy_to_sacms/deploy_website_patch/
 * rollback_website success calls. Best-effort from the caller's
 * perspective (wrap in try/catch there): a persistence failure must never
 * fail the deploy that triggered it, but this function itself throws on a
 * genuine DB error so the caller can log it.
 */
export async function saveDeploymentSource(
  tenantId: string,
  deploymentId: string,
  projectId: string | null | undefined,
  files: DeploymentSourceFile[],
): Promise<McpDeploymentSourceRecord> {
  const manifest = buildManifest(files)
  const created = await db.mcpDeploymentSource.create({
    data: {
      tenantId,
      deploymentId,
      projectId: projectId || null,
      manifest: manifest as any,
      files: files as any,
    },
  })

  // Prune anything beyond the retention window — fire-and-forget is wrong
  // here (we don't want unbounded rows), but a pruning failure still must
  // not fail the write that just succeeded.
  try {
    const stale = await db.mcpDeploymentSource.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      skip: RETAIN_PER_TENANT,
      select: { id: true },
    })
    if (stale.length > 0) {
      await db.mcpDeploymentSource.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } })
    }
  } catch (err) {
    console.warn("[mcp-deployment-source] Failed to prune old source snapshots:", err)
  }

  return created as unknown as McpDeploymentSourceRecord
}

export async function getLatestDeploymentSource(tenantId: string): Promise<McpDeploymentSourceRecord | null> {
  const row = await db.mcpDeploymentSource.findFirst({ where: { tenantId }, orderBy: { createdAt: "desc" } })
  return row as unknown as McpDeploymentSourceRecord | null
}

/** Tenant-scoped lookup by the Vercel deploymentId it was captured from (not its own sourceRevision id). */
export async function getDeploymentSourceByDeploymentId(
  tenantId: string,
  deploymentId: string,
): Promise<McpDeploymentSourceRecord | null> {
  const row = await db.mcpDeploymentSource.findFirst({ where: { tenantId, deploymentId }, orderBy: { createdAt: "desc" } })
  return row as unknown as McpDeploymentSourceRecord | null
}

/** Tenant-scoped lookup by id — a sourceRevision alone carries no isolation of its own. */
export async function getDeploymentSourceByRevision(
  tenantId: string,
  sourceRevision: string,
): Promise<McpDeploymentSourceRecord | null> {
  const row = await db.mcpDeploymentSource.findUnique({ where: { id: sourceRevision } })
  return row && row.tenantId === tenantId ? (row as unknown as McpDeploymentSourceRecord) : null
}

export interface DeploymentSourceSummary {
  sourceRevision: string
  deploymentId: string
  fileCount: number
  createdAt: Date
}

export async function listDeploymentSources(tenantId: string, limit = 10): Promise<DeploymentSourceSummary[]> {
  const rows = await db.mcpDeploymentSource.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, RETAIN_PER_TENANT),
    select: { id: true, deploymentId: true, manifest: true, createdAt: true },
  })
  return rows.map((r) => ({
    sourceRevision: r.id,
    deploymentId: r.deploymentId,
    fileCount: Array.isArray(r.manifest) ? r.manifest.length : 0,
    createdAt: r.createdAt,
  }))
}
