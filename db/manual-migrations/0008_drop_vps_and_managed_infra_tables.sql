-- 0008_drop_vps_and_managed_infra_tables
--
-- Removed at the user's explicit request: "fitur vps dan BYODB kita hapus
-- total. semua menggunakan sacms. untuk lisensi enterprise tetap
-- menggunakan postgresql sacms tapi buatkan database sendiri untuk
-- lisensi" — every tenant now uses SaCMS's own shared database/storage,
-- with no VPS product, no self-service BYODB/BYOS connect form, and no
-- paid "Database & Storage Sendiri" managed-infra product. The ONE thing
-- that stays is the pre-existing Enterprise dedicated-database feature
-- (one SaCMS-hosted Postgres database auto-provisioned per Enterprise
-- License on activation, shared by every workspace that account owns —
-- see src/app/api/user/license/activate/route.ts and
-- getOwnerMasterInfra() in src/lib/database.ts, both untouched by this
-- removal).
--
-- VpsOffering/VpsInstance: the Biznet Gio NEO Lite VPS-selling feature
-- (built, shipped, and removed again within the same session) — the
-- product catalog, purchased instances, Biznet Gio API client, and the
-- SSH-based PostgreSQL+MinIO auto-installer were all deleted. Zero
-- runtime readers left after the code removal.
--
-- ManagedInfraService/ManagedInfraPayment: the paid "Database & Storage
-- Sendiri" product (SaCMS IT manually provisions and connects a
-- customer's own server) and the self-service BYODB/BYOS connect forms
-- (account-level /dashboard/infrastructure and the workspace Console
-- tab) were all deleted. Zero runtime readers left after the code
-- removal. `tenant.databaseUrl`/`storageConfig` columns themselves stay
-- (kept for backward compatibility with any historical row, and the
-- routing code already treats them as an optional override), only these
-- two service-tracking tables are dropped.
--
-- Idempotent: safe to re-run on every deploy.

DROP TABLE IF EXISTS "vps_instances" CASCADE;
DROP TABLE IF EXISTS "vps_offerings" CASCADE;
DROP TABLE IF EXISTS "managed_infra_payments" CASCADE;
DROP TABLE IF EXISTS "managed_infra_services" CASCADE;
