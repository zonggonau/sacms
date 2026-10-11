-- 0003_drop_site_builder_tables
--
-- Removes the abandoned multi-file "AI Website Builder" pipeline (Site,
-- SiteFile, SiteVersion, SiteDeployment, SiteConversation, SiteMessage —
-- chat-driven, framework: "nextjs", real Vercel deploy via webhook). It was
-- built as a more ambitious alternative to the single-file static-site
-- pipeline (TenantStaticSite + TenantStaticSiteVersion, served at
-- /site/[tenant] and edited in Developer Portal > AI Website Builder), but
-- no UI ever called its API routes (/api/tenant/[tenant]/sites/*) — the
-- team settled on the single-file pipeline instead, since it needs no real
-- build/execution step and previews safely in a sandboxed iframe.
--
-- The tables have zero runtime readers after removing src/app/api/tenant/
-- [tenant]/sites/*, src/app/api/webhooks/vercel/route.ts, and
-- src/lib/ai/{agent-orchestrator,website-generator,schema-engine,model-router}.ts
-- and src/lib/v0-client.ts, so dropping them loses nothing in use.
--
-- Idempotent: safe to re-run on every deploy.

DROP TABLE IF EXISTS "site_messages" CASCADE;
DROP TABLE IF EXISTS "site_conversations" CASCADE;
DROP TABLE IF EXISTS "site_deployments" CASCADE;
DROP TABLE IF EXISTS "site_versions" CASCADE;
DROP TABLE IF EXISTS "site_files" CASCADE;
DROP TABLE IF EXISTS "sites" CASCADE;
