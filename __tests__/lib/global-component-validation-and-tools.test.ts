import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { validateGlobalComponentFields } from "@/lib/schema-template-validation"

// Unit coverage for validateGlobalComponentFields (the field-level checks a
// standalone GlobalComponent gets, deliberately a subset of checkFields —
// no relation/component/repeater cross-reference checks, since a standalone
// component has no sibling models in the same call to validate against).

describe("validateGlobalComponentFields", () => {
  it("flags a duplicate field slug within the same component", () => {
    const issues = validateGlobalComponentFields([
      { name: "Name", slug: "name", type: "text" },
      { name: "Name Again", slug: "name", type: "text" },
    ])
    expect(issues.some((i) => i.path === "fields[1].slug" && /Duplicate field slug/.test(i.message))).toBe(true)
  })

  it("flags a fictional/typo'd field type", () => {
    const issues = validateGlobalComponentFields([{ name: "Quote", slug: "quote", type: "longtext" }])
    expect(issues.some((i) => i.path === "fields[0].type" && /list_field_types/.test(i.message))).toBe(true)
  })

  it("flags a malformed field slug, except for document_template's verbatim .docx placeholder keys", () => {
    const badSlug = validateGlobalComponentFields([{ name: "Bad", slug: "Not A Slug!", type: "text" }])
    expect(badSlug.some((i) => i.path === "fields[0].slug" && /not a valid field slug/.test(i.message))).toBe(true)

    const docxPlaceholder = validateGlobalComponentFields([
      { name: "Doc", slug: "Client Name", type: "document_template" },
    ])
    expect(docxPlaceholder.some((i) => i.path === "fields[0].slug")).toBe(false)
  })

  it("flags select/multiselect fields with no non-empty options.choices", () => {
    const missing = validateGlobalComponentFields([{ name: "Tier", slug: "tier", type: "select" }])
    expect(missing.some((i) => i.path === "fields[0].options.choices")).toBe(true)

    const empty = validateGlobalComponentFields([
      { name: "Tier", slug: "tier", type: "multiselect", options: { choices: [] } },
    ])
    expect(empty.some((i) => i.path === "fields[0].options.choices")).toBe(true)

    const ok = validateGlobalComponentFields([
      { name: "Tier", slug: "tier", type: "select", options: { choices: ["basic", "pro"] } },
    ])
    expect(ok.length).toBe(0)
  })

  it("does NOT flag a relationSlug/componentSlug pointing at something that doesn't exist in this call — unlike full bundle validation, a standalone component has no sibling models to cross-reference", () => {
    const issues = validateGlobalComponentFields([
      { name: "Author", slug: "author", type: "relation", relationSlug: "does-not-exist-yet" },
    ])
    expect(issues.length).toBe(0)
  })

  it("passes a clean, realistic Testimonial-shaped field set with zero issues", () => {
    const issues = validateGlobalComponentFields([
      { name: "Nama", slug: "name", type: "text", required: true },
      { name: "Peran", slug: "role", type: "text" },
      { name: "Kutipan", slug: "quote", type: "textarea", required: true },
      { name: "Foto", slug: "photo", type: "media" },
    ])
    expect(issues).toEqual([])
  })
})

// Static source-text contract checks, mirroring __tests__/api/
// mcp-global-schema-tools-contract.test.ts's own approach: both MCP
// servers register their tools through createMcpHandler's factory, which
// the SDK only invokes lazily per request, so a behavioral/integration test
// exercises nothing here — these assert the real, already-shipped shape.

const globalSchemaRouteSource = readFileSync(
  join(__dirname, "../../src/app/api/mcp/global-schema/[[...transport]]/route.ts"),
  "utf-8",
)
const perWorkspaceRouteSource = readFileSync(
  join(__dirname, "../../src/app/api/mcp/[[...transport]]/route.ts"),
  "utf-8",
)

function toolBlockOf(source: string, tool: string): string {
  const anchor = `server.registerTool(\n      "${tool}",`
  const start = source.indexOf(anchor)
  expect(start, `${tool} should be registered via server.registerTool`).toBeGreaterThan(-1)
  const rest = source.slice(start + anchor.length)
  const nextRegisterTool = rest.indexOf("server.registerTool(")
  return nextRegisterTool === -1 ? rest : rest.slice(0, nextRegisterTool)
}

describe("Global Component MCP tools — source contract (global-schema server)", () => {
  it("registers all 5 CRUD tools with an outputSchema", () => {
    for (const tool of [
      "list_global_components",
      "get_global_component",
      "create_global_component",
      "update_global_component",
      "delete_global_component",
    ]) {
      expect(toolBlockOf(globalSchemaRouteSource, tool), `${tool} should declare an outputSchema`).toMatch(/outputSchema:/)
    }
  })

  it("create_global_component and update_global_component take a schema-only `fields` array — no frontend code/files concept", () => {
    for (const tool of ["create_global_component", "update_global_component"]) {
      const scoped = toolBlockOf(globalSchemaRouteSource, tool)
      expect(scoped, `${tool} should accept fields: z.array(schemaTemplateFieldSchema)`).toMatch(/fields:\s*z\.array\(schemaTemplateFieldSchema\)/)
      expect(scoped, `${tool} should not reference a files bundle`).not.toMatch(/websiteTemplateFilesSchema/)
    }
    expect(globalSchemaRouteSource).not.toMatch(/GlobalComponent[\s\S]{0,200}files:\s*websiteTemplateFilesSchema/)
  })

  it("create_global_component and update_global_component validate fields via validateGlobalComponentFields and block only on real issues, not every warning", () => {
    for (const tool of ["create_global_component", "update_global_component"]) {
      const scoped = toolBlockOf(globalSchemaRouteSource, tool)
      expect(scoped, `${tool} should call validateGlobalComponentFields`).toMatch(/validateGlobalComponentFields/)
      expect(scoped, `${tool} should split by severity`).toMatch(/splitIssuesBySeverity/)
      expect(scoped, `${tool} should refuse on blocking issues only`).toMatch(/if \(blocking\.length > 0\) return referenceIssuesResponse\(blocking\)/)
    }
  })

  it("create_global_component dedupes its slug via the shared dedupeSlug helper, not a hand-rolled loop", () => {
    const scoped = toolBlockOf(globalSchemaRouteSource, "create_global_component")
    expect(scoped).toMatch(/dedupeSlug\(parsed\.data\.slug \|\| slugify\(name\), /)
  })

  it("create/update_global_component never publish directly — published: true is saved as a draft and queued for human approval", () => {
    const create = toolBlockOf(globalSchemaRouteSource, "create_global_component")
    expect(create).toMatch(/published: false,/)
    expect(create).toMatch(/queueApprovals\(auth, \[\{ action: "publish_global_component"/)

    const update = toolBlockOf(globalSchemaRouteSource, "update_global_component")
    expect(update).toMatch(/fields:\s*z\.array\(schemaTemplateFieldSchema\)\.optional\(\)/)
    expect(update).toMatch(/published === false \? \{ published: false \} : \{\}/)
    expect(update).toMatch(/queueApprovals\(auth, \[\{ action: "publish_global_component"/)
  })

  it("get_global_component/delete_global_component report NOT_FOUND via the shared notFound() helper, extended to include 'Global Component'", () => {
    expect(globalSchemaRouteSource).toMatch(/function notFound\(entity: "Schema Template" \| "Website Template" \| "Global Component"/)
    for (const tool of ["get_global_component", "delete_global_component"]) {
      const scoped = toolBlockOf(globalSchemaRouteSource, tool)
      expect(scoped, `${tool} should call notFound("Global Component", id)`).toMatch(/notFound\("Global Component", id\)/)
    }
  })

  it("every Global Component tool authenticates via authContext before touching the catalog", () => {
    for (const tool of [
      "list_global_components",
      "get_global_component",
      "create_global_component",
      "update_global_component",
      "delete_global_component",
    ]) {
      const scoped = toolBlockOf(globalSchemaRouteSource, tool)
      expect(scoped, `${tool} should check auth`).toMatch(/if \(!auth\) return UNAUTHORIZED/)
    }
  })
})

describe("Global Component discovery tools — source contract (per-workspace server)", () => {
  it("registers list_global_components/get_global_component as read-only, published-only lookups against the plain db client (platform catalog, not tenant-scoped)", () => {
    for (const tool of ["list_global_components", "get_global_component"]) {
      const scoped = toolBlockOf(perWorkspaceRouteSource, tool)
      expect(scoped, `${tool} should filter to published-only`).toMatch(/published:\s*true/)
      expect(scoped, `${tool} should require read scope`).toMatch(/hasScope\(auth, "read"\)/)
    }
  })

  it("get_global_component's result hands back `fields` directly, ready to pass into this server's own create_component", () => {
    const scoped = toolBlockOf(perWorkspaceRouteSource, "get_global_component")
    expect(scoped).toMatch(/fields:\s*component\.fields/)
  })

  it("the agent playbook's Phase 1 points agents at list_global_components/get_global_component before designing a Component from scratch", () => {
    expect(perWorkspaceRouteSource).toMatch(/Phase 1[\s\S]{0,2500}list_global_components[\s\S]{0,400}get_global_component/)
  })
})

// seedDefaultTenantSchema's own behavior is covered by
// __tests__/lib/default-tenant-schema.test.ts — these assert the isDefault
// SchemaTemplate knob exposed through create_schema_template/
// update_schema_template exists and enforces "at most one" before the real
// write, the same static source-text style as the rest of this file.

describe("isDefault SchemaTemplate knob — source contract (global-schema server)", () => {
  it("isDefault: true is only REQUESTED — create saves a non-default draft and update applies isDefault: false only; true goes to human approval", () => {
    const create = toolBlockOf(globalSchemaRouteSource, "create_schema_template")
    expect(create, "create_schema_template should accept isDefault").toMatch(/isDefault: z\.boolean\(\)\.optional\(\)/)
    expect(create).toMatch(/isDefault: false,/)
    expect(create).toMatch(/action: "set_default_schema_template"/)
    expect(create).toMatch(/requiresPublishScope\(auth, "create_schema_template"\)/)

    const update = toolBlockOf(globalSchemaRouteSource, "update_schema_template")
    expect(update, "update_schema_template should accept isDefault").toMatch(/isDefault: z\.boolean\(\)\.optional\(\)/)
    expect(update).toMatch(/isDefault === false \? \{ isDefault: false \} : \{\}/)
    expect(update).toMatch(/action: "set_default_schema_template"/)
    // No path in the route sets the default directly any more.
    expect(globalSchemaRouteSource).not.toMatch(/async function setAsDefaultSchemaTemplate\(/)
  })

  it("the approved set_default_schema_template action unsets every OTHER default in the same transaction", () => {
    const approvalsSource = readFileSync(join(__dirname, "../../src/lib/infrastructure/mcp-approvals.ts"), "utf-8")
    const caseStart = approvalsSource.indexOf('case "set_default_schema_template"')
    const caseBlock = approvalsSource.slice(caseStart, approvalsSource.indexOf("case ", caseStart + 10))
    expect(caseBlock).toMatch(/db\.\$transaction\(\[/)
    expect(caseBlock).toMatch(/isDefault: true, id: \{ not: target\.id \}/)
    expect(caseBlock).toMatch(/data: \{ isDefault: false \}/)
  })

  it("list_schema_templates and the shared serializer/output-shape expose isDefault", () => {
    expect(globalSchemaRouteSource).toMatch(/SCHEMA_TEMPLATE_OUTPUT_SHAPE = \{[\s\S]{0,800}isDefault: z\.boolean\(\)/)
    const listTool = toolBlockOf(globalSchemaRouteSource, "list_schema_templates")
    expect(listTool).toMatch(/isDefault: z\.boolean\(\)/)
    expect(listTool).toMatch(/isDefault: true,/)
  })
})

describe("Admin Global Component dashboard — source contract (/admin/developer/schema)", () => {
  const adminListSource = readFileSync(join(__dirname, "../../src/app/api/admin/global-components/route.ts"), "utf-8")
  const adminDetailSource = readFileSync(join(__dirname, "../../src/app/api/admin/global-components/[id]/route.ts"), "utf-8")

  it("GET lists every component (draft and published) gated by withAdminAuth, not just the published ones a workspace's own MCP server sees", () => {
    expect(adminListSource).toMatch(/withAdminAuth/)
    expect(adminListSource).not.toMatch(/published:\s*true/)
  })

  it("PATCH/DELETE are gated by withAdminAuth and reuse updateGlobalComponentSchema instead of a hand-rolled body shape", () => {
    expect(adminDetailSource).toMatch(/export const PATCH = withAdminAuth/)
    expect(adminDetailSource).toMatch(/export const DELETE = withAdminAuth/)
    expect(adminDetailSource).toMatch(/import \{ updateGlobalComponentSchema \} from "@\/lib\/validations\/global-component"/)
    expect(adminDetailSource).toMatch(/readJson\(req, updateGlobalComponentSchema\)/)
  })
})
