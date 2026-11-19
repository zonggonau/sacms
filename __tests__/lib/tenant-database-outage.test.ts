import { describe, expect, it, vi } from "vitest"

const fixtures = vi.hoisted(() => ({
  master: {
    tenant: { findFirst: vi.fn(), findUnique: vi.fn() },
    tenantMember: { findFirst: vi.fn() },
    contentEntry: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  query: vi.fn(),
  transaction: vi.fn(),
}))

vi.unmock("@/lib/database")
vi.mock("../../prisma/generated-client", () => ({
  Prisma: {},
  PrismaClient: class {
    constructor(options: { datasources?: { db: { url: string } } }) {
      if (!options.datasources) Object.assign(this, fixtures.master)
    }
    $extends({ query }: {
      query: { $allOperations: (input: { args: unknown; query: typeof fixtures.query }) => Promise<unknown> }
    }) {
      return {
        contentEntry: { create: (args: unknown) => query.$allOperations({ args, query: fixtures.query }) },
        $transaction: fixtures.transaction,
        $disconnect: vi.fn().mockResolvedValue(undefined),
      }
    }
  },
}))

import { db, getTenantDb, getTenantDbById } from "@/lib/database"
import { TenantDatabaseUnavailableError } from "@/lib/tenant-database-error"

describe("workspace data database routing", () => {
  it("stops dedicated writes and transaction failures before the shared database, even during cooldown", async () => {
    const workspace = { id: "dedicated-1", slug: "dedicated", databaseUrl: "postgresql://test@localhost:5432/workspace_one" }
    fixtures.master.tenant.findFirst.mockResolvedValue(workspace)
    fixtures.master.tenant.findUnique.mockResolvedValue(workspace)
    fixtures.query.mockRejectedValueOnce(Object.assign(new Error("connection timed out"), { code: "P1002" }))
    fixtures.transaction.mockRejectedValueOnce(Object.assign(new Error("connection lost"), { code: "P1017" }))

    const client = await getTenantDb(workspace.slug)
    await expect(client.contentEntry.create({ data: {} as never })).rejects.toBeInstanceOf(TenantDatabaseUnavailableError)
    await expect(getTenantDbById(workspace.id)).rejects.toBeInstanceOf(TenantDatabaseUnavailableError)
    await expect(client.$transaction(async () => null)).rejects.toBeInstanceOf(TenantDatabaseUnavailableError)
    expect(fixtures.master.contentEntry.create).not.toHaveBeenCalled()
    expect(fixtures.master.$transaction).not.toHaveBeenCalled()

    fixtures.master.tenant.findFirst.mockResolvedValue({
      id: "dedicated-2", slug: "other", databaseUrl: "postgresql://test@localhost:5432/workspace_two",
    })
    await expect(getTenantDb("other")).resolves.not.toBe(db)
  })

  it("fails closed when the owner's routing metadata could not be determined", async () => {
    fixtures.master.tenant.findFirst.mockResolvedValue({ id: "owner-db", slug: "owner-db", databaseUrl: null })
    fixtures.master.tenant.findUnique.mockResolvedValue({ useOwnerInfra: true })
    fixtures.master.tenantMember.findFirst.mockRejectedValueOnce(new Error("metadata database unavailable"))

    await expect(getTenantDb("owner-db")).rejects.toBeInstanceOf(TenantDatabaseUnavailableError)
    fixtures.master.tenant.findUnique.mockResolvedValue({ useOwnerInfra: false })
    await expect(getTenantDb("owner-db")).resolves.toBe(db)
  })
})
