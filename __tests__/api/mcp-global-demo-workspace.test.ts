import { beforeEach, describe, expect, it, vi } from "vitest"
import { readFile } from "node:fs/promises"

type Tool = (args: Record<string, unknown>) => Promise<{ structuredContent: Record<string, unknown>; isError?: boolean }>
type Prompt = (args: Record<string, unknown>) => Promise<{ messages: { role: string; content: { text: string } }[] }>

const mocks = vi.hoisted(() => {
  const findTemplate = vi.fn()
  const tx = {
    tenant: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    contentType: { deleteMany: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    contentEntry: { deleteMany: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    singleType: { findFirst: vi.fn(), findMany: vi.fn() },
    tenantSingleTypeAssignment: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    component: { findFirst: vi.fn() },
    media: { findFirst: vi.fn(), create: vi.fn() },
    schemaTemplate: { findFirst: findTemplate, findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    websiteTemplate: { count: vi.fn(), findMany: vi.fn() },
  }
  return {
    tx,
    findTemplate,
    listComponents: vi.fn(),
    transaction: vi.fn(),
    materialize: vi.fn(),
    serialize: vi.fn(),
    resolveWriteLocale: vi.fn(),
    createContentEntry: vi.fn(),
    updateContentEntry: vi.fn(),
    uploadTenantMedia: vi.fn(),
    invalidatePattern: vi.fn(),
  }
})

vi.mock("mcp-handler", () => ({
  createMcpHandler: (register: (server: {
    registerTool: (name: string, config: unknown, tool: Tool) => void
    registerPrompt: (name: string, config: unknown, prompt: Prompt) => void
  }) => Promise<void>) => {
    const tools = new Map<string, Tool>()
    const prompts = new Map<string, Prompt>()
    const ready = register({
      registerTool: (name, _config, tool) => { tools.set(name, tool) },
      registerPrompt: (name, _config, prompt) => { prompts.set(name, prompt) },
    })
    return async (request: Request) => {
      await ready
      const { name, args, kind } = await request.json()
      const handler = kind === "prompt" ? prompts.get(name) : tools.get(name)
      return Response.json(await handler!(args))
    }
  },
}))
vi.mock("@/lib/database", () => ({
  Prisma: { DbNull: null },
  db: {
    ...mocks.tx,
    apiToken: { findFirst: vi.fn().mockResolvedValue({ id: "token-1" }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    schemaTemplate: { ...mocks.tx.schemaTemplate, findFirst: mocks.findTemplate },
    globalComponent: { findMany: mocks.listComponents },
    $transaction: mocks.transaction,
  },
}))
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock("@/lib/schema-wipe", () => ({ wipeTenantSchema: vi.fn() }))
vi.mock("@/lib/content/entry-service", () => ({
  resolveWriteLocale: mocks.resolveWriteLocale,
  createContentEntry: mocks.createContentEntry, updateContentEntry: mocks.updateContentEntry,
}))
vi.mock("@/lib/cache", () => ({ invalidatePattern: mocks.invalidatePattern }))
vi.mock("@/lib/r2", () => ({ uploadTenantMedia: mocks.uploadTenantMedia, deleteFromStorage: vi.fn() }))
vi.mock("@/lib/plan-enforcement", () => ({ checkStorageUpload: vi.fn().mockResolvedValue({ allowed: true }) }))
vi.mock("@/lib/schema-template-sync", () => ({
  materializeSchemaIntoTenant: mocks.materialize, serializeTenantSchema: mocks.serialize,
}))

import { db } from "@/lib/database"
import { POST } from "@/app/api/mcp/global-schema/[[...transport]]/route"

const version = new Date("2026-11-10T12:00:00.000Z")
const field = { name: "Judul", slug: "title", type: "text" }
const starter = {
  groups: [],
  contentTypes: [
    { name: "Kategori", slug: "kategori", fields: [field] },
    { name: "Post", slug: "posts", fields: [field, { name: "Kategori", slug: "category", type: "relation", relationSlug: "kategori" }] },
    { name: "Halaman", slug: "pages", fields: [field] },
  ],
  singleTypes: [{ name: "Beranda", slug: "homepage", fields: [field] }],
  components: [{ name: "Hero", slug: "hero", fields: [field] }],
}
const workspace = { id: "demo-1", slug: "demo-contoh" }
const stored = {
  id: "template-1", name: "Contoh", slug: "contoh", category: "Website", icon: "📦", description: null,
  schema: starter, demoTenantId: workspace.id, isDefault: false, published: false, createdAt: version, updatedAt: version, sourceVersion: version,
}
const singleInput = { schemaTemplateId: stored.id, singleTypeSlug: "site-settings", locale: "id" }
const demoSingle = {
  id: "st-settings", name: "Site Settings", slug: "site-settings", isPublished: true,
  schemaFields: [
    { ...field, required: false },
    { slug: "brand", name: "Brand", type: "component", required: false, options: { componentSlug: "brand" } },
    { slug: "sections", name: "Sections", type: "repeater", required: false, options: { allowedComponents: ["brand"] } },
  ],
}
const assignment = {
  id: "assignment-1", locale: "id", enabled: true, updatedAt: version, publishedAt: version,
  data: { title: "Kopi Demo" }, draftData: null,
}

async function call(name: string, args: Record<string, unknown>, kind: "tool" | "prompt" = "tool") {
  const response = await POST(new Request("https://example.test/api/mcp/global-schema", {
    method: "POST",
    headers: { authorization: "Bearer mcpglobal_fixture", "content-type": "application/json" },
    body: JSON.stringify({ name, args, kind }),
  }))
  return response.json()
}

describe("Global MCP starter schema and demo workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findTemplate.mockResolvedValue(stored)
    mocks.listComponents.mockResolvedValue([
      { name: "Hero Katalog", slug: "hero", fields: [] },
      { name: "CTA", slug: "cta", fields: [field] },
    ])
    mocks.transaction.mockImplementation((run) => run(mocks.tx))
    mocks.tx.tenant.findUnique.mockResolvedValue(null)
    mocks.tx.tenant.findFirst.mockResolvedValue(workspace)
    mocks.tx.tenant.create.mockResolvedValue(workspace)
    mocks.tx.schemaTemplate.findUnique.mockResolvedValue(null)
    mocks.tx.schemaTemplate.create.mockImplementation(async ({ data }) => ({ ...stored, ...data }))
    mocks.tx.schemaTemplate.updateMany.mockResolvedValue({ count: 1 })
    mocks.tx.schemaTemplate.findUniqueOrThrow.mockResolvedValue(stored)
    mocks.tx.websiteTemplate.count.mockResolvedValue(0)
    mocks.tx.websiteTemplate.findMany.mockResolvedValue([])
    mocks.tx.contentType.findFirst.mockResolvedValue(null)
    mocks.tx.contentType.findMany.mockResolvedValue([])
    mocks.tx.contentType.deleteMany.mockResolvedValue({ count: 1 })
    mocks.tx.contentEntry.deleteMany.mockResolvedValue({ count: 3 })
    mocks.tx.tenantSingleTypeAssignment.deleteMany.mockResolvedValue({ count: 2 })
    mocks.tx.singleType.findMany.mockResolvedValue([])
    mocks.tx.singleType.findFirst.mockResolvedValue(demoSingle)
    mocks.tx.tenantSingleTypeAssignment.findUnique.mockResolvedValue(assignment)
    mocks.tx.media.findFirst.mockResolvedValue(null)
    mocks.resolveWriteLocale.mockResolvedValue({ ok: true, data: "id" })
    mocks.materialize.mockResolvedValue({ imported: 7 })
  })

  it("points the website prompt to the same read-only workflow used by the local skill", async () => {
    const prompt = await call("buat-website", { topic: "Portal berita lokal" }, "prompt")
    expect(prompt.messages[0].content.text).toContain("Portal berita lokal")
    expect(prompt.messages[0].content.text).toContain("get_website_agent_workflow")

    const workflow = await readFile("src/lib/infrastructure/sacms-global-website-workflow.md", "utf8")
    const result = await call("get_website_agent_workflow", {})
    expect(result.structuredContent).toEqual({ skill: "sacms-global-website", workflow })
    expect(result.content[0].text).toBe(workflow)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("loads the starter and links a workspace before returning the new template", async () => {
    const result = await call("create_schema_template", { name: "Contoh", category: "Website" })
    expect(result.structuredContent.demoWorkspace).toMatchObject({ ...workspace, cmsPath: "/dashboard/demo-contoh/cms" })
    expect(result.structuredContent.schema.contentTypes.map(({ slug }: { slug: string }) => slug)).toEqual(["kategori", "posts", "pages"])
    expect(result.structuredContent.schema.singleTypes.map(({ slug }: { slug: string }) => slug)).toEqual(["site-settings", "homepage"])
    expect(result.structuredContent.schema.components).toEqual([starter.components[0], { name: "CTA", slug: "cta", fields: [field] }])
    expect(mocks.materialize).toHaveBeenCalledWith(mocks.tx, workspace.id, result.structuredContent.schema)
    expect(mocks.tx.schemaTemplate.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ demoTenantId: workspace.id }) }))
  })

  it("reads only the linked internal demo workspace's model rows", async () => {
    mocks.serialize.mockResolvedValue({ ...starter, contentTypes: [] })
    const result = await call("get_schema_template", { id: stored.id, includeDemoSchema: true })
    expect(mocks.tx.tenant.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: workspace.id, ownerId: null, demoForSchemaTemplates: { some: { id: stored.id }, every: { id: stored.id } } }),
    }))
    expect(mocks.serialize).toHaveBeenCalledWith(db, { tenantId: workspace.id, draftTemplateId: null })
    expect(result.structuredContent.demoWorkspace.schema.contentTypes).toEqual([])
  })

  it("blocks dropping Single Types, Components, or an in-use Content Type", async () => {
    for (const schema of [
      { ...starter, singleTypes: [] },
      { ...starter, components: [] },
      { ...starter, contentTypes: starter.contentTypes.slice(1) },
    ]) {
      const result = await call("update_schema_template", { id: stored.id, schema })
      expect(result.structuredContent.code).toBe("VALIDATION_FAILED")
    }
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("removes only the excluded Content Types from the demo in the schema update transaction", async () => {
    const result = await call("update_schema_template", {
      id: stored.id, expectedVersion: version.toISOString(), schema: { ...starter, contentTypes: starter.contentTypes.slice(0, 2) },
    })
    expect(result.isError).toBeUndefined()
    expect(mocks.tx.contentType.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: workspace.id, draftTemplateId: null, slug: { in: ["pages"] }, entries: { none: {} } },
    })
    expect(mocks.materialize).toHaveBeenCalledWith(mocks.tx, workspace.id, {
      groups: [], contentTypes: [], singleTypes: [], components: [],
    }, {}, { updateExisting: true })
  })

  it("checks starter exclusions in website dry runs without provisioning a workspace", async () => {
    const input = { name: "Example", files: [{ path: "package.json", content: "{}" }], schema: {}, dryRun: true }
    const excluded = await call("create_website_template", { ...input, excludeDefaultContentTypes: ["homepage"] })
    expect(excluded.structuredContent.code).toBe("VALIDATION_FAILED")

    const valid = await call("create_website_template", { ...input, excludeDefaultContentTypes: ["kategori", "posts", "pages"] })
    expect(valid.structuredContent).toMatchObject({ mode: "dry_run", valid: true })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("reads exact locale and distinguishes empty entries, pending drafts and public values", async () => {
    mocks.tx.tenantSingleTypeAssignment.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...assignment, draftData: { title: "Belum terbit" } })
    const empty = await call("get_demo_single_type_entry", singleInput)
    expect(empty.structuredContent).toMatchObject({ status: "empty", data: {}, publishedData: null, locale: "id" })
    const saved = await call("get_demo_single_type_entry", singleInput)
    expect(saved.structuredContent).toMatchObject({
      status: "published", hasPendingDraft: true, data: { title: "Belum terbit" }, publishedData: { title: "Kopi Demo" },
    })
    expect(mocks.tx.tenantSingleTypeAssignment.findUnique).toHaveBeenCalledWith({
      where: { tenantId_singleTypeId_locale: { tenantId: workspace.id, singleTypeId: "st-settings", locale: "id" } },
    })
  })

  it("saves Component and Repeater values with demo media without replacing public content", async () => {
    const url = "/uploads/demo-contoh/logo.png"
    mocks.tx.component.findFirst.mockResolvedValue({ schemaFields: [{ slug: "logo", name: "Logo", type: "media", required: false }] })
    mocks.tx.media.findFirst.mockResolvedValue({ url })
    mocks.tx.tenantSingleTypeAssignment.update.mockImplementation(async ({ data }) => ({ ...assignment, ...data }))

    const result = await call("update_demo_single_type_entry", {
      ...singleInput, expectedVersion: version.toISOString(), publish: false,
      data: { brand: { logo: "asset-1" }, sections: [{ __component: "brand", logo: "asset-1" }] },
    })
    expect(result.structuredContent).toMatchObject({
      data: { title: "Kopi Demo", brand: { logo: url }, sections: [{ __component: "brand", logo: url }] },
      publishedData: { title: "Kopi Demo" }, hasPendingDraft: true,
    })
    expect(mocks.tx.component.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: workspace.id, slug: "brand", draftTemplateId: null } }))
    expect(mocks.tx.media.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: workspace.id, isPrivate: false }) }))
    expect(mocks.tx.tenantSingleTypeAssignment.update).toHaveBeenCalledOnce()
  })

  it("rejects cross-demo asset references and disallowed blocks without saving", async () => {
    mocks.tx.component.findFirst.mockResolvedValue({ schemaFields: [{ slug: "logo", name: "Logo", type: "media", required: false }] })
    const media = await call("update_demo_single_type_entry", { ...singleInput, data: { brand: { logo: "other-tenant-media" } } })
    const block = await call("update_demo_single_type_entry", { ...singleInput, data: { sections: [{ __component: "other" }] } })
    expect(media.structuredContent.code).toBe("VALIDATION_FAILED")
    expect(block.structuredContent.code).toBe("VALIDATION_FAILED")
    expect(mocks.tx.tenantSingleTypeAssignment.update).not.toHaveBeenCalled()
  })

  it("rejects unavailable demo links before reading entry or storage data", async () => {
    mocks.tx.tenant.findFirst.mockResolvedValue(null)
    expect((await call("get_demo_single_type_entry", singleInput)).structuredContent.code).toBe("DEMO_NOT_AVAILABLE")
    expect(mocks.tx.singleType.findFirst).not.toHaveBeenCalled()
    expect(mocks.tx.media.findFirst).not.toHaveBeenCalled()
  })

  it("uses the ordinary entry service to create demo collection drafts and rejects IDs outside the resolved collection", async () => {
    mocks.tx.contentType.findFirst.mockResolvedValue({ id: "ct-posts", slug: "posts", schemaFields: [{ ...field, required: false }] })
    mocks.createContentEntry.mockResolvedValue({
      ok: true, data: { id: "new-post", data: { title: "Contoh" }, status: "DRAFT", locale: "id", updatedAt: version, publishedAt: null },
    })
    const input = { schemaTemplateId: stored.id, contentTypeSlug: "posts", locale: "id", data: { title: "Contoh" } }
    const created = await call("save_demo_content_entry", input)
    expect(created.structuredContent.entry).toMatchObject({ id: "new-post", status: "DRAFT", locale: "id" })
    expect(mocks.createContentEntry).toHaveBeenCalledWith(expect.objectContaining({ tenantId: workspace.id }), { kind: "system" }, {
      contentTypeSlug: "posts", locale: "id", status: "DRAFT", data: { title: "Contoh" },
    })

    const refused = await call("save_demo_content_entry", { ...input, entryId: "external-entry" })
    expect(refused.structuredContent.code).toBe("NOT_FOUND")
    expect(mocks.tx.contentEntry.findFirst).toHaveBeenCalledWith({
      where: { id: "external-entry", tenantId: workspace.id, contentTypeId: "ct-posts", locale: "id", deletedAt: null },
    })
    expect(mocks.updateContentEntry).not.toHaveBeenCalled()
  })

  it("blocks schema removal if the demo collection still has entries", async () => {
    mocks.tx.contentType.findFirst.mockResolvedValue({ slug: "pages" })
    const result = await call("update_schema_template", {
      id: stored.id, schema: { ...starter, contentTypes: starter.contentTypes.slice(0, 2) },
    })
    expect(result.structuredContent.code).toBe("DEMO_CONTENT_EXISTS")
    expect(mocks.tx.contentType.deleteMany).not.toHaveBeenCalled()
  })

  it("uploads verified image bytes to the linked demo media library", async () => {
    const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg=="
    const media = { id: "uploaded", url: "/uploads/demo-contoh/logo.png", mimeType: "image/png", size: 67 }
    mocks.uploadTenantMedia.mockResolvedValue({ url: media.url, storageKey: "demo-contoh/logo.png" })
    mocks.tx.media.create.mockResolvedValue(media)
    const result = await call("upload_demo_media", { schemaTemplateId: stored.id, filename: "logo.png", mimeType: "image/png", base64: png })
    expect(result.structuredContent).toMatchObject({ demo: workspace, media, reused: false })
    expect(mocks.uploadTenantMedia).toHaveBeenCalledWith(workspace, expect.any(Buffer), "logo.png", "image/png")

    const invalid = await call("upload_demo_media", { schemaTemplateId: stored.id, filename: "logo.png", mimeType: "image/png", base64: "bm90IGFuIGltYWdl" })
    expect(invalid.structuredContent.code).toBe("VALIDATION_FAILED")
    expect(mocks.uploadTenantMedia).toHaveBeenCalledOnce()
  })

  it("requires an explicit reset and scopes the reset to demo entries without deleting schema or media", async () => {
    const refused = await call("reset_demo_content", { schemaTemplateId: stored.id })
    expect(refused.structuredContent.code).toBe("CONFIRMATION_REQUIRED")
    expect(mocks.tx.contentEntry.deleteMany).not.toHaveBeenCalled()
    const reset = await call("reset_demo_content", { schemaTemplateId: stored.id, confirmReset: true })
    expect(reset.structuredContent).toMatchObject({ status: "completed", deletedEntries: 3, deletedAssignments: 2 })
    expect(mocks.tx.contentEntry.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: workspace.id, contentType: { tenantId: workspace.id, draftTemplateId: null } },
    })
    expect(mocks.tx.contentType.deleteMany).not.toHaveBeenCalled()
    expect(mocks.uploadTenantMedia).not.toHaveBeenCalled()
  })
})
