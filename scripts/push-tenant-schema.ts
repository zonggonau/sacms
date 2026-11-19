/**
 * SaCMS — Dedicated Tenant Schema Push Entrypoint
 * Forwards to scripts/migrate/push-tenant-schema.ts
 */
import { runTenantSchemaPush } from "./migrate/push-tenant-schema"

await runTenantSchemaPush(process.argv.slice(2))
