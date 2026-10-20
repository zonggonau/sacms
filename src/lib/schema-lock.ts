import "server-only"

import { db } from "./database"

/**
 * Finalizing a schema is a tenant-wide, draft/final toggle — not a full
 * version history. `Tenant.schemaFinalizedAt` always lives in the shared
 * master DB (where every `Tenant` row lives, dedicated-DB tenant or not),
 * never the tenant's own dedicated DB, same as `plan`/`aiCreditsUsed`/etc.
 *
 * Deliberately only enforced from the dashboard's own schema-mutating
 * Server Actions (content-types.ts/single-types.ts/components.ts) and the
 * AI Schema Generator's import route — the MCP server's content-type tools
 * (src/app/api/mcp/[[...transport]]/route.ts) write to the tenant DB
 * directly and never call these actions, so they bypass this lock
 * entirely. That's intentional, not an oversight: an IDE/agent connected
 * via MCP is trusted to manage schema changes itself once connected,
 * independent of whatever draft/final state a human set from the
 * dashboard.
 */
export async function isSchemaFinalized(tenantId: string): Promise<boolean> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { schemaFinalizedAt: true } })
  return !!tenant?.schemaFinalizedAt
}

export const SCHEMA_LOCKED_MESSAGE =
  "Skema sudah dipublish/final dan tidak bisa diubah dari dashboard. Ubah ke Draft dulu di halaman Schema Builder untuk mengeditnya lagi."

/**
 * Call at the top of every dashboard-facing schema-mutating action (Content
 * Type/Single Type/Component create/update/delete, schema import, and
 * delete-all-schema) — returns an `{ error }` object to return as-is when
 * the schema is locked, or `null` when it's fine to proceed.
 */
export async function assertSchemaEditable(tenantId: string): Promise<{ error: string } | null> {
  if (await isSchemaFinalized(tenantId)) {
    return { error: SCHEMA_LOCKED_MESSAGE }
  }
  return null
}

export async function finalizeSchema(tenantId: string): Promise<void> {
  await db.tenant.update({ where: { id: tenantId }, data: { schemaFinalizedAt: new Date() } })
}

export async function unlockSchemaToDraft(tenantId: string): Promise<void> {
  await db.tenant.update({ where: { id: tenantId }, data: { schemaFinalizedAt: null } })
}
