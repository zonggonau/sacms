-- McpBuildRun.idempotencyKey (chatgpt2.md P1: deploy_to_sacms/deploy_website_patch
-- idempotency) + its compound unique index on (tenantId, idempotencyKey).
--
-- Landed here, ahead of `prisma db push`, because Prisma's own diff treats
-- ANY new unique constraint as a possible-data-loss change and the deploy
-- pipeline runs db push without --accept-data-loss on purpose (see this
-- directory's README) — so without this file the deploy would abort at
-- that step. Safe: the column is nullable and Postgres never considers two
-- NULLs equal under a unique index, so every existing row (all NULL today)
-- coexists fine with each other and with future rows that set a real key.
-- Index name matches Prisma's own default naming convention for
-- `@@unique([tenantId, idempotencyKey])` exactly, confirmed locally, so a
-- later `prisma db push` sees no diff left to apply for this change.
ALTER TABLE "mcp_build_runs" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "mcp_build_runs_tenantId_idempotencyKey_key"
  ON "mcp_build_runs" ("tenantId", "idempotencyKey");
