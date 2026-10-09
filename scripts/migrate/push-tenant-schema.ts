import { execSync } from "child_process";
import { db } from "@/lib/database";

export interface PushSchemaOptions {
  acceptDataLoss?: boolean;
}

/**
 * Push Prisma schema to dedicated tenant database.
 * Supports:
 *   - bun scripts/migrate/push-tenant-schema.ts [tenantSlugOrId]
 *   - bun scripts/migrate/push-tenant-schema.ts --all
 */
export async function pushTenantSchema(tenantIdentifier?: string, options: PushSchemaOptions = { acceptDataLoss: true }) {
  try {
    if (tenantIdentifier === "--all") {
      const tenants = await db.tenant.findMany({
        where: { databaseUrl: { not: null } },
        select: { id: true, slug: true, name: true, databaseUrl: true },
      });

      if (tenants.length === 0) {
        console.log("ℹ️ No tenants configured with dedicated database.");
        return;
      }

      console.log(`🚀 Found ${tenants.length} tenants with dedicated database. Pushing schemas...`);
      for (const t of tenants) {
        await pushToSingleTenant(t.slug, t.databaseUrl!, options);
      }
      return;
    }

    let tenant = null;

    if (tenantIdentifier) {
      tenant = await db.tenant.findFirst({
        where: {
          OR: [{ id: tenantIdentifier }, { slug: tenantIdentifier }],
        },
        select: { id: true, slug: true, name: true, databaseUrl: true },
      });

      if (!tenant) {
        console.error(`❌ Tenant '${tenantIdentifier}' not found.`);
        process.exitCode = 1;
        return;
      }
    } else {
      // Find the first tenant with a dedicated databaseUrl
      const dedicatedTenants = await db.tenant.findMany({
        where: { databaseUrl: { not: null } },
        select: { id: true, slug: true, name: true, databaseUrl: true },
      });

      if (dedicatedTenants.length === 0) {
        console.log("ℹ️ No dedicated tenant databases found in the system.");
        console.log("👉 Shared multi-tenant instances use the master database via `bun run db:push`.");
        return;
      }

      if (dedicatedTenants.length === 1) {
        tenant = dedicatedTenants[0];
        console.log(`ℹ️ Auto-selected dedicated tenant: ${tenant.name} (${tenant.slug})`);
      } else {
        console.log("⚠️ Multiple tenants have dedicated databases. Please specify one:");
        for (const t of dedicatedTenants) {
          console.log(`  - ${t.slug} (${t.name})`);
        }
        console.log("\nUsage: bun scripts/migrate/push-tenant-schema.ts <slug|id> OR --all");
        return;
      }
    }

    if (!tenant.databaseUrl) {
      console.warn(`⚠️ Tenant '${tenant.slug}' does not have a dedicated databaseUrl configured.`);
      return;
    }

    await pushToSingleTenant(tenant.slug, tenant.databaseUrl, options);
  } catch (error) {
    console.error("❌ Schema push execution failed:", error);
    process.exitCode = 1;
  }
}

async function pushToSingleTenant(slug: string, databaseUrl: string, options: PushSchemaOptions) {
  console.log(`\n⏳ Pushing schema to dedicated DB for tenant '${slug}'...`);
  const dataLossFlag = options.acceptDataLoss ? "--accept-data-loss" : "";

  try {
    // Uses Bun's bunx instead of npm/npx according to project guidelines
    execSync(`bunx prisma db push ${dataLossFlag}`, {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
    });
    console.log(`✅ Schema push succeeded for tenant '${slug}'!`);
  } catch (error) {
    console.error(`❌ Schema push failed for tenant '${slug}':`, error);
    throw error;
  }
}

// Execute when run as CLI
if (import.meta.main) {
  const target = process.argv[2];
  pushTenantSchema(target)
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
