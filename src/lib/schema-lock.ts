import "server-only"

import { db } from "./database"

/**
 * Finalizing a schema is a tenant-wide, draft/final toggle — not a full
 * version history. `Tenant.schemaFinalizedAt` always lives in the shared
 * master DB (where every `Tenant` row lives, dedicated-DB tenant or not),
 * never the tenant's own dedicated DB, same as `plan`/`aiCreditsUsed`/etc.
 */
export async function isSchemaFinalized(tenantId: string): Promise<boolean> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { schemaFinalizedAt: true } })
  return !!tenant?.schemaFinalizedAt
}

export const SCHEMA_LOCKED_MESSAGE =
  "Skema sudah difinalkan dan tidak bisa diubah. Buat draft dari halaman Schema Builder untuk mengeditnya lagi."

/**
 * Call at the top of every schema-mutating action (Content Type/Single
 * Type/Component create/update/delete, and schema import/materialize) —
 * returns an `{ error }` object to return as-is when the schema is locked,
 * or `null` when it's fine to proceed. Checked in exactly one place per
 * call site so the rule can't silently drift between them.
 */
export async function assertSchemaEditable(tenantId: string): Promise<{ error: string } | null> {
  if (await isSchemaFinalized(tenantId)) {
    return { error: SCHEMA_LOCKED_MESSAGE }
  }
  return null
}

export const SCHEMA_NOT_FINALIZED_MESSAGE =
  "Skema CMS belum difinalkan. Selesaikan dan finalkan skema di Schema Builder sebelum AI Site mulai membangun frontend, supaya AI Site fokus membangun UI terhadap struktur data yang sudah pasti, bukan ikut menebak-nebak skema yang masih berubah-ubah."

/**
 * The inverse of `assertSchemaEditable` — AI Site (project/chat creation and
 * every generation turn) requires the schema to already be settled before
 * it starts building a frontend against it, so a later schema change can't
 * silently invalidate assumptions the generated site already made.
 */
export async function assertSchemaFinalizedForAiSite(tenantId: string): Promise<{ error: string } | null> {
  if (!(await isSchemaFinalized(tenantId))) {
    return { error: SCHEMA_NOT_FINALIZED_MESSAGE }
  }
  return null
}

export async function finalizeSchema(tenantId: string): Promise<void> {
  await db.tenant.update({ where: { id: tenantId }, data: { schemaFinalizedAt: new Date() } })
}

export async function unlockSchemaToDraft(tenantId: string): Promise<void> {
  await db.tenant.update({ where: { id: tenantId }, data: { schemaFinalizedAt: null } })
}
