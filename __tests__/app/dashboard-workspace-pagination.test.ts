import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("next/navigation", () => ({ redirect: vi.fn((to: string) => { throw new Error(`REDIRECT ${to}`) }) }))
vi.mock("@/components/dashboard/workspace-manager", () => ({ WorkspaceManager: () => null }))
vi.mock("@/lib/settings", () => ({ getGlobalWorkspaceId: vi.fn(async () => "sacms-global") }))
vi.mock("@/lib/license", () => ({ INSTANCE_LICENSE_ID: "globalId", isEnterpriseTenant: vi.fn(async () => false) }))
vi.mock("@/lib/tenant-plan", () => ({ getUserPlanConfig: vi.fn() }))
vi.mock("@/lib/plan-enforcement", () => ({
  enforceUserPlanLimit: vi.fn(async () => ({ max: 20, planSlug: "pro" })),
  getStorageQuota: vi.fn(async () => ({ usedBytes: 0, limitBytes: 0 })),
  validateWorkspacePlanBinding: vi.fn(async () => ({ allowed: true })),
}))
vi.mock("@/lib/pricing", () => ({ getWorkspacePlans: vi.fn(async () => []), getAddons: vi.fn(async () => []) }))

const { db, rows } = vi.hoisted(() => {
  const rows: any[] = []
  const db = {
    tenant: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(async () => null),
    },
    tenantMember: { count: vi.fn(async () => 0) },
  }
  return { db, rows }
})
vi.mock("@/lib/database", () => ({ db }))

import { getServerSession } from "next-auth"
import WorkspaceSelectionPage from "@/app/(workspace)/dashboard/(global)/page"

const DAY = 86_400_000
const workspace = (i: number, over: Record<string, unknown> = {}) => ({
  id: `t${i}`, name: `Workspace ${i}`, slug: `ws-${i}`, status: "active", plan: "pro",
  createdAt: new Date(Date.UTC(2026, 0, 1) + i * DAY), members: [{ role: "owner" }],
  subscriptions: [{ status: "active", currentPeriodEnd: new Date(Date.now() + 30 * DAY) }],
  ...over,
})

// Mirrors Prisma: the lightweight summary query has `select`, the page query has `skip`/`take`.
function wire(all: any[]) {
  db.tenant.count.mockImplementation(async ({ where }: any) => (where?.AND ? all.filter(t => matchesSearch(t, where)).length : all.length))
  db.tenant.findMany.mockImplementation(async (args: any) => {
    if (args.select) return all.map(t => ({ id: t.id, slug: t.slug, status: t.status, plan: t.plan, subscriptions: t.subscriptions }))
    const filtered = args.where?.AND ? all.filter(t => matchesSearch(t, args.where)) : all
    return filtered.slice(args.skip, args.skip + args.take)
  })
}
function matchesSearch(t: any, where: any) {
  if (!where?.AND) return true
  const needle = where.AND[1].OR[0].name.contains.toLowerCase()
  return t.name.toLowerCase().includes(needle) || t.slug.toLowerCase().includes(needle)
}

const run = (query: { page?: string; q?: string } = {}) =>
  WorkspaceSelectionPage({ searchParams: Promise.resolve(query) } as any) as Promise<any>

beforeEach(() => {
  vi.clearAllMocks()
  rows.length = 0
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "user" } } as any)
})

describe("dashboard workspace pagination", () => {
  it("returns only the requested 20-workspace page", async () => {
    const all = Array.from({ length: 45 }, (_, i) => workspace(i))
    wire(all)
    const el = await run({ page: "2" })
    expect(el.props.pagination).toMatchObject({ page: 2, pageCount: 3, total: 45, pageSize: 20, q: "" })
    expect(db.tenant.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20 }))
    expect(el.props.initialTenants).toHaveLength(20)
    expect(el.props.usage.current).toBe(45)
  })

  it("clamps a page past the end to the last page instead of an empty list", async () => {
    wire(Array.from({ length: 45 }, (_, i) => workspace(i)))
    const el = await run({ page: "99" })
    expect(el.props.pagination.page).toBe(3)
    expect(db.tenant.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40, take: 20 }))
    expect(el.props.initialTenants).toHaveLength(5)
  })

  it("computes summary counts over every workspace, not only the current page", async () => {
    const all = [
      ...Array.from({ length: 25 }, (_, i) => workspace(i)),
      ...Array.from({ length: 3 }, (_, i) => workspace(100 + i, { subscriptions: [{ status: "active", currentPeriodEnd: new Date(Date.now() - 5 * DAY) }] })),
      workspace(200, { status: "suspended" }),
      workspace(201, { subscriptions: [{ status: "active", currentPeriodEnd: new Date(Date.now() + 2 * DAY) }] }),
    ]
    wire(all)
    const el = await run({ page: "1" })
    // 25 + the 2-days-left one are active; 3 expired + 1 suspended are not
    expect(el.props.summary).toEqual({ total: 30, active: 26, expired: 4, expiringSoon: 1, suspended: 4 })
  })

  it("applies the search server-side so it covers every page", async () => {
    wire([...Array.from({ length: 30 }, (_, i) => workspace(i)), workspace(90, { name: "Bingkai Studio", slug: "bingkai" })])
    const el = await run({ q: "bingkai" })
    expect(el.props.pagination).toMatchObject({ q: "bingkai", total: 1, page: 1, pageCount: 1 })
    expect(el.props.initialTenants.map((t: any) => t.slug)).toEqual(["bingkai"])
    expect(db.tenant.count).toHaveBeenCalledWith({ where: expect.objectContaining({ AND: expect.any(Array) }) })
  })

  it("keeps the summary independent of the search", async () => {
    wire([...Array.from({ length: 30 }, (_, i) => workspace(i)), workspace(90, { name: "Bingkai", slug: "bingkai" })])
    const el = await run({ q: "bingkai" })
    expect(el.props.summary.total).toBe(31)
  })

  it("still redirects a lone non-admin member straight into their workspace", async () => {
    wire([workspace(1, { slug: "toko-budi" })])
    await expect(run()).rejects.toThrow("REDIRECT /dashboard/toko-budi/cms")
  })
})
