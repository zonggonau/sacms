import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

// Static source-text contract checks for the SaCMS Global Schema Template
// MCP server, mirroring __tests__/api/mcp-route-tools-contract.test.ts for
// the per-workspace server: this server registers its tools through
// createMcpHandler's factory too, which the SDK only invokes lazily per
// request, so a behavioral/integration test exercises nothing here either.
//
// Scope (chatgpt.md/chatgpt1.md applied to the template-building tools):
// every tool whose result feeds a later step must declare outputSchema/
// structuredContent (not just content[].text), and a targeted template
// edit must be able to send only the files that changed instead of
// resending the whole bundle, mirroring deploy_website_patch's role for
// the per-workspace server.

const routeSource = readFileSync(
  join(__dirname, "../../src/app/api/mcp/global-schema/[[...transport]]/route.ts"),
  "utf-8",
)

function toolBlockOf(tool: string): string {
  const anchor = `server.registerTool(\n      "${tool}",`
  const start = routeSource.indexOf(anchor)
  expect(start, `${tool} should be registered via server.registerTool`).toBeGreaterThan(-1)
  const rest = routeSource.slice(start + anchor.length)
  const nextRegisterTool = rest.indexOf("server.registerTool(")
  return nextRegisterTool === -1 ? rest : rest.slice(0, nextRegisterTool)
}

describe("SaCMS Global Schema Template MCP route — source contract", () => {
  it("declares an outputSchema on every tool whose result feeds a later step", () => {
    for (const tool of [
      "list_field_types",
      "list_schema_templates",
      "get_schema_template",
      "create_schema_template",
      "update_schema_template",
      "list_website_templates",
      "get_website_template",
      "create_website_template",
      "update_website_template",
    ]) {
      expect(toolBlockOf(tool), `${tool} should declare an outputSchema`).toMatch(/outputSchema:/)
    }
  })

  it("create_website_template and update_website_template report a structured demoDeployment (status/verified/error), not just a raw demoUrl", () => {
    for (const tool of ["create_website_template", "update_website_template"]) {
      const scoped = toolBlockOf(tool)
      expect(scoped, `${tool} should call deployWebsiteTemplateDemo`).toMatch(/deployWebsiteTemplateDemo/)
      expect(scoped, `${tool} should report describeDemoDeployment`).toMatch(/describeDemoDeployment/)
    }
    // Reads back the authoritative persisted row after the demo deploy writes
    // its own fields, rather than hand-patching the in-memory row.
    expect(toolBlockOf("create_website_template")).toMatch(/findUnique/)
  })

  it("update_website_template accepts changedFiles/deletedFiles as an alternative to resending the whole files bundle", () => {
    const scoped = toolBlockOf("update_website_template")
    expect(scoped).toMatch(/changedFiles:\s*z\.array/)
    expect(scoped).toMatch(/deletedFiles:\s*z\.array\(z\.string\(\)\)\.optional\(\)/)
    // Merges onto the bundle already stored on the row, not a re-fetch from
    // some other system — the DB row already IS the full source of truth.
    expect(scoped).toMatch(/existing\.files/)
  })

  it("update_website_template rejects combining files with changedFiles/deletedFiles instead of silently picking one", () => {
    const scoped = toolBlockOf("update_website_template")
    expect(scoped).toMatch(/INVALID_ARGUMENT/)
  })

  it("update_website_template reports demoDeployment.status 'skipped' for a metadata-only edit, not a fabricated 'ok'", () => {
    const scoped = toolBlockOf("update_website_template")
    expect(scoped).toMatch(/status:\s*"skipped"/)
  })

  it("the demo-deployment response shape distinguishes accepted from verified", () => {
    expect(routeSource).toMatch(/DEMO_DEPLOYMENT_OUTPUT_SHAPE/)
    expect(routeSource).toMatch(/verified:\s*z\.boolean\(\)\.optional\(\)/)
    expect(routeSource).toMatch(/verificationError:\s*z\.boolean\(\)\.optional\(\)|verificationError:\s*z\.string\(\)\.optional\(\)/)
  })
})
