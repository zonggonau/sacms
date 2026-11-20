import { parseArgs } from "node:util"
import { db, getTenantDb, Prisma } from "@/lib/database"

async function reconcileWebhooks() {
  const { values } = parseArgs({
    options: {
      tenant: { type: "string" },
      apply: { type: "boolean" },
      help: { type: "boolean" },
    },
  })
  if (values.help || !values.tenant) {
    console.log("Usage: bun scripts/migrate/reconcile-webhooks.ts --tenant WORKSPACE_ID_OR_SLUG [--apply]")
    if (!values.help) process.exitCode = 1
    return
  }

  const tenant = await db.tenant.findFirst({
    where: { OR: [{ id: values.tenant }, { slug: values.tenant }] },
    select: { id: true, slug: true },
  })
  if (!tenant) throw new Error("Workspace not found.")

  const dedicated = await getTenantDb(tenant.id)
  if (dedicated === db) {
    console.log("The workspace already uses the shared database.")
    return
  }

  const definitions = await dedicated.webhook.findMany({ where: { tenantId: tenant.id } })
  const existing = await db.webhook.findMany({
    where: { id: { in: definitions.map(webhook => webhook.id) } },
    select: { id: true },
  })
  const existingIds = new Set(existing.map(webhook => webhook.id))
  const missing = definitions.filter(webhook => !existingIds.has(webhook.id))
  console.log(`Dedicated webhook definitions: ${definitions.length}. Existing shared IDs: ${existing.length}. Missing: ${missing.length}.`)

  if (!values.apply || missing.length === 0) return
  const copied = await db.webhook.createMany({
    data: missing.map(webhook => ({
      id: webhook.id,
      tenantId: tenant.id,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events ?? Prisma.JsonNull,
      headers: webhook.headers ?? Prisma.DbNull,
      secret: webhook.secret,
      hookType: webhook.hookType,
      createdAt: webhook.createdAt,
      enabled: false,
    })),
    skipDuplicates: true,
  })
  console.log(`Copied ${copied.count} disabled webhook definitions for review. Original definitions and historical deliveries remain in the dedicated database.`)
}

try {
  await reconcileWebhooks()
} catch {
  console.error("Webhook reconciliation failed. Verify the workspace and database connections.")
  process.exitCode = 1
} finally {
  await db.$disconnect()
  // Dedicated clients are pooled and already have an unref'd cleanup timer.
}
