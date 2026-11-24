import { expect, it, vi } from "vitest"

vi.mock("@/lib/infrastructure/preview-access", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/infrastructure/preview-access")>(),
  verifyPublicPreview: vi.fn(async () => {}),
}))
vi.mock("server-only", () => ({}))
const { db, box } = vi.hoisted(() => ({
  db: { tenant: { findUniqueOrThrow: vi.fn() }, mcpDeploymentSource: { findFirst: vi.fn() }, websiteTemplate: { updateMany: vi.fn(), findFirstOrThrow: vi.fn(), update: vi.fn() },
    mcpPreviewSession: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    websiteTemplateVersion: { aggregate: vi.fn(), create: vi.fn() }, schemaTemplate: { findUniqueOrThrow: vi.fn() },
    apiToken: { create: vi.fn() }, $transaction: vi.fn() },
  box: { name: "test-box", domain: vi.fn(() => "https://upstream.example"), runCommand: vi.fn(async () => ({ exitCode: 0 })),
    writeFiles: vi.fn(), readFileToBuffer: vi.fn(), stop: vi.fn() },
}))
vi.mock("@/lib/database", () => ({ db }))
vi.mock("@vercel/sandbox", () => ({ Sandbox: { create: vi.fn(async () => box), get: vi.fn(async () => box) } }))
vi.mock("@/lib/vercel-client", () => ({ getVercelToken: vi.fn(async () => "test-token"), getVercelTeamId: vi.fn(async () => "team_test"), createTargetProject: vi.fn(async () => "prj_test") }))
vi.mock("@/lib/infrastructure/frontend-env", () => ({ resolveApiOrigin: () => "https://cms.example" }))
vi.mock("@/lib/infrastructure/demo-tenant", () => ({ findSchemaDemoWorkspace: async () => ({ id: "demo", slug: "demo-folio" }) }))

import { registerGlobalPreviews, registerWorkspacePreviews } from "@/lib/infrastructure/mcp-preview"

it("edits Folio Reka on one URL, saves a version, stops, and opens the saved source", async () => {
  vi.stubEnv("NEXTAUTH_SECRET", "preview-test")
  const templateId = "folio-reka-portofolio-cv"
  const template = { id: "template", demoVercelProjectId: null as string | null, slug: templateId, schemaTemplate: { id: "schema", demoTenantId: "demo" },
    schemaTemplateId: "schema", files: [{ path: "header.css", content: "header { color: blue }" }], sourceVersion: new Date(0) }
  let session: Record<string, unknown> | null = null
  const disk = new Map<string, Buffer>()
  box.writeFiles.mockImplementation(async files => { for (const file of files) disk.set(file.path, file.content) })
  box.readFileToBuffer.mockImplementation(async ({ path }) => disk.get(path))
  db.$transaction.mockImplementation(async fn => fn(db))
  db.websiteTemplate.findFirstOrThrow.mockImplementation(async () => ({ ...template }))
  db.websiteTemplate.updateMany.mockImplementation(async ({ data }) => Object.assign(template, data))
  db.websiteTemplate.update.mockImplementation(async ({ data }) => Object.assign(template, data))
  db.mcpPreviewSession.findUnique.mockImplementation(async () => session && { ...session })
  db.mcpPreviewSession.create.mockImplementation(async ({ data }) => session = { revision: 0, dirty: false, ...data })
  db.mcpPreviewSession.update.mockImplementation(async ({ data }) => {
    const revision = data.revision ? Number(session?.revision) + data.revision.increment : session?.revision
    return session = { ...session, ...data, revision }
  })
  db.mcpPreviewSession.updateMany.mockImplementation(async ({ where, data }) => {
    if (Object.entries(where).some(([key, value]) => session?.[key] !== value)) return { count: 0 }
    session = { ...session, ...data }
    return { count: 1 }
  })
  db.schemaTemplate.findUniqueOrThrow.mockResolvedValue({ schema: {} })
  db.websiteTemplateVersion.aggregate.mockResolvedValue({ _max: { version: null } })
  const handlers = new Map<string, (args: Record<string, unknown>) => Promise<{ structuredContent: Record<string, unknown> }>>()
  registerGlobalPreviews({ registerTool: (name: string, _: unknown, handler: Parameters<typeof handlers.set>[1]) => handlers.set(name, handler) } as unknown as Parameters<typeof registerGlobalPreviews>[0],
    () => ({ tokenId: "token", tokenName: "editor" }))
  const call = async (name: string, args = {}) => (await handlers.get(name)!({ templateId, ...args })).structuredContent
  expect((await call("get_preview_url")).status).toBe("inactive")
  const { Sandbox } = await import("@vercel/sandbox")
  vi.mocked(Sandbox.create).mockRejectedValueOnce({ response: { status: 404 } })
  await expect(call("start_preview")).rejects.toThrow("404 saat membuat Sandbox untuk project prj_test di team team_test")
  const started = await call("start_website_template_preview", { websiteTemplateId: templateId })
  expect(await call("get_website_template_preview", { websiteTemplateId: templateId })).toMatchObject({ previewUrl: started.previewUrl, previewKind: "code", contentMode: "published" })
  const { createTargetProject } = await import("@/lib/vercel-client")
  expect(createTargetProject).toHaveBeenCalledTimes(1)
  expect(createTargetProject).toHaveBeenCalledWith("sacms-demo-" + templateId, "team_test", "test-token")
  expect(started.previewUrl).toMatch(/^https:\/\/[0-9a-f]{16}\.preview\.sacms\.cloud$/)
  template.demoVercelProjectId = "prj_next"
  const changedFiles = [{ path: "header.css", content: "header { color: red }" }]
  await call("apply_preview_changes", { expectedRevision: 0, changedFiles })
  expect(Sandbox.get).toHaveBeenCalledWith(expect.objectContaining({ projectId: "prj_test", teamId: "team_test" }))
  await expect(call("apply_preview_changes", { expectedRevision: 0, changedFiles })).rejects.toThrow("CONFLICT")
  expect((await call("get_preview_url")).previewUrl).toBe(started.previewUrl)
  expect((await call("stop_preview")).hasUnsavedChanges).toBe(true)
  await expect(call("save_preview_changes", { expectedSourceVersion: "stale" })).rejects.toThrow("CONFLICT")
  const saved = await call("save_preview_changes", { expectedSourceVersion: started.sourceVersion })
  expect(saved.version).toBe(2)
  expect((await call("stop_preview")).status).toBe("stopped")
  disk.clear()
  const reopened = await call("start_preview")
  expect(Sandbox.create).toHaveBeenLastCalledWith(expect.objectContaining({ projectId: "prj_next" }))
  expect(reopened.sourceVersion).toBe(saved.sourceVersion)
  expect((await call("read_preview_file", { path: "header.css" })).content).toBe(changedFiles[0].content)
})

it("uses the MCP tenant for workspace access and rejects an unrelated hosting project", async () => {
  let canWrite = false
  const handlers = new Map<string, (args: Record<string, unknown>) => Promise<{ structuredContent: Record<string, unknown> }>>()
  registerWorkspacePreviews({ registerTool: (name: string, _: unknown, handler: Parameters<typeof handlers.set>[1]) => handlers.set(name, handler) } as unknown as Parameters<typeof registerWorkspacePreviews>[0],
    () => ({ tenantId: "tenant-a", tenantSlug: "acme", canRead: true, canWrite }))
  db.tenant.findUniqueOrThrow.mockResolvedValue({ vercelProjectId: "project-a" })
  db.mcpDeploymentSource.findFirst.mockResolvedValue({ id: "saved", tenantId: "tenant-a", files: [] })
  db.mcpPreviewSession.findUnique.mockResolvedValue(null)
  await expect(handlers.get("start_preview")!({})).rejects.toThrow("Insufficient workspace permission")
  canWrite = true
  await expect(handlers.get("start_preview")!({ siteId: "project-b" })).rejects.toThrow("Site not found")
  const info = await handlers.get("get_site_preview")!({})
  expect(info.structuredContent).toMatchObject({ scope: "workspace", target: "acme", status: "inactive" })
  expect(db.mcpPreviewSession.findUnique).toHaveBeenCalledWith({ where: { scope_targetId: { scope: "workspace", targetId: "tenant-a" } } })
  db.mcpDeploymentSource.findFirst.mockResolvedValue({ id: "saved", files: [{ name: "package.json", content: "{}" }] })
  db.$transaction.mockImplementation(async fn => fn(db))
  db.mcpPreviewSession.create.mockImplementation(async ({ data }) => data)
  const { Sandbox } = await import("@vercel/sandbox")
  vi.mocked(Sandbox.create).mockRejectedValueOnce({ response: { status: 404 } })
  await expect(handlers.get("start_site_preview")!({ siteId: "project-a" })).rejects.toThrow("project project-a di team team_test")
  expect(Sandbox.create).toHaveBeenLastCalledWith(expect.objectContaining({ projectId: "project-a", teamId: "team_test" }))
})
