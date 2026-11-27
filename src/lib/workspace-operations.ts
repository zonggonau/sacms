import { db, getTenantDbById } from "@/lib/database"

const DAY_MS = 24 * 60 * 60 * 1000

export async function getWorkspaceMonitoring(tenantId: string, now = new Date()) {
  const start = new Date(now.getTime() - DAY_MS)
  const tenantDb = await getTenantDbById(tenantId)
  const content = { tenantId, deletedAt: null }
  const deliveries = { webhook: { tenantId }, createdAt: { gte: start } }

  const [api, webhookTotal, webhookSuccess, entries, createdEntries, publishedEntries] = await Promise.all([
    db.$queryRaw<{ total: number; errors: number; averageMs: number | null; p95Ms: number | null }[]>`
      SELECT COUNT(*)::int AS total,
             (COUNT(*) FILTER (WHERE "statusCode" >= 400))::int AS errors,
             AVG(duration)::float8 AS "averageMs",
             percentile_disc(0.95) WITHIN GROUP (ORDER BY duration) AS "p95Ms"
      FROM api_requests
      WHERE "tenantId" = ${tenantId} AND "createdAt" >= (${start}::timestamptz AT TIME ZONE 'UTC')
    `,
    db.webhookLog.aggregate({ where: deliveries, _count: { _all: true }, _avg: { duration: true } }),
    db.webhookLog.count({ where: { ...deliveries, success: true } }),
    tenantDb.contentEntry.count({ where: content }),
    tenantDb.contentEntry.count({ where: { ...content, createdAt: { gte: start } } }),
    tenantDb.contentEntry.count({ where: { ...content, publishedAt: { gte: start } } }),
  ])

  return {
    api: api[0],
    webhooks: {
      total: webhookTotal._count._all,
      success: webhookSuccess,
      averageMs: webhookTotal._avg.duration,
    },
    content: { entries, createdEntries, publishedEntries },
  }
}

export async function getWorkspaceJobs(tenantId: string) {
  const tenantDb = await getTenantDbById(tenantId)
  const scheduledWhere = { tenantId, status: "SCHEDULED" as const, deletedAt: null, scheduledAt: { not: null } }
  const retryWhere = { webhook: { tenantId }, status: { in: ["pending", "retrying", "exhausted"] } }
  const [scheduledTotal, scheduled, retryTotal, retries] = await Promise.all([
    tenantDb.contentEntry.count({ where: scheduledWhere }),
    tenantDb.contentEntry.findMany({
      where: scheduledWhere,
      select: { id: true, scheduledAt: true, contentType: { select: { name: true, slug: true } } },
      orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
      take: 20,
    }),
    db.webhookDeadLetter.count({ where: retryWhere }),
    db.webhookDeadLetter.findMany({
      where: retryWhere,
      select: {
        id: true, event: true, status: true, attempts: true, maxAttempts: true, nextRetryAt: true,
        webhook: { select: { name: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 20,
    }),
  ])
  return { scheduledTotal, scheduled, retryTotal, retries }
}
