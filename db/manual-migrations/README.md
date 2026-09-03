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
