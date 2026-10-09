import { db, getTenantDb } from "@/lib/database";

export interface ScheduledPublishOptions {
  dryRun?: boolean;
}

/**
 * Scheduled Publishing Worker
 * Periodically executed via cron or worker to publish content entries whose
 * `scheduledAt` timestamp is reached.
 */
export async function processScheduledContent(options: ScheduledPublishOptions = {}) {
  const now = new Date();
  console.log(`[Worker] Checking scheduled content at ${now.toISOString()}...`);

  let totalPublished = 0;
  let totalErrors = 0;

  try {
    const tenants = await db.tenant.findMany({
      where: { status: "active" },
      select: { id: true, slug: true, name: true, databaseUrl: true },
    });

    console.log(`[Worker] Evaluating ${tenants.length} active tenants.`);

    for (const tenant of tenants) {
      try {
        const tenantDb = await getTenantDb(tenant.slug);

        const entriesToPublish = await tenantDb.contentEntry.findMany({
          where: {
            status: "SCHEDULED",
            scheduledAt: {
              lte: now,
            },
          },
          include: {
            contentType: {
              select: { name: true, slug: true },
            },
          },
        });

        if (entriesToPublish.length > 0) {
          console.log(`[Worker] Tenant '${tenant.slug}': Found ${entriesToPublish.length} entries to publish.`);

          for (const entry of entriesToPublish) {
            if (options.dryRun) {
              console.log(`  [DRY RUN] Would publish entry: ${entry.id} (${entry.contentType.name})`);
            } else {
              await tenantDb.contentEntry.update({
                where: { id: entry.id },
                data: {
                  status: "PUBLISHED",
                  publishedAt: now,
                  scheduledAt: null,
                },
              });
              console.log(`  ✅ Published entry: ${entry.id} (${entry.contentType.name})`);
            }
            totalPublished++;
          }
        }
      } catch (tenantError) {
        totalErrors++;
        console.error(`[Worker Error] Failed evaluating tenant '${tenant.slug}':`, tenantError);
        // Continue to other tenants despite isolated tenant failure
      }
    }

    console.log(`[Worker] Finished processing. Total entries published: ${totalPublished}, tenant errors: ${totalErrors}`);
    return { totalPublished, totalErrors };
  } catch (error) {
    console.error("[Worker Fatal]", error);
    throw error;
  }
}

if (import.meta.main) {
  const isDryRun = process.argv.includes("--dry-run");
  processScheduledContent({ dryRun: isDryRun })
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Worker Fatal]", err);
      process.exit(1);
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
