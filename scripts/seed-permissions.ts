/**
 * SaCMS — Permissions Seeder Entrypoint
 * Forwards to scripts/seed/seed-permissions.ts
 */
import { seedPermissions } from "./seed/seed-permissions";

seedPermissions()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
