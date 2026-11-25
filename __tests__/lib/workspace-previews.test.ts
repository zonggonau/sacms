import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@vercel/sandbox", () => ({ Sandbox: {} }))
vi.mock("@/lib/vercel-client", () => ({ getVercelToken: vi.fn(), getVercelTeamId: vi.fn(), createTargetProject: vi.fn() }))
vi.mock("@/lib/infrastructure/frontend-env", () => ({ resolveApiOrigin: () => "https://cms.example" }))
vi.mock("@/lib/infrastructure/demo-tenant", () => ({ findSchemaDemoWorkspace: vi.fn() }))

const { db } = vi.hoisted(() => ({
  db: {
    websiteTemplate: { findMany: vi.fn() },
    schemaTemplate: { count: vi.fn() },
    mcpPreviewSession: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}))
vi.mock("@/lib/database", () => ({ db }))

import { listWorkspacePreviews } from "@/lib/infrastructure/workspace-previews"

const session = (over: Record<string, unknown>) => ({
  id: "0123456789abcdef", scope: "global", targetId: "wt-1", target: "ruang-bingkai", status: "ready", revision: 2, dirty: false,
  sourceVersion: "v1", files: [], expiresAt: new Date(Date.now() + 10 * 60_000), sandbox: "box", upstream: "https://up", vercelProjectId: "p", vercelTeamId: "t",
  ...over,
})

describe("listWorkspacePreviews", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NEXTAUTH_SECRET", "preview-test")
  })

  it("lists every catalog template on a demo workspace with its live preview link and demo URL", async () => {
    db.websiteTemplate.findMany.mockResolvedValue([
      { id: "wt-1", name: "Ruang Bingkai", slug: "ruang-bingkai", demoUrl: "https://demo-a.sites.sacms.cloud" },
      { id: "wt-2", name: "Kedua", slug: "kedua", demoUrl: null },
    ])
    db.mcpPreviewSession.findMany.mockResolvedValue([session({})])

    const result = await listWorkspacePreviews("demo-tenant", "demo-ruang-bingkai")

    expect(result.isDemoWorkspace).toBe(true)
    expect(db.mcpPreviewSession.findMany).toHaveBeenCalledWith({ where: { scope: "global", targetId: { in: ["wt-1", "wt-2"] } } })
    expect(result.previews[0]).toMatchObject({ label: "Ruang Bingkai", demoUrl: "https://demo-a.sites.sacms.cloud",
      session: { status: "ready", previewUrl: "https://0123456789abcdef.preview.sacms.cloud", revision: 2 } })
    expect(result.previews[0].session.accessUrl).toMatch(/^https:\/\/0123456789abcdef\.preview\.sacms\.cloud\/\?preview_access=[0-9a-f]{64}$/)
    expect(result.previews[1].session).toMatchObject({ status: "inactive", previewUrl: null, accessUrl: null })
  })

  it("treats a workspace as a demo even before any Website Template exists on it", async () => {
    db.websiteTemplate.findMany.mockResolvedValue([])
    db.schemaTemplate.count.mockResolvedValue(1)
    db.mcpPreviewSession.findMany.mockResolvedValue([])
    expect(await listWorkspacePreviews("demo-tenant", "demo-x")).toEqual({ isDemoWorkspace: true, previews: [] })
  })

  it("shows a client workspace's own site preview, including an expired session that still has unsaved edits", async () => {
    db.websiteTemplate.findMany.mockResolvedValue([])
    db.schemaTemplate.count.mockResolvedValue(0)
    db.mcpPreviewSession.findUnique.mockResolvedValue(session({ scope: "workspace", targetId: "client", dirty: true, expiresAt: new Date(Date.now() - 1000) }))

    const result = await listWorkspacePreviews("client", "acme")

    expect(result.isDemoWorkspace).toBe(false)
    expect(db.mcpPreviewSession.findUnique).toHaveBeenCalledWith({ where: { scope_targetId: { scope: "workspace", targetId: "client" } } })
    expect(result.previews).toHaveLength(1)
    expect(result.previews[0].session).toMatchObject({ status: "expired", hasUnsavedChanges: true, accessUrl: null })
  })

  it("hides a stopped client session instead of reporting a dead link", async () => {
    db.websiteTemplate.findMany.mockResolvedValue([])
    db.schemaTemplate.count.mockResolvedValue(0)
    db.mcpPreviewSession.findUnique.mockResolvedValue(session({ scope: "workspace", status: "stopped" }))
    expect((await listWorkspacePreviews("client", "acme")).previews[0].session.status).toBe("inactive")
  })
})
