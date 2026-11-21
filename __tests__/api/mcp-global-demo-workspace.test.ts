import { beforeEach, describe, expect, it, vi } from "vitest"
import { readFile } from "node:fs/promises"

type Tool = (args: Record<string, unknown>) => Promise<{ structuredContent: Record<string, unknown>; isError?: boolean }>
type Prompt = (args: Record<string, unknown>) => Promise<{ messages: { role: string; content: { text: string } }[] }>

const mocks = vi.hoisted(() => {
  const tx = {
    tenant: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    contentType: { deleteMany: vi.fn() },
    schemaTemplate: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    websiteTemplate: { count: vi.fn(), findMany: vi.fn() },
  }
  return {
    tx,
    findTemplate: vi.fn(),
    listComponents: vi.fn(),
    transaction: vi.fn(),
    materialize: vi.fn(),
    serialize: vi.fn(),
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
vi.mock("@/lib/content/entry-service", () => ({}))
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
      where: { tenantId: workspace.id, draftTemplateId: null, slug: { in: ["pages"] } },
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
})
