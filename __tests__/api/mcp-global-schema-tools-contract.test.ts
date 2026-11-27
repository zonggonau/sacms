import { describe, it, expect } from "vitest"
import { GLOBAL_MCP_INSTRUCTIONS } from "@/lib/mcp/global-guidance"
import { readFileSync, readdirSync } from "fs"
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

// The global route plus the per-domain tool modules it registers (src/lib/mcp/global/*).
const routeSourceDir = join(__dirname, "../../src/lib/mcp/global")
const routeSource = [
  join(__dirname, "../../src/app/api/mcp/global-schema/[[...transport]]/route.ts"),
  ...readdirSync(routeSourceDir).map((file) => join(routeSourceDir, file)),
].map((file) => readFileSync(file, "utf-8").replace(/\r\n/g, "\n")).join("\n")

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
    const filesValidationIdx = scoped.indexOf("websiteTemplateFilesSchema.safeParse(starterSnapshot ? [...starterSnapshot.files, ...(files ?? [])] : files)")
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

  it("delete_schema_template refuses to cascade-delete dependent Website Templates by default, listing them, instead of silently deleting them too", () => {
    const scoped = toolBlockOf("delete_schema_template")
    expect(scoped).toMatch(/confirmCascade/)
    expect(scoped).toMatch(/HAS_DEPENDENTS/)
    expect(scoped).toMatch(/db\.websiteTemplate\.findMany\(\{\s*where: \{ schemaTemplateId: existing\.id \}/)
    expect(scoped).toMatch(/deletedAt:/)
    expect(scoped).toMatch(/\.update\(/)
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
    expect(toolBlockOf("list_field_types")).toMatch(/contentApiContract:/)
    // The payload itself is built by buildFieldTypeReference (shared with the field-types resource).
    const builder = routeSource.slice(routeSource.indexOf("function buildFieldTypeReference("), routeSource.indexOf("const GLOBAL_RESOURCES"))
    expect(builder).toMatch(/contentApiContract: CONTENT_API_CONTRACT_EXAMPLES/)
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
    // The route registers the guide module first; that module's first tool must be the guide.
    expect(routeSource.indexOf("registerGuideTools(server)")).toBeLessThan(routeSource.indexOf("registerWebsiteTemplateTools(server)"))
    const guideSource = readFileSync(join(__dirname, "../../src/lib/mcp/global/guide-tools.ts"), "utf-8").replace(/\r\n/g, "\n")
    const firstToolIdx = guideSource.indexOf('server.registerTool(\n      "')
    const firstToolName = guideSource.slice(firstToolIdx).match(/"([a-z_]+)"/)?.[1]
    expect(firstToolName).toBe("get_builder_guide")

    // The instructions text lives in src/lib/mcp/global-guidance.ts and is asserted on its value.
    const literalChars = GLOBAL_MCP_INSTRUCTIONS.length
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
      // validateBundleReferences' issues may pass through remapIssuePathsToInput
      // first (create_* tools merge the starter before validating).
      const scoped = toolBlockOf(tool)
      expect(scoped, `${tool} should validate cross-references`).toMatch(/validateBundleReferences\(/)
      expect(scoped, `${tool} should use splitIssuesBySeverity, not block on every issue uniformly`).toMatch(/splitIssuesBySeverity\(\s*(?:remapIssuePathsToInput\(\s*)?(?:validateBundleReferences|bundle ===)/)
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

  // ── Fourth external audit round ───────────────────────────────────────────

  it("frontend redeploy preserves demo content and reset requires explicit confirmation", () => {
    const demoTenantSource = readFileSync(join(__dirname, "../../src/lib/infrastructure/demo-tenant.ts"), "utf-8")
    expect(demoTenantSource).not.toContain("wipeTenantSchema")
    expect(toolBlockOf("redeploy_website_template_demo")).not.toContain("resetDemoContent")
    expect(toolBlockOf("reset_demo_content")).toMatch(/if \(!confirmReset\)/)
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

  // ── Async operations + sandbox build ─────────────────────────────────────

  it('create/update_website_template and redeploy accept background: true and include the async shape in their outputSchema union', () => {
    for (const tool of ['create_website_template', 'update_website_template', 'redeploy_website_template_demo']) {
      const scoped = toolBlockOf(tool)
      expect(scoped, `${tool} should accept background`).toMatch(/background: z\.boolean\(\)\.optional\(\)/)
      expect(scoped, `${tool} should union the async shape`).toMatch(/ASYNC_OPERATION_OUTPUT_SHAPE/)
      expect(scoped, `${tool} should hand off to runToolInBackground`).toMatch(/runToolInBackground\(/)
    }
  })

  it('a dryRun with verifyBuild runs a real sandbox build in the background instead of a shape-only check', () => {
    for (const tool of ['create_website_template', 'update_website_template']) {
      const scoped = toolBlockOf(tool)
      expect(scoped).toMatch(/verifyBuild: z\.boolean\(\)\.optional\(\)/)
      expect(scoped).toMatch(/if \(verifyBuild\) \{/)
      expect(scoped).toMatch(/runVerifyBuild\(/)
    }
  })

  it('records a version on create and on every files/schema update, and restores through update_website_template itself', () => {
    expect(toolBlockOf('create_website_template')).toMatch(/recordTemplateVersion\(/)
    const update = toolBlockOf('update_website_template')
    expect(update).toMatch(/recordTemplateVersion\(/)
    expect(update).toMatch(/restoreFromVersion: z\.number\(\)/)
    expect(update).toMatch(/baseline: \{/)
    for (const tool of ['list_template_versions', 'get_template_version']) {
      expect(toolBlockOf(tool), `${tool} should be read-only`).toMatch(/readOnlyHint: true/)
    }
    expect(toolBlockOf('get_website_template')).toMatch(/allFiles\.map\(describeFileSize\)/)
  })

  it('registers a read-only get_global_operation_status tool, and no longer the removed get_operation_status alias', () => {
    expect(routeSource).toMatch(/registerOperationStatus = [\s\S]*readOnlyHint: true[\s\S]*getOperation\(operationId\)/)
    expect(routeSource).toMatch(/registerOperationStatus\("get_global_operation_status"/)
    expect(routeSource).not.toMatch(/registerOperationStatus\("get_operation_status"/)
  })

  // ── Audit follow-up round ──────────────────────────────────────────────────

  it("get_builder_guide checks auth before returning, same as every other tool in this file (it used to be the sole exception)", () => {
    const scoped = toolBlockOf("get_builder_guide")
    expect(scoped).toMatch(/if \(!auth\) return UNAUTHORIZED/)
  })

  it("get_builder_guide's prose documents the isDefault SchemaTemplate knob, not just the per-request template-building flow", () => {
    const guide = routeSource.slice(routeSource.indexOf("function buildBuilderGuide("), routeSource.indexOf("// ─── MCP Handler"))
    expect(guide).toMatch(/isDefault/)
  })

  it("create_schema_template accepts idempotencyKey and replays the already-created template+demo instead of creating a duplicate on a lost-response retry", () => {
    const scoped = toolBlockOf("create_schema_template")
    expect(scoped).toMatch(/idempotencyKey: z\.string\(\)\.optional\(\)/)
    expect(scoped).toMatch(/db\.schemaTemplate\.findFirst\(\{\s*where: \{ idempotencyKey \}/)
    expect(scoped).toMatch(/idempotencyKey: idempotencyKey \|\| null,/)
  })

  it("SchemaTemplate.idempotencyKey is deliberately NOT a DB-level unique constraint (would trip db push's data-loss guard on this already-populated table, same reasoning as demoTenantId)", () => {
    const schemaSource = readFileSync(join(__dirname, "../../prisma/schema.prisma"), "utf-8")
    const modelStart = schemaSource.indexOf("model SchemaTemplate {")
    const modelBlock = schemaSource.slice(modelStart, schemaSource.indexOf("\n}\n", modelStart))
    expect(modelBlock).toMatch(/idempotencyKey String\?\s*$/m)
    expect(modelBlock).not.toMatch(/idempotencyKey String\?\s*@unique/)
  })
})

describe("SaCMS Global MCP — resources and field-type hint (source contract)", () => {
  it("registers every reference resource behind the same token check as the tools", () => {
    for (const uri of ["sacms://guide/builder", "sacms://guide/website-workflow", "sacms://reference/field-types", "sacms://reference/starter-schema"]) {
      expect(routeSource, uri).toContain(`uri: "${uri}"`)
    }
    const block = routeSource.slice(routeSource.indexOf("for (const resource of GLOBAL_RESOURCES)"), routeSource.indexOf("// ── Prompts"))
    expect(block).toMatch(/server\.registerResource\(/)
    expect(block).toMatch(/if \(!authContext\.getStore\(\)\) throw new Error\("Unauthorized/)
  })

  it("get_builder_guide and list_field_types share their content with the resources", () => {
    expect(toolBlockOf("get_builder_guide")).toMatch(/text: buildBuilderGuide\(\)/)
    expect(toolBlockOf("list_field_types")).toMatch(/buildFieldTypeReference\(category\)/)
    expect(toolBlockOf("get_website_agent_workflow")).toMatch(/await readWebsiteWorkflow\(\)/)
  })

  it("lists every valid field type in the `type` description as a hint, without enforcing a z.enum", () => {
    const schemaSource = readFileSync(join(__dirname, "../../src/lib/validations/schema-template.ts"), "utf-8")
    expect(schemaSource).toMatch(/type: z\.string\(\)\.describe\(`One of: \$\{VALID_FIELD_TYPES\.join\(", "\)\}/)
  })
})

describe("SaCMS Global MCP — binary assets in Website Template bundles (source contract)", () => {
  it("returns each file's encoding and decoded size/sha256", () => {
    expect(routeSource).toMatch(/const BUNDLE_FILE_OUTPUT = z\.object\(\{ path: z\.string\(\), content: z\.string\(\), encoding: z\.enum\(\["utf-8", "base64"\]\)\.optional\(\) \}\)/)
    expect(routeSource).toMatch(/bytes: bundleFileBytes\(f\)/)
    expect(routeSource).toMatch(/sha256: fileSha256\(f\.content, f\.encoding\)/)
    expect(toolBlockOf("get_website_template")).toMatch(/fileSizes = allFiles\.map\(describeFileSize\)/)
    expect(toolBlockOf("get_template_version")).toMatch(/fileSizes: snapshotFiles\.map\(describeFileSize\)/)
  })

  it("changedFiles items use the shared file schema, so a patch can carry a base64 asset too", () => {
    expect(toolBlockOf("update_website_template")).toMatch(/changedFiles: z\.array\(websiteTemplateFileSchema\)/)
  })

  it("demo deploy and workspace apply pass encoding through to the Vercel deploy", () => {
    const demo = readFileSync(join(__dirname, "../../src/lib/infrastructure/deploy-website-template-demo.ts"), "utf-8")
    expect(demo).toMatch(/websiteTemplate\.files\.map\(\(f\) => \(\{ name: f\.path, content: f\.content, encoding: f\.encoding \}\)\)/)
    const apply = readFileSync(join(__dirname, "../../src/lib/infrastructure/apply-website-template.ts"), "utf-8")
    expect(apply).toContain('encoding: encoding ?? "utf-8"')
    expect(apply).toContain("tx.mcpDeploymentSource.create")
    // Binary content is retained with its declared encoding.
    expect(apply).toMatch(/templateFiles\.map\(\(\{ path, content, encoding \}\) => \(\{ name: path, content, encoding:/)
  })
})

describe("SaCMS Global MCP — token scopes and human approvals (source contract)", () => {
  it("installs the scope gate once, before any tool is registered, by wrapping server.registerTool", () => {
    const gate = routeSource.indexOf("const registerToolUnscoped = server.registerTool.bind(server)")
    const firstTool = routeSource.indexOf("server.registerTool(\n      \"")
    expect(gate).toBeGreaterThan(-1)
    expect(gate).toBeLessThan(firstTool)
    const gateBlock = routeSource.slice(gate, firstTool)
    expect(gateBlock).toMatch(/requiredScopeForTool\(name\)/)
    expect(gateBlock).toMatch(/!auth\.scopes\.includes\(required\)\) return scopeDenied\(name, required\)/)
  })

  it("rejects expired tokens and tokens with no recognised scope", () => {
    expect(routeSource).toMatch(/token\.expiresAt && token\.expiresAt\.getTime\(\) <= Date\.now\(\)\) return null/)
    expect(routeSource).toMatch(/if \(scopes\.length === 0\) return null/)
  })

  it("no tool flips published/isDefault to true directly — every true value is queued for a human", () => {
    for (const tool of ["create_schema_template", "update_schema_template", "create_website_template", "update_website_template", "create_global_component", "update_global_component"]) {
      const block = toolBlockOf(tool)
      expect(block, `${tool} should queue approvals`).toMatch(/queueApprovals\(/)
      expect(block, `${tool} should require the publish scope to ask`).toMatch(/requiresPublishScope\(auth, "/)
      // Property writes only (`published: true,` / `isDefault: true }`), not prose in descriptions.
      expect(block, `${tool} must not write published: true`).not.toMatch(/published: true\s*[,}\n]/)
      expect(block, `${tool} must not write isDefault: true`).not.toMatch(/isDefault: true\s*[,}\n]/)
    }
  })

  it("delete_schema_template never cascades by itself — confirmCascade only queues a request", () => {
    const block = toolBlockOf("delete_schema_template")
    expect(block).toMatch(/if \(confirmCascade\) \{\s*const denied = requiresPublishScope/)
    expect(block).toMatch(/action.*delete_schema_template/)
    expect(block).not.toMatch(/\.delete\(\s*\{.*where.*id/)
    expect(block).toMatch(/\.update\(/)
    expect(block).toMatch(/deletedAt:/)
  })

  it("whoami exposes scopes but never the creating admin's email", () => {
    const block = toolBlockOf("whoami")
    expect(block).toMatch(/scopes: auth\.scopes/)
    expect(block).toMatch(/select: \{ name: true \}/)
    expect(block).not.toMatch(/email: true|\.email\b/)
  })

  it("get_approval_status is read-only and returns the decision outcome", () => {
    const block = toolBlockOf("get_approval_status")
    expect(block).toMatch(/readOnlyHint: true/)
    expect(block).toMatch(/db\.mcpApprovalRequest\.findUnique\(/)
    expect(block).toMatch(/resultMessage: request\.resultMessage/)
  })
})
