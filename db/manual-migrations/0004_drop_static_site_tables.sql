-- 0004_drop_static_site_tables
--
-- Removes the single-file "AI Website Builder" (TenantStaticSite /
-- TenantStaticSiteVersion) at the user's explicit request — SaCMS no longer
-- offers an in-dashboard AI website generator; frontend development is done
-- in an IDE instead, connected to SaCMS via MCP (deploy_to_vercel and the
-- other developer-facing MCP tools).
--
-- Removed alongside this: the Developer Portal "AI Instant Website" page,
-- the /api/tenant/[tenant]/static-site/* routes, the public /site/[tenant]
-- route, the write_static_site MCP tool, lib/static-site-{render,generator,
-- versions}.ts, lib/mcp/mcp-client-bridge.ts, and the "site" custom-domain
-- target (white-label domain routing + proxy.ts).
--
-- The tables have zero runtime readers after this change, so dropping them
-- loses nothing in use.
--
-- Idempotent: safe to re-run on every deploy.

DROP TABLE IF EXISTS "tenant_static_site_versions" CASCADE;
DROP TABLE IF EXISTS "tenant_static_sites" CASCADE;
