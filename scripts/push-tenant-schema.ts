import { execSync } from "child_process";
import { db } from "../src/lib/database";

async function main() {
  const tenantId = "cmnykawbq003huj2cui6wf50r";
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { databaseUrl: true, slug: true }
  });

  if (!tenant || !tenant.databaseUrl) {
    console.error("Tenant dedicated database not found.");
    return;
  }

  console.log(`Pushing schema to dedicated DB for tenant ${tenant.slug}...`);
  try {
    // Set DATABASE_URL environment variable for this command
    execSync(`npx prisma db push --accept-data-loss`, {
      env: { ...process.env, DATABASE_URL: tenant.databaseUrl },
      stdio: "inherit"
    });
    console.log("Schema push succeeded!");
  } catch (error) {
    console.error("Schema push failed:", error);
  }
}

main();
