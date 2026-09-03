import { describe, it, expect, vi, beforeEach } from "vitest"
import { z } from "zod"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))
vi.mock("@/lib/plan-enforcement", () => ({ enforcePlanLimit: vi.fn() }))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))

import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { enforcePlanLimit } from "@/lib/plan-enforcement"
import { apiError, readJson, withStaffAuth, withAdminAuth } from "@/lib/api/route-helpers"

const mockSession = vi.mocked(getServerSession)
const mockAccess = vi.mocked(getTenantAccess)
const mockPlan = vi.mocked(enforcePlanLimit)

function req(body?: unknown, method = "POST") {
  return new Request("https://api.test/api/tenant/acme/things", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}),
  }) as any
}
const ctx = (params: Record<string, string> = { tenant: "acme" }) => ({ params: Promise.resolve(params) })

beforeEach(() => vi.clearAllMocks())

describe("apiError", () => {
  it("uses the default status + message for a code", async () => {
    const res = apiError("forbidden")
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toEqual({ error: "You do not have permission to do that", code: "forbidden" })
  })
  it("carries an override message and details", async () => {
    const res = apiError("validation", { message: "bad slug", details: { slug: ["required"] } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "bad slug", code: "validation", details: { slug: ["required"] } })
  })
})

describe("readJson", () => {
  const Schema = z.object({ name: z.string().min(2) })
  it("returns parsed data on a valid body", async () => {
    const r = await readJson(req({ name: "ok" }), Schema)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.name).toBe("ok")
  })
  it("returns a 400 with field errors on an invalid body", async () => {
    const r = await readJson(req({ name: "x" }), Schema)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.response.status).toBe(400)
      const body = await r.response.json()
      expect(body.code).toBe("validation")
      expect(body.details.name).toBeDefined()
    }
  })
  it("returns a 400 on non-JSON", async () => {
    const bad = new Request("https://api.test/x", { method: "POST", body: "not json" }) as any
    const r = await readJson(bad, Schema)
    expect(r.ok).toBe(false)
  })
})

describe("withStaffAuth", () => {
  const handler = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }) as any)

  it("401s without a session", async () => {
    mockSession.mockResolvedValue(null as any)
    const res = await withStaffAuth(handler)(req(), ctx())
    expect(res.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it("403s when the user has no tenant access", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1", role: "owner" } } as any)
    mockAccess.mockResolvedValue(null)
    const res = await withStaffAuth(handler)(req(), ctx())
    expect(res.status).toBe(403)
  })

  it("403s when the role is below minRole", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } } as any)
    mockAccess.mockResolvedValue({ tenantId: "t1", userId: "u1", role: "viewer", isGlobal: false, tenant: {} } as any)
    const res = await withStaffAuth(handler, { minRole: "editor" })(req(), ctx())
    expect(res.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it("passes an owner through an admin minRole gate", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } } as any)
    mockAccess.mockResolvedValue({ tenantId: "t1", userId: "u1", role: "owner", isGlobal: false, tenant: {} } as any)
    const res = await withStaffAuth(handler, { minRole: "admin" })(req(), ctx())
    expect(res.status).toBe(200)
    expect(handler).toHaveBeenCalledOnce()
  })

  it("enforces the plan limit on POST and returns 402", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } } as any)
    mockAccess.mockResolvedValue({ tenantId: "t1", userId: "u1", role: "admin", isGlobal: false, tenant: {} } as any)
    mockPlan.mockResolvedValue({ allowed: false, message: "cap reached", current: 10, max: 10, planSlug: "free" } as any)
    const res = await withStaffAuth(handler, { planResource: "content_entries" as any })(req({}), ctx())
    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.code).toBe("plan_limit")
  })

  it("routes a thrown error to a generic 500", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1" } } as any)
    mockAccess.mockResolvedValue({ tenantId: "t1", userId: "u1", role: "admin", isGlobal: false, tenant: {} } as any)
    const boom = withStaffAuth(async () => {
      throw new Error("db exploded: postgres://secret@host")
    })
    const res = await boom(req(), ctx())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toEqual({ error: "Something went wrong on our end", code: "internal" })
    expect(JSON.stringify(body)).not.toContain("postgres")
  })
})

describe("withAdminAuth", () => {
  const handler = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }) as any)

  it("403s a non-super-admin", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1", role: "owner" } } as any)
    const res = await withAdminAuth(handler)(req(), ctx({}))
    expect(res.status).toBe(403)
  })

  it("passes a super_admin", async () => {
    mockSession.mockResolvedValue({ user: { id: "u1", role: "super_admin" } } as any)
    const res = await withAdminAuth(handler)(req(), ctx({}))
    expect(res.status).toBe(200)
  })
})
