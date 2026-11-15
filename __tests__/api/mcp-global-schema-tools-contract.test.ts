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

  // ── Schema + Website Template merge ─────────────────────────────────────

  it("create_website_template accepts schema inline as an alternative to schemaTemplateId, and rejects neither/both", () => {
    const scoped = toolBlockOf("create_website_template")
    expect(scoped).toMatch(/schemaTemplateId:\s*z\.string\(\)\.optional\(\)/)
    expect(scoped).toMatch(/schema:\s*schemaTemplateBundleSchema\.optional\(\)/)
    expect(scoped).toMatch(/category:\s*z\.string\(\)\.min\(1\)\.max\(100\)\.optional\(\)/)
    expect(scoped).toMatch(/Berikan salah satu/)
    expect(scoped).toMatch(/Berikan HANYA salah satu/)
  })

  it("create_website_template auto-creates a backing Schema Template when schema is given, reusing the shared slug-dedup helper", () => {
    const scoped = toolBlockOf("create_website_template")
    expect(scoped).toMatch(/dedupeSlug/)
    expect(scoped).toMatch(/tx\.schemaTemplate\.create/)
    expect(scoped).toMatch(/published:\s*false/)
  })

  it("create_website_template creates the backing Schema Template and the Website Template in ONE transaction, so an invalid files payload or a failed create never orphans the Schema Template", () => {
    const scoped = toolBlockOf("create_website_template")
    expect(scoped).toMatch(/db\.\$transaction\(async \(tx\)/)
    // Files must be validated BEFORE the transaction even starts.
    const filesValidationIdx = scoped.indexOf("websiteTemplateFilesSchema.safeParse(files)")
    const transactionIdx = scoped.indexOf("db.$transaction(async (tx)")
    expect(filesValidationIdx).toBeGreaterThan(-1)
    expect(transactionIdx).toBeGreaterThan(filesValidationIdx)
  })

  it("create_website_template supports idempotencyKey — replays an existing template instead of creating a duplicate, and recovers from a concurrent-claim race (P2002) instead of surfacing the raw DB error", () => {
    const scoped = toolBlockOf("create_website_template")
    expect(scoped).toMatch(/idempotencyKey: z\.string\(\)\.optional\(\)/)
    expect(scoped).toMatch(/db\.websiteTemplate\.findUnique\(\{ where: \{ idempotencyKey \} \}\)/)
    expect(scoped).toMatch(/err\?\.code === "P2002"/)
  })

  it("update_website_template accepts an optional schema param and redeploys the demo when it (or files) changed", () => {
    const scoped = toolBlockOf("update_website_template")
    expect(scoped).toMatch(/schema:\s*schemaTemplateBundleSchema\.optional\(\)/)
    expect(scoped).toMatch(/schemaUpdated/)
    expect(scoped).toMatch(/filesData !== undefined \|\| schemaUpdated/)
  })

  it("create_schema_template and create_website_template share one slug-dedup helper instead of duplicating the collision loop", () => {
    const occurrences = routeSource.match(/async function dedupeSlug/g) || []
    expect(occurrences).toHaveLength(1)
  })

  it("the server's top-level instructions warn that richText needs dangerouslySetInnerHTML and markdown needs a Markdown renderer, not plain-text interpolation (a real finding: a template rendering richText as plain text only looked fine with unwrapped test prose)", () => {
    // [\s\S]* instead of a dotAll `.*` — the project's tsconfig targets
    // ES2017, where TS rejects the `/s` regex flag at compile time even
    // though it'd work fine at runtime.
    expect(routeSource).toMatch(/richText[\s\S]*dangerouslySetInnerHTML/)
    expect(routeSource).toMatch(/markdown[\s\S]*Markdown renderer/i)
  })

  // ── chatgpt7.md round ──────────────────────────────────────────────────────

  it("get_website_template/update_website_template/delete_website_template report the correct entity name and a NOT_FOUND code — the shared notFound() helper used to hardcode 'Schema Template' for all six callers", () => {
    for (const tool of ["get_website_template", "update_website_template", "delete_website_template"]) {
      const scoped = toolBlockOf(tool)
      expect(scoped, `${tool} should call notFound(\"Website Template\", ...)`).toMatch(/notFound\("Website Template", id\)/)
    }
    for (const tool of ["get_schema_template", "update_schema_template", "delete_schema_template"]) {
      const scoped = toolBlockOf(tool)
      expect(scoped, `${tool} should call notFound(\"Schema Template\", ...)`).toMatch(/notFound\("Schema Template", id\)/)
    }
    expect(routeSource).toMatch(/function notFound\(entity: "Schema Template" \| "Website Template"/)
  })

  it("create_schema_template, update_schema_template, create_website_template, and update_website_template all gate on validateBundleReferences before writing a schema bundle", () => {
    for (const tool of ["create_schema_template", "update_schema_template", "create_website_template", "update_website_template"]) {
      const scoped = toolBlockOf(tool)
      expect(scoped, `${tool} should validate cross-references before saving`).toMatch(/validateBundleReferences/)
      expect(scoped, `${tool} should refuse on reference issues`).toMatch(/referenceIssuesResponse/)
    }
  })

  it("create_website_template's dryRun validates everything (files, bundle shape, cross-references, schemaTemplateId existence) without writing anything or deploying a demo", () => {
    const scoped = toolBlockOf("create_website_template")
    expect(scoped).toMatch(/dryRun: z\.boolean\(\)\.optional\(\)/)
    // The dryRun branch must return before the transaction/demo-deploy
    // code that actually writes/deploys anything.
    const dryRunIdx = scoped.indexOf("if (dryRun) {")
    const transactionIdx = scoped.indexOf("db.$transaction(async (tx)")
    const demoDeployIdx = scoped.indexOf("deployWebsiteTemplateDemo(")
    expect(dryRunIdx).toBeGreaterThan(-1)
    expect(dryRunIdx).toBeLessThan(transactionIdx)
    expect(dryRunIdx).toBeLessThan(demoDeployIdx)
    expect(scoped).toMatch(/valid: true/)
  })

  it("delete_schema_template refuses to cascade-delete dependent Website Templates by default, listing them, instead of silently deleting them too (WebsiteTemplate.schemaTemplateId cascades on delete at the DB level)", () => {
    const scoped = toolBlockOf("delete_schema_template")
    expect(scoped).toMatch(/confirmCascade/)
    expect(scoped).toMatch(/HAS_DEPENDENTS/)
    expect(scoped).toMatch(/db\.websiteTemplate\.findMany\(\{\s*where: \{ schemaTemplateId: existing\.id \}/)
    // The dependents check must come before the actual delete call.
    expect(scoped.indexOf("websiteTemplate.findMany")).toBeLessThan(scoped.indexOf("schemaTemplate.delete"))
  })

  it("invalidSchema reports each zod issue with a bracket-indexed path and a structured VALIDATION_FAILED code, not just a flattened text message", () => {
    expect(routeSource).toMatch(/function invalidSchema/)
    const fnStart = routeSource.indexOf("function invalidSchema")
    const fnBlock = routeSource.slice(fnStart, routeSource.indexOf("\n}\n", fnStart))
    expect(fnBlock).toMatch(/formatZodPath/)
    expect(fnBlock).toMatch(/code: "VALIDATION_FAILED"/)
  })
})
