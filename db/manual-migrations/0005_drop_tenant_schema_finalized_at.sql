-- 0005_drop_tenant_schema_finalized_at
--
-- The CMS schema finalization gate (draft/final toggle on `tenants
-- .schemaFinalizedAt`, blocking schema edits while final and requiring final
-- before AI Site would generate anything) was removed entirely at the user's
-- explicit request: using it in practice produced worse AI Site results than
-- a plain free-form prompt — the schema-derived auto-prompt it fed into AI
-- Site was a dense field-by-field dump, not a design brief, which pushed the
-- agent toward mechanically mapping data instead of designing a good page.
-- See src/lib/ai-site/prompt.ts and the removed src/lib/schema-lock.ts /
-- src/lib/ai-site/schema-prompt.ts for the code-side removal.
--
-- The column has no remaining runtime readers after this change, so
-- dropping it loses nothing in use (the two tenants that had finalized their
-- schema simply lose a now-meaningless timestamp, not any real data).
--
-- Idempotent: safe to re-run on every deploy.

ALTER TABLE "tenants" DROP COLUMN IF EXISTS "schemaFinalizedAt";
