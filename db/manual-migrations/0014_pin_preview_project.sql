ALTER TABLE "mcp_preview_sessions" ADD COLUMN IF NOT EXISTS "vercelProjectId" TEXT, ADD COLUMN IF NOT EXISTS "vercelTeamId" TEXT;
