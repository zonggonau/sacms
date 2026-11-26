import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))
vi.mock("@/lib/schema-lock", () => ({ assertSchemaEditable: vi.fn().mockResolvedValue(null) }))
vi.mock("@/lib/schema-template-sync", () => ({
  materializeSchemaIntoTenant: vi.fn().mockResolvedValue({ imported: 1 }),
}))
vi.mock("@/lib/database", () => ({
  getTenantDb: vi.fn(),
}))

import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { getTenantDb } from "@/lib/database"
import { materializeSchemaIntoTenant } from "@/lib/schema-template-sync"
import { POST } from "@/app/api/tenant/[tenant]/ai-builder/import-schema/route"

const mockSession = vi.mocked(getServerSession)
const mockAccess = vi.mocked(getTenantAccess)
const mockGetTenantDb = vi.mocked(getTenantDb)
const ctx = (tenant: string) => ({ params: Promise.resolve({ tenant }) })
const jsonReq = (body: unknown) =>
  new Request("https://api.test/x", { method: "POST", body: JSON.stringify(body) }) as any

// Per-test database stub: existing rows live in this workspace before the save.
const tenantDb = {
  contentType: { findFirst: vi.fn(), findMany: vi.fn() },
  singleType: { findFirst: vi.fn(), findMany: vi.fn() },
  component: { findFirst: vi.fn(), findMany: vi.fn() },
}

describe("POST /api/tenant/[tenant]/ai-builder/import-schema", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tenantDb.contentType.findMany.mockResolvedValue([])
    tenantDb.singleType.findMany.mockResolvedValue([])
    tenantDb.component.findMany.mockResolvedValue([])
    mockGetTenantDb.mockResolvedValue(tenantDb as any)
    mockSession.mockResolvedValue({ user: { id: "user1" } } as any)
    mockAccess.mockResolvedValue({
      role: "admin",
      tenantId: "tenant1",
      userId: "user1",
      tenant: { id: "tenant1", slug: "tenant1" },
    } as any)
  })

  it("accepts a document_template field whose slug is a verbatim snake_case placeholder key", async () => {
    // Regression: generateSystemSchema's restoreVerbatimPlaceholderSlugs
    // deliberately restores a document_template Content Type's field slugs
    // to the exact (snake_case) {placeholder} keys from an uploaded .docx,
    // so the later merge can match them exactly. This route used to reject
    // every such AI-generated plan on save with a 400, even though the plan
    // previewed fine, because it validated FIELD slugs against the same
    // kebab-only regex meant for MODEL (URL-facing) slugs.
    const res = await POST(
      jsonReq({
        schema: {
          contentTypes: [
            {
              name: "Surat Keterangan",
              slug: "surat-keterangan",
              fields: [
                { name: "Nama Lengkap", slug: "nama_lengkap", type: "text" },
                { name: "Template", slug: "template", type: "document_template" },
              ],
            },
          ],
          singleTypes: [],
          components: [],
        },
      }),
      ctx("tenant1"),
    )

    expect(res.status).toBe(200)
    expect(materializeSchemaIntoTenant).toHaveBeenCalled()
  })

  it("still rejects a field slug with invalid characters", async () => {
    const res = await POST(
      jsonReq({
        schema: {
          contentTypes: [{ name: "X", slug: "x", fields: [{ name: "Bad", slug: "Bad Slug!", type: "text" }] }],
          singleTypes: [],
          components: [],
        },
      }),
      ctx("tenant1"),
    )
    expect(res.status).toBe(400)
  })

  it("still rejects a MODEL-level slug containing underscores (URL-facing, must stay kebab-case)", async () => {
    const res = await POST(
      jsonReq({
        schema: {
          contentTypes: [{ name: "X", slug: "bad_model_slug", fields: [] }],
          singleTypes: [],
          components: [],
        },
      }),
      ctx("tenant1"),
    )
    expect(res.status).toBe(400)
  })

  it("rejects an empty schema", async () => {
    const res = await POST(
      jsonReq({ schema: { contentTypes: [], singleTypes: [], components: [] } }),
      ctx("tenant1"),
    )
    expect(res.status).toBe(400)
  })

  describe("reference checks before save", () => {
    const field = (over: Record<string, unknown>) => ({ name: "F", slug: "f", type: "text", ...over })
    const ct = (fields: unknown[]) => ({ name: "Menu", slug: "menu", fields })

    it("blocks a select saved with no choices and does not materialize", async () => {
      const res = await POST(
        jsonReq({ schema: { contentTypes: [ct([field({ type: "select" })])], singleTypes: [], components: [] } }),
        ctx("tenant1"),
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(JSON.stringify(body.details.issues)).toContain("options.choices")
      expect(materializeSchemaIntoTenant).not.toHaveBeenCalled()
    })

    it("blocks a relation to a slug that exists nowhere", async () => {
      const res = await POST(
        jsonReq({ schema: { contentTypes: [ct([field({ type: "relation", relationSlug: "ghost" })])], singleTypes: [], components: [] } }),
        ctx("tenant1"),
      )
      expect(res.status).toBe(400)
      expect(materializeSchemaIntoTenant).not.toHaveBeenCalled()
    })

    it("accepts a relation to a content type already in the workspace", async () => {
      tenantDb.contentType.findMany.mockResolvedValueOnce([{ slug: "authors" }])
      const res = await POST(
        jsonReq({ schema: { contentTypes: [ct([field({ type: "relation", relationSlug: "authors", options: { relationType: "manyToOne" } })])], singleTypes: [], components: [] } }),
        ctx("tenant1"),
      )
      expect(res.status).toBe(200)
      expect(materializeSchemaIntoTenant).toHaveBeenCalled()
    })

    it("accepts a member relation without a content-type target", async () => {
      const res = await POST(
        jsonReq({ schema: { contentTypes: [ct([field({ type: "relation", options: { targetModel: "member", relationType: "manyToOne" } })])], singleTypes: [], components: [] } }),
        ctx("tenant1"),
      )
      expect(res.status).toBe(200)
    })

    it("blocks a component field that names a component not in the bundle", async () => {
      const res = await POST(
        jsonReq({ schema: { contentTypes: [], singleTypes: [{ name: "Home", slug: "homepage", fields: [field({ type: "component", componentSlug: "hero" })] }], components: [] } }),
        ctx("tenant1"),
      )
      expect(res.status).toBe(400)
    })

    it("accepts a complete select", async () => {
      const res = await POST(
        jsonReq({ schema: { contentTypes: [ct([field({ type: "select", options: { choices: [{ label: "Ya", value: "ya" }, { label: "Tidak", value: "tidak" }] } })])], singleTypes: [], components: [] } }),
        ctx("tenant1"),
      )
      expect(res.status).toBe(200)
      expect(materializeSchemaIntoTenant).toHaveBeenCalled()
    })
  })
})
