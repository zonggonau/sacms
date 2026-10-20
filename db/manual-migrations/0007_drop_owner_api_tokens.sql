-- 0007_drop_owner_api_tokens
--
-- The account-level "Owner MCP Server" feature (/dashboard/mcp,
-- /api/mcp/owner/[[...transport]]/route.ts, the OwnerApiToken model) was
-- removed at the user's explicit request: back to the original model where
-- every owner connects MCP from each workspace's own Developer > MCP page
-- (the per-tenant ApiToken with type "mcp"), not one account-wide credential
-- that could act across every workspace. The per-workspace MCP server, the
-- OpenAPI spec generator, and the AI Schema Generator all stay untouched.
--
-- The table has no remaining runtime readers after the code removal, so
-- dropping it loses nothing but the Owner MCP tokens themselves, which no
-- longer authenticate anything.
--
-- Idempotent: safe to re-run on every deploy.

DROP TABLE IF EXISTS "owner_api_tokens" CASCADE;
