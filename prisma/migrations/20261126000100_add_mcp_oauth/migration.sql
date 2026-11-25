-- OAuth 2.1 for the per-workspace MCP server (see docs/mcp/oauth.md).
-- The oauth_* tables were scaffolded earlier but never written to (verified empty
-- on production 2026-11-26), so reshaping them here loses no data.

-- Authorization codes remember who approved them.
ALTER TABLE "oauth_codes" ADD COLUMN "userId" TEXT NOT NULL;

-- Refresh tokens only. Access tokens are ordinary `mcp` api_tokens rows; no
-- plaintext token is stored in this table.
DROP TABLE "oauth_tokens";

CREATE TABLE "oauth_tokens" (
    "id" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessTokenId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_tokens_refreshTokenHash_key" ON "oauth_tokens"("refreshTokenHash");
CREATE INDEX "oauth_tokens_tenantId_idx" ON "oauth_tokens"("tenantId");

ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
