import { afterAll, describe, expect, it } from "vitest"
import { db } from "@/lib/database"
import { withWorkspaceCreation } from "@/lib/workspace-creation-limit"
import { getWorkspaceJobs, getWorkspaceMonitoring } from "@/lib/workspace-operations"

const databaseUrl = process.env.DATABASE_URL && new URL(process.env.DATABASE_URL)
if (process.env.SACMS_WORKFLOW_CI !== "1" || !databaseUrl ||
    databaseUrl.hostname !== "127.0.0.1" || databaseUrl.pathname !== "/sacms_workflow_ci") {
  throw new Error("Run workspace dashboard tests with the disposable CI database.")
}

afterAll(() => db.$disconnect())

describe("workspace dashboard with PostgreSQL", () => {
  it("grants one Free workspace across concurrent creation requests", async () => {
    const owner = await db.user.create({ data: { email: "workspace-create-ci@example.test", plan: "free" } })
    const attempts = await Promise.all(["first", "second"].map((slug) =>
      withWorkspaceCreation(owner.id, "free", async (tx) => {
        const tenant = await tx.tenant.create({ data: { name: slug, slug: slug + "-claim-ci", plan: "free" } })
        await tx.tenantMember.create({ data: { tenantId: tenant.id, userId: owner.id, role: "owner" } })
        return tenant.id
      }),
    ))

    expect(attempts.filter((attempt) => attempt.ok)).toHaveLength(1)
    expect(await db.tenantMember.count({ where: { userId: owner.id, role: "owner" } })).toBe(1)
    expect(await db.user.findUnique({ where: { id: owner.id } })).toMatchObject({ freeWorkspaceUsed: true })
  })

  it("reads actual tenant-scoped request telemetry and scheduled entries", async () => {
    const first = await db.tenant.create({ data: { name: "Operations CI", slug: "operations-ci", useOwnerInfra: false } })
    const second = await db.tenant.create({ data: { name: "Other Operations CI", slug: "other-operations-ci", useOwnerInfra: false } })
    await db.apiRequest.createMany({ data: [
      { tenantId: first.id, endpoint: "/content", method: "GET", statusCode: 200, duration: 20 },
      { tenantId: first.id, endpoint: "/content", method: "GET", statusCode: 500, duration: 120 },
      { tenantId: second.id, endpoint: "/content", method: "GET", statusCode: 200, duration: 800 },
    ] })
    const type = await db.contentType.create({ data: { tenantId: first.id, name: "Test posts", slug: "test-posts" } })
    const scheduledAt = new Date(Date.now() + 3600_000)
    const entry = await db.contentEntry.create({
      data: { tenantId: first.id, contentTypeId: type.id, status: "SCHEDULED", scheduledAt, data: {} },
    })
    expect(await getWorkspaceMonitoring(first.id)).toMatchObject({
      api: { total: 2, errors: 1, averageMs: 70, p95Ms: 120 },
      webhooks: { total: 0, success: 0, averageMs: null },
      content: { entries: 1, createdEntries: 1, publishedEntries: 0 },
    })
    expect(await getWorkspaceJobs(first.id)).toMatchObject({
      scheduledTotal: 1, scheduled: [{ id: entry.id, scheduledAt }], retryTotal: 0, retries: [],
    })
    expect(await getWorkspaceJobs(second.id)).toMatchObject({ scheduledTotal: 0, scheduled: [] })
  })
})
