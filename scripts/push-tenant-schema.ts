/**
 * SaCMS — Dedicated Tenant Schema Push Entrypoint
 * Forwards to scripts/migrate/push-tenant-schema.ts
 */
import { pushTenantSchema } from "./migrate/push-tenant-schema";

const target = process.argv[2];
pushTenantSchema(target).catch((e) => {
  console.error(e);
  process.exit(1);
});
