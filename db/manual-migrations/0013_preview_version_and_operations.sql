ALTER TABLE "website_templates" ADD COLUMN IF NOT EXISTS "demoSourceVersion" TIMESTAMP(3);
ALTER TABLE "global_mcp_operations" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "mcp_deployment_sources" ADD COLUMN IF NOT EXISTS "schemaSnapshot" JSONB;
