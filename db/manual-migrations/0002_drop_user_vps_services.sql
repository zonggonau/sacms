-- 0002_drop_user_vps_services
--
-- The entire "bring your own VPS" feature was removed from SaCMS at the
-- user's explicit request: every workspace now uses SaCMS's own managed
-- infrastructure (ManagedInfraService / BYODB for dedicated database, and
-- StorageAddon for storage upgrades) instead of ordering/connecting a
-- separate customer-owned VPS. This removed the UserVpsService model, the
-- Contabo provisioning integration (lib/contabo.ts), the VPS catalog/order
-- actions (actions/vps-service.ts), the "Cloud Server" catalog page
-- (dashboard/services), the VPS lifecycle UI in the per-workspace
-- Infrastructure > Database & Storage tab, and every VPS/VDS plan slug and
-- pricing table across billing/checkout/plan-enforcement code.
--
-- The table has no remaining runtime readers after this change, so dropping
-- it loses nothing in use.
--
-- Idempotent: safe to re-run on every deploy.

DROP TABLE IF EXISTS "user_vps_services" CASCADE;
