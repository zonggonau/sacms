-- 0006_drop_ai_site_tables
--
-- The AI Site feature (in-dashboard, chat-driven AI website builder —
-- /developer/aisite, Vercel Sandbox live preview, Publish-to-production,
-- the AiSiteProject/AiSiteFile/AiSiteChat/AiSiteChatMessage models and
-- every src/lib/ai-site/* file) was removed entirely at the user's
-- explicit request: frontend development is meant to happen through an
-- IDE or an external AI agent (ChatGPT, Emergent, v0.app, etc.) connected
-- via SaCMS's MCP server(s) and REST/GraphQL API instead. The MCP servers
-- (tenant-level and owner-level), the OpenAPI spec generator, the AI
-- Schema Generator, and the deploy_to_sacms/deployTenantFrontend
-- infrastructure all stay — only the in-dashboard chat builder itself and
-- its storage are gone.
--
-- The tables have no remaining runtime readers after the code removal, so
-- dropping them loses nothing in use. Test projects created live while
-- building/debugging this feature earlier in the same session (2 projects,
-- 40 files, 2 chats, 10 messages at time of writing) are the only data
-- affected — disposable test data, not real customer content.
--
-- Idempotent: safe to re-run on every deploy.

DROP TABLE IF EXISTS "ai_site_chat_messages" CASCADE;
DROP TABLE IF EXISTS "ai_site_chats" CASCADE;
DROP TABLE IF EXISTS "ai_site_files" CASCADE;
DROP TABLE IF EXISTS "ai_site_projects" CASCADE;
