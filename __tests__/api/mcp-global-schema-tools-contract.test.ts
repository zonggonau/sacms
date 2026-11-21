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
      "get_website_agent_workflow",
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

  // ── chatgpt7.md P1 round ────────────────────────────────────────────────────

  it("update_schema_template and update_website_template accept expectedVersion and reject a stale write with CONFLICT instead of silently overwriting", () => {
    for (const tool of ["update_schema_template", "update_website_template"]) {
      const scoped = toolBlockOf(tool)
      expect(scoped, `${tool} should accept expectedVersion`).toMatch(/expectedVersion: z\.string\(\)\.optional\(\)/)
      // chatgpt.md P1: compares sourceVersion, NOT updatedAt — updatedAt
      // also moves on every redeploy/demo-metadata write (website) or the
      // one-time demoTenantId bookkeeping write (schema), neither of which
      // is a genuine source change.
      expect(scoped, `${tool} should compare sourceVersion, not updatedAt`).toMatch(/existing\.sourceVersion\.toISOString\(\) !== expectedVersion/)
      expect(scoped, `${tool} should reject with CONFLICT`).toMatch(/code: "CONFLICT"/)
    }
  })

  it("a structural schema change on update_schema_template or update_website_template refuses with HAS_DEPENDENTS when another Website Template shares the same backing Schema Template", () => {
    const schemaTpl = toolBlockOf("update_schema_template")
    expect(schemaTpl).toMatch(/confirmSharedUpdate/)
    expect(schemaTpl).toMatch(/HAS_DEPENDENTS/)
    expect(schemaTpl).toMatch(/db\.websiteTemplate\.findMany\(\{\s*where: \{ schemaTemplateId: existing\.id \}/)

    const websiteTpl = toolBlockOf("update_website_template")
    expect(websiteTpl).toMatch(/confirmSharedUpdate/)
    expect(websiteTpl).toMatch(/HAS_DEPENDENTS/)
    expect(websiteTpl).toMatch(/schemaTemplateId: existing\.schemaTemplate\.id, id: \{ not: existing\.id \}/)
  })

  it("registers get_website_template_demo_status (read-only, never deploys) and redeploy_website_template_demo as separate operations from create/update", () => {
    const statusTool = toolBlockOf("get_website_template_demo_status")
    expect(statusTool).toMatch(/verifyDemoRoutes/)
    expect(statusTool).not.toMatch(/deployWebsiteTemplateDemo/)

    const redeployTool = toolBlockOf("redeploy_website_template_demo")
    expect(redeployTool).toMatch(/deployWebsiteTemplateDemo/)
    expect(redeployTool).toMatch(/existing\.files/)
    expect(redeployTool).toMatch(/existing\.schemaTemplate/)
  })

  it("list_field_types returns contentApiContract with real Content API request/response examples, not just field-shape docs", () => {
    const scoped = toolBlockOf("list_field_types")
    expect(scoped).toMatch(/CONTENT_API_CONTRACT_EXAMPLES/)
    expect(scoped).toMatch(/contentApiContract:/)
    expect(routeSource).toMatch(/import \{ FIELD_TYPE_GUIDE, CONTENT_API_CONTRACT_EXAMPLES \} from "@\/lib\/field-type-guide"/)
  })

  // ── chatgpt8.md round ───────────────────────────────────────────────────────

  it("create_website_template's dryRun response has its own output shape, unioned onto the real outputSchema, instead of being validated against the create-result shape (id/slug/files/...) it can never satisfy", () => {
    expect(routeSource).toMatch(/const DRY_RUN_OUTPUT_SHAPE = z\.object\(\{/)
    const scoped = toolBlockOf("create_website_template")
    expect(scoped).toMatch(/outputSchema: z\.union\(\[\s*DRY_RUN_OUTPUT_SHAPE,/)
    // The dryRun success return must conform to DRY_RUN_OUTPUT_SHAPE's own
    // fields (mode/ok/valid/issues/warnings), not the create-result fields.
    const dryRunIdx = scoped.indexOf("if (dryRun) {")
    const dryRunBlock = scoped.slice(dryRunIdx, scoped.indexOf("\n        }\n\n        let schemaTemplate", dryRunIdx))
    expect(dryRunBlock).toMatch(/mode: "dry_run" as const/)
    expect(dryRunBlock).toMatch(/ok: true as const/)
  })

  it("UNAUTHORIZED carries structuredContent + isError so a tool with an outputSchema doesn't throw a generic 'no structured content' error instead of surfacing the real unauthorized message", () => {
    expect(routeSource).toMatch(/const UNAUTHORIZED = \{[\s\S]*?structuredContent: \{ ok: false, code: "UNAUTHORIZED"/)
    expect(routeSource).toMatch(/const UNAUTHORIZED = \{[\s\S]*?isError: true,\s*\}/)
  })

  it("create_website_template's schemaTemplateId/schema mutual-exclusivity errors carry structuredContent.code, matching every other validation error in this file", () => {
    const scoped = toolBlockOf("create_website_template")
    const occurrences = scoped.match(/code: "INVALID_ARGUMENT"/g) || []
    expect(occurrences.length).toBeGreaterThanOrEqual(2)
  })

  it("validateBundleReferences checks contentTypes[].group and groups[].parentSlug against the bundle's own groups[], not just relation/component/choices", () => {
    const fnStart = readFileSync(join(__dirname, "../../src/lib/schema-template-validation.ts"), "utf-8")
    expect(fnStart).toMatch(/groups\[\$\{i\}\]\.parentSlug/)
    expect(fnStart).toMatch(/contentTypes\[\$\{i\}\]\.group/)
  })

  it("deployWebsiteTemplateDemo injects the fixed SACMS system env vars (NEXT_PUBLIC_SACMS_API_URL/_TENANT/SACMS_API_KEY) via resolveFrontendEnv, not only resolveWebsiteTemplateEnvVars which deliberately excludes them", () => {
    const demoSource = readFileSync(
      join(__dirname, "../../src/lib/infrastructure/deploy-website-template-demo.ts"),
      "utf-8",
    )
    expect(demoSource).toMatch(/resolveFrontendEnv\(demoTenant\.id, demoTenant\.slug, resolveApiOrigin\(\)\)/)
    expect(demoSource).toMatch(/\.\.\.systemEnv,/)
  })

  it("deployWebsiteTemplateDemo retries verifyDemoUrl a limited number of times instead of reporting unverified on the first transient failure right after a fresh domain alias", () => {
    const demoSource = readFileSync(
      join(__dirname, "../../src/lib/infrastructure/deploy-website-template-demo.ts"),
      "utf-8",
    )
    expect(demoSource).toMatch(/attempt < 2/)
  })

  // ── chatgpt.md round ────────────────────────────────────────────────────────

  it("deployWebsiteTemplateDemo checks the triggered build's OWN terminal state before trusting the alias/URL check, so a FAILED build can't be masked by a stale previous deployment still rendering fine", () => {
    const demoSource = readFileSync(
      join(__dirname, "../../src/lib/infrastructure/deploy-website-template-demo.ts"),
      "utf-8",
    )
    expect(demoSource).toMatch(/waitForBuildTerminal/)
    expect(demoSource).toMatch(/getDeploymentStatus/)
    expect(demoSource).toMatch(/verified: false,[\s\S]*?PREVIOUS successful deployment/)
  })

  it("get_website_template_demo_status forces verified:false when the latest build state is ERROR/FAILED, instead of trusting a URL check that may be reading a previous successful deployment", () => {
    const scoped = toolBlockOf("get_website_template_demo_status")
    expect(scoped).toMatch(/const buildFailed = !!status\?\.state && \/ERROR\|FAILED\/i\.test\(status\.state\)/)
    expect(scoped).toMatch(/verified: buildFailed \? false : verification\.verified/)
  })

  it("WebsiteTemplate/SchemaTemplate expose sourceVersion (bumped only on a genuine files/schema change) for expectedVersion, separate from updatedAt (which also moves on every redeploy/demo-metadata write)", () => {
    expect(routeSource).toMatch(/sourceVersion: z\.string\(\)/)
    const updateWebsite = toolBlockOf("update_website_template")
    expect(updateWebsite).toMatch(/\.\.\.\(filesData !== undefined \|\| schemaUpdated \? \{ sourceVersion: new Date\(\) \} : \{\}\)/)
    const updateSchema = toolBlockOf("update_schema_template")
    expect(updateSchema).toMatch(/\.\.\.\(schemaData !== undefined \? \{ sourceVersion: new Date\(\) \} : \{\}\)/)
  })

  it("create_website_template's dryRun and real create/update validate field types against the real 36-type list and dummyData values against the same per-type rules real content creation uses", () => {
    const validationSource = readFileSync(join(__dirname, "../../src/lib/schema-template-validation.ts"), "utf-8")
    expect(validationSource).toMatch(/import \{ FIELD_TYPES \} from "@\/lib\/field-types"/)
    expect(validationSource).toMatch(/import \{ generateContentSchema \} from "@\/lib\/content-validations"/)
    expect(validationSource).toMatch(/VALID_FIELD_TYPES\.has\(f\.type\)/)
    expect(validationSource).toMatch(/function checkDummyData/)
  })

  // ── P1/P2 round (second external audit) ─────────────────────────────────

  it("every registered tool declares an annotations hint (readOnlyHint/destructiveHint/idempotentHint/openWorldHint)", () => {
    const toolNames = Array.from(routeSource.matchAll(/server\.registerTool\(\s*\n\s*"([a-z_]+)",/g)).map((m) => m[1])
    expect(toolNames.length).toBeGreaterThanOrEqual(14)
    for (const tool of toolNames) {
      expect(toolBlockOf(tool), `${tool} should declare annotations`).toMatch(/annotations:\s*\{/)
    }
  })

  it("registers get_builder_guide as the first tool, and keeps the top-level instructions short instead of the full workflow (confirmed to get truncated mid-word by at least one real MCP client at ~6,178 characters)", () => {
    expect(routeSource).toMatch(/"get_builder_guide"/)
    const firstToolIdx = routeSource.indexOf('server.registerTool(\n      "')
    const firstToolName = routeSource.slice(firstToolIdx).match(/"([a-z_]+)"/)?.[1]
    expect(firstToolName).toBe("get_builder_guide")

    const instructionsStart = routeSource.indexOf("instructions:")
    const instructionsBlock = routeSource.slice(instructionsStart, routeSource.indexOf("\n  },\n)", instructionsStart))
    const literalChars = (instructionsBlock.match(/"((?:[^"\\]|\\.)*)"/g) || []).join("").length
    expect(literalChars).toBeLessThan(2000)
  })

  it("registers a buat-website prompt via registerPrompt, not just tools", () => {
    expect(routeSource).toMatch(/server\.registerPrompt\(\s*\n\s*"buat-website",/)
    const promptStart = routeSource.indexOf('"buat-website"')
    const promptBlock = routeSource.slice(promptStart, promptStart + 2000)
    expect(promptBlock).toMatch(/argsSchema:/)
    expect(promptBlock).toMatch(/messages:\s*\[\{/)
  })

  it("delete_schema_template and delete_website_template declare an outputSchema instead of a bare content[]-only response", () => {
    for (const tool of ["delete_schema_template", "delete_website_template"]) {
      expect(toolBlockOf(tool), `${tool} should declare an outputSchema`).toMatch(/outputSchema:/)
    }
  })

  it("create_schema_template and update_schema_template serialize their response via serializeSchemaTemplate instead of spreading the raw Prisma row (which would leak the undeclared createdBy column)", () => {
    for (const tool of ["create_schema_template", "update_schema_template"]) {
      const scoped = toolBlockOf(tool)
      expect(scoped, `${tool} should call serializeSchemaTemplate`).toMatch(/serializeSchemaTemplate\(/)
      expect(scoped, `${tool} should not spread the raw template row`).not.toMatch(/\{ \.\.\.template,/)
    }
    expect(routeSource).toMatch(/function serializeSchemaTemplate/)
  })

  it("update_website_template accepts dryRun and returns before the write transaction, mirroring create_website_template's own dryRun contract", () => {
    const scoped = toolBlockOf("update_website_template")
    expect(scoped).toMatch(/dryRun: z\.boolean\(\)\.optional\(\)/)
    expect(scoped).toMatch(/outputSchema: z\.union\(\[\s*DRY_RUN_OUTPUT_SHAPE,/)
    const dryRunIdx = scoped.indexOf("if (dryRun) {")
    const transactionIdx = scoped.indexOf("db.$transaction(async (tx)")
    expect(dryRunIdx).toBeGreaterThan(-1)
    expect(dryRunIdx).toBeLessThan(transactionIdx)
  })

  it("get_website_template supports listPathsOnly and paths so a caller doesn't have to pull the whole (often ~150-200KB) files bundle just to check or patch one file", () => {
    const scoped = toolBlockOf("get_website_template")
    expect(scoped).toMatch(/listPathsOnly: z\.boolean\(\)\.optional\(\)/)
    expect(scoped).toMatch(/paths: z\.array\(z\.string\(\)\)\.optional\(\)/)
    expect(scoped).toMatch(/fileSizes/)
  })

  it("create_website_template and update_website_template both BLOCK (not just warn) on a bundle missing package.json — upgraded from an advisory-only dry-run warning (VAL-16, third external audit) since a build with no package.json can never actually deploy", () => {
    const create = toolBlockOf("create_website_template")
    expect(create).toMatch(/hasPackageJson/)
    expect(create).toMatch(/package\.json/)
    expect(create).toMatch(/return referenceIssuesResponse\(\[\{ path: "files", message: "No package\.json found/)

    const update = toolBlockOf("update_website_template")
    expect(update).toMatch(/filesData !== undefined && !filesData\.some/)
  })

  // ── Third external audit round (sacms-mcp-audit.mjs) ─────────────────────

  it("validateBundleReferences issues carry a severity, and advisory-only ones (componentSlugs typo, slug-source warning, unknown dummyData key) never block a save", () => {
    const validationSource = readFileSync(join(__dirname, "../../src/lib/schema-template-validation.ts"), "utf-8")
    expect(validationSource).toMatch(/severity\?:\s*"error"\s*\|\s*"warning"/)
    expect(validationSource).toMatch(/export function splitIssuesBySeverity/)
    for (const tool of ["create_schema_template", "update_schema_template", "create_website_template", "update_website_template"]) {
      expect(toolBlockOf(tool), `${tool} should use splitIssuesBySeverity, not block on every issue uniformly`).toMatch(/splitIssuesBySeverity\(validateBundleReferences/)
    }
  })

  it("the global-schema server's 429 rate-limit response carries Retry-After/RateLimit-* headers and a JSON-RPC-shaped body, not a bare {error} string with no way for a client to back off precisely", () => {
    expect(routeSource).toMatch(/"Retry-After":\s*String\(retryAfterSeconds\)/)
    expect(routeSource).toMatch(/"RateLimit-Remaining":/)
    expect(routeSource).toMatch(/jsonrpc:\s*"2\.0"/)
  })

  it("field slugs reject spaces/punctuation (camelCase/snake_case allowed) except for document_template's verbatim .docx placeholder keys, and a 'slug'-type field warns when it has no title/judul/name source", () => {
    const validationSource = readFileSync(join(__dirname, "../../src/lib/schema-template-validation.ts"), "utf-8")
    expect(validationSource).toMatch(/FIELD_SLUG_FORMAT_RE/)
    expect(validationSource).toMatch(/f\.type !== "document_template"/)
    expect(validationSource).toMatch(/TITLE_LIKE_SLUGS/)
  })

  it("dummyData color/date/boolean values are checked stricter than real content-entry's own forgiving coercion, and an unrecognized dummyData key is flagged too", () => {
    const validationSource = readFileSync(join(__dirname, "../../src/lib/schema-template-validation.ts"), "utf-8")
    expect(validationSource).toMatch(/HEX_COLOR_RE/)
    expect(validationSource).toMatch(/Date\.parse\(val\)/)
    expect(validationSource).toMatch(/typeof val !== "boolean"/)
    expect(validationSource).toMatch(/does not match any field slug in this model/)
  })

  it("validateBundleReferences flags duplicate slugs within the same array (contentTypes/singleTypes/components/groups each back a real per-array-unique DB table) and the repeater componentSlugs typo", () => {
    const validationSource = readFileSync(join(__dirname, "../../src/lib/schema-template-validation.ts"), "utf-8")
    expect(validationSource).toMatch(/function checkDuplicateSlugs/)
    expect(validationSource).toMatch(/componentSlugs/)
  })

  // Fourth external audit, ERR-4: `type`/model slug format are deliberately
  // NOT enforced as zod constraints directly on schemaTemplateFieldSchema/
  // schemaTemplateModelSchema — this shape is embedded in every affected
  // tool's own `inputSchema`, which the MCP SDK validates BEFORE the
  // handler runs, rejecting with its own generic stop-at-first-issue error
  // instead of validateBundleReferences' itemized, structuredContent.code
  // one. Enforced in schema-template-validation.ts instead (previous test).
  it("does NOT enforce type/slug format as zod constraints on the shared bundle schema (would bypass the MCP SDK's pre-handler gate)", () => {
    const schemaSource = readFileSync(join(__dirname, "../../src/lib/validations/schema-template.ts"), "utf-8")
    expect(schemaSource).not.toMatch(/z\.enum\(VALID_FIELD_TYPES\)/)
    expect(schemaSource).not.toMatch(/\.regex\(/)
  })

  it("the REST schema-templates route also runs validateBundleReferences, not just this zod shape's own (deliberately loose) structural check", () => {
    const routeSource = readFileSync(join(__dirname, "../../src/app/api/tenant/[tenant]/schema-templates/route.ts"), "utf-8")
    expect(routeSource).toMatch(/validateBundleReferences/)
    expect(routeSource).toMatch(/splitIssuesBySeverity/)
  })

  // ── Fourth external audit round ───────────────────────────────────────────

  it("the demo tenant's content is wiped and rebuilt on EVERY demo deploy, not just the first one (DEMO-6: a later redeploy/update used to leave it stale forever)", () => {
    const demoTenantSource = readFileSync(join(__dirname, "../../src/lib/infrastructure/demo-tenant.ts"), "utf-8")
    expect(demoTenantSource).toMatch(/import \{ wipeTenantSchema \} from "@\/lib\/schema-wipe"/)
    // Must run the wipe/rematerialize/reseed INSIDE the "already exists"
    // branch, not only in the brand-new-tenant creation path below it.
    const existsIdx = demoTenantSource.indexOf("if (existing) {")
    const wipeIdx = demoTenantSource.indexOf("wipeTenantSchema(tenantDb, existing.id)")
    expect(existsIdx).toBeGreaterThan(-1)
    expect(wipeIdx).toBeGreaterThan(existsIdx)
  })

  it("create_website_template/update_website_template/redeploy_website_template_demo no longer return the full `files` array (OUT-9: a ~150-200KB echo nobody needed), while get_website_template still does", () => {
    for (const tool of ["create_website_template", "update_website_template", "redeploy_website_template_demo"]) {
      const scoped = toolBlockOf(tool)
      expect(scoped, `${tool} should use the summary serializer/shape`).toMatch(/serializeWebsiteTemplateSummary|WEBSITE_TEMPLATE_SUMMARY_SHAPE/)
    }
    const getTool = toolBlockOf("get_website_template")
    expect(getTool).toMatch(/outputSchema: WEBSITE_TEMPLATE_OUTPUT_SHAPE|\.\.\.WEBSITE_TEMPLATE_OUTPUT_SHAPE/)
  })

  it("the shared website workflow preserves demo reporting and publication scope (PROMPT-2)", () => {
    const promptStart = routeSource.indexOf('"buat-website"')
    const promptBlock = routeSource.slice(promptStart, promptStart + 3000)
    expect(promptBlock).toContain("get_website_agent_workflow")
    const workflow = readFileSync(join(__dirname, "../../src/lib/infrastructure/sacms-global-website-workflow.md"), "utf-8")
    expect(workflow).toContain("routes[]")
    expect(workflow).toContain("Gunakan `published: true` hanya jika pengguna mengizinkan")
    expect(workflow).toContain("`apply_website_template` pada MCP per-workspace")
  })

  it("the 429 rate-limit response echoes the request's own JSON-RPC id instead of a hardcoded null, so a client correlating by id doesn't wait on it forever", () => {
    expect(routeSource).toMatch(/const requestId = await req\s*\n\s*\.clone\(\)\s*\n\s*\.json\(\)/)
    expect(routeSource).toMatch(/id: requestId,/)
  })
})
