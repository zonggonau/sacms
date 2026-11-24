CREATE TABLE IF NOT EXISTS "mcp_preview_sessions" (
  "id" TEXT PRIMARY KEY, "scope" TEXT NOT NULL, "targetId" TEXT NOT NULL,
  "target" TEXT NOT NULL, "sandbox" TEXT, "upstream" TEXT, "status" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0, "dirty" BOOLEAN NOT NULL DEFAULT FALSE,
  "sourceVersion" TEXT NOT NULL, "files" JSONB NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("scope", "targetId")
);
