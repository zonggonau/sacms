import { PrismaClient } from "@prisma/client"
import { db, getTenantDb } from "../src/lib/database"

/**
 * Scheduled Publishing Worker
 * This script should be run periodically (e.g., every minute) via Cron.
 */
async function processScheduledContent() {
  console.log(`[Worker] Checking scheduled content at ${new Date().toISOString()}...`)

  try {
    // 1. Get all tenants to check their specific databases if needed
    const tenants = await db.tenant.findMany({
      select: { id: true, slug: true, databaseUrl: true }
    })

    for (const tenant of tenants) {
      const tenantDb = await getTenantDb(tenant.slug)
      
      // 2. Find entries in SCHEDULED status where scheduledAt <= now
      const entriesToPublish = await tenantDb.contentEntry.findMany({
        where: {
          status: "SCHEDULED",
          scheduledAt: {
            lte: new Date()
          }
        },
        include: {
          contentType: true
        }
      })

      if (entriesToPublish.length > 0) {
        console.log(`[Worker] Found ${entriesToPublish.length} entries to publish for tenant: ${tenant.slug}`)
        
        for (const entry of entriesToPublish) {
          await tenantDb.contentEntry.update({
            where: { id: entry.id },
            data: {
              status: "PUBLISHED",
              publishedAt: new Date(),
              scheduledAt: null // Clear schedule
            }
          })
          
          console.log(`  ✅ Published entry: ${entry.id} (${entry.contentType.name})`)
          
          // Optional: Trigger Webhook for PUBLISH event here if needed
        }
      }
    }

  } catch (error) {
    console.error("[Worker Error]", error)
  } finally {
    // Note: In a real serverless env, we'd close connections, 
    // but here we might be using a persistent script.
  }
}

// Run the worker
processScheduledContent()
  .then(() => {
    console.log("[Worker] Finished processing.")
    process.exit(0)
  })
  .catch((err) => {
    console.error("[Worker Fatal]", err)
    process.exit(1)
  })
