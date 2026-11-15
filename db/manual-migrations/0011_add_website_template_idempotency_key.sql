-- WebsiteTemplate.idempotencyKey (chatgpt7.md P0: create_website_template
-- retry-safety — if a create response never arrives, retrying with the
-- SAME key must resolve to the SAME template instead of creating a
-- duplicate, and, when `schema` was given, a second orphaned backing
-- SchemaTemplate) + its unique index.
--
-- Landed here, ahead of `prisma db push`, because Prisma's own diff treats
-- ANY new unique constraint as a possible-data-loss change and the deploy
-- pipeline runs db push without --accept-data-loss on purpose (see this
-- directory's README) — so without this file the deploy would abort at
-- that step. Safe: the column is nullable and Postgres never considers two
-- NULLs equal under a unique index, so every existing row (all NULL today)
-- coexists fine with each other and with future rows that set a real key.
-- Index name matches Prisma's own default naming convention for a
-- single-field `@unique` exactly, confirmed locally, so a later
-- `prisma db push` sees no diff left to apply for this change.
ALTER TABLE "website_templates" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "website_templates_idempotencyKey_key"
  ON "website_templates" ("idempotencyKey");
