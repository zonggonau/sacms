-- 0001_drop_tenant_roles
--
-- The TenantRole model and every route that touched it (api/tenant/[tenant]/roles/*,
-- api/admin/system-roles/*, actions/roles.ts) were removed in the RBAC
-- consolidation (commit 18c3696). The table has no runtime readers and only ever
-- held seeded system-role rows, so dropping it loses nothing in use.
--
-- Idempotent: safe to re-run on every deploy.

DROP TABLE IF EXISTS "tenant_roles" CASCADE;
