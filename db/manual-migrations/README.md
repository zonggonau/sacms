# Manual migrations

`prisma db push` in the deploy pipeline runs **without** `--accept-data-loss`.
That means any destructive schema change (dropping a table or column, narrowing a
type) makes the push abort and fails the deploy on purpose — nobody's data gets
dropped by an unattended pipeline.

When a destructive change really is intended, land the SQL here as a numbered,
idempotent file. The deploy applies every `*.sql` in this directory (sorted)
*before* `prisma db push`, so by the time the push runs the schema already
matches and it has nothing destructive left to do.

## Rules for files here

- **Idempotent.** Use `DROP TABLE IF EXISTS`, `ALTER TABLE ... DROP COLUMN IF
  EXISTS`, `... ADD COLUMN IF NOT EXISTS`. The pipeline re-runs every file on
  every deploy.
- **Numbered prefix** for ordering: `0001_drop_tenant_roles.sql`.
- **One concern per file**, with a comment explaining why it's safe.
- Once applied in production, keep the file (it stays idempotent) — don't delete
  it, or a fresh environment would miss the step.

## Applied

| File | What | Why safe |
|------|------|----------|
| `0001_drop_tenant_roles.sql` | `DROP TABLE tenant_roles` | The `TenantRole` model + all `roles/*` / `system-roles/*` routes and `actions/roles.ts` were deleted in the RBAC consolidation (commit `18c3696`). Zero runtime readers; the table only ever held seed data. |
| `0002_drop_user_vps_services.sql` | `DROP TABLE user_vps_services` | The bring-your-own-VPS feature (Contabo provisioning, VPS catalog/ordering, Cloud Server page, Infrastructure tab VPS lifecycle UI) was removed entirely — every workspace now uses SaCMS's own managed infrastructure (ManagedInfraService/BYODB + StorageAddon) instead. Zero runtime readers left after the code removal. |
| `0003_drop_site_builder_tables.sql` | `DROP TABLE sites, site_files, site_versions, site_deployments, site_conversations, site_messages` | Abandoned multi-file "AI Website Builder" pipeline (chat-driven, real Vercel deploy) that no UI ever called — superseded by the single-file `TenantStaticSite` pipeline (Developer Portal > AI Website Builder, served at `/site/[tenant]`). Zero runtime readers left after the code removal. |
| `0004_drop_static_site_tables.sql` | `DROP TABLE tenant_static_sites, tenant_static_site_versions` | The single-file AI Website Builder itself was then removed too — SaCMS no longer offers an in-dashboard AI website generator; frontend development is done in an IDE connected via MCP instead. Zero runtime readers left after the code removal. |
| `0005_drop_tenant_schema_finalized_at.sql` | `ALTER TABLE tenants DROP COLUMN schemaFinalizedAt` | The CMS schema finalization gate (draft/final toggle blocking schema edits and requiring final before AI Site would generate) was removed entirely — it made AI Site's results worse, not safer. Zero runtime readers left after the code removal (`src/lib/schema-lock.ts` and friends deleted). |
