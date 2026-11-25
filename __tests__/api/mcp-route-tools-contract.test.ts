import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

// Static source-text contract checks for the MCP audit's P0 fixes
// (chatgpt.md, chatgpt1.md): no tool should claim to be "the first step"
// except get_agent_playbook, and the tools driving the deploy/revise flow
// must declare outputSchema and the new optional params. These assert
// against the route file's own source rather than importing/executing it:
// the module registers all its tools through `createMcpHandler`'s factory,
// which the underlying SDK only invokes lazily per-request — there is no
// reliable way to mock that interception in this test environment, so a
// behavioral/integration test would exercise nothing. A source-text check
// still catches the regression that matters here: someone reverting the
// description text or removing a field.

const routeSource = readFileSync(
  join(__dirname, "../../src/app/api/mcp/[[...transport]]/route.ts"),
  "utf-8",
)

/**
 * Locates a tool's ACTUAL `server.registerTool("name", { ... })` call and
 * returns just that block's source, up to the next registration. A plain
 * `indexOf('"name",')` is not safe once a tool's name can also appear as a
 * plain string value elsewhere (e.g. start_website_build's `nextAction`
 * referencing `"get_deployment_source"` as a suggested next tool to call) —
 * that would find the wrong occurrence and scope the slice incorrectly.
 * Anchoring on the exact registration indentation avoids that.
 */
function toolBlockOf(tool: string): string {
  const anchor = `server.registerTool(\n      "${tool}",`
  const start = routeSource.indexOf(anchor)
  expect(start, `${tool} should be registered via server.registerTool`).toBeGreaterThan(-1)
  const rest = routeSource.slice(start + anchor.length)
  const nextRegisterTool = rest.indexOf("server.registerTool(")
  return nextRegisterTool === -1 ? rest : rest.slice(0, nextRegisterTool)
}

describe("MCP workspace server route — source contract", () => {
  it("no longer has get_full_schema claiming to be the first step to call", () => {
    expect(routeSource).not.toMatch(/Call this FIRST/i)
  })

  it("get_agent_playbook remains the one tool that says to read it first", () => {
    const firstMatches = routeSource.match(/read this first|call this first/gi) || []
    expect(firstMatches).toHaveLength(1)
  })

  it("declares an outputSchema on every tool driving the deploy/verify flow", () => {
    for (const tool of [
      "get_full_schema",
      "list_deployment_env",
      "deploy_to_sacms",
      "deploy_website_patch",
      "list_website_versions",
      "rollback_website",
      "get_deployment_status",
      "get_deployment_source",
      "get_deployment_build_logs",
      "verify_deployment_url",
      "start_website_build",
      "get_build_run",
    ]) {
      expect(toolBlockOf(tool), `${tool} should declare an outputSchema`).toMatch(/outputSchema:/)
    }
  })

  it("get_deployment_status's deploymentId is optional, with a fallback to the latest deployment", () => {
    const scoped = toolBlockOf("get_deployment_status")
    expect(scoped).toMatch(/deploymentId:\s*z\.string\(\)\.optional\(\)/)
    expect(scoped).toMatch(/resolveDeploymentId/)
  })

  it("resolveDeploymentId (shared by get_deployment_status/source/build_logs) falls back to getLatestDeployment", () => {
    const fnBlock = routeSource.slice(routeSource.indexOf("async function resolveDeploymentId"))
    const scoped = fnBlock.slice(0, fnBlock.indexOf("\n}\n"))
    expect(scoped).toMatch(/getLatestDeployment/)
  })

  it("deploy_to_sacms exposes intent/confirmOverwrite and a TARGET_CONFLICT guard", () => {
    const scoped = toolBlockOf("deploy_to_sacms")
    expect(scoped).toMatch(/intent:\s*z\.enum/)
    expect(scoped).toMatch(/confirmOverwrite:\s*z\.boolean\(\)\.optional\(\)/)
    expect(scoped).toMatch(/TARGET_CONFLICT/)
  })

  it("registers get_deployment_source as a new tool reading back real deployed files, encoding included", () => {
    const scoped = toolBlockOf("get_deployment_source")
    expect(scoped).toMatch(/deploymentId:\s*z\.string\(\)\.optional\(\)/)
    expect(scoped).toMatch(/getDeploymentFiles/)
    expect(scoped).toMatch(/encoding:\s*z\.enum\(\["utf-8", "base64"\]\)/)
  })

  it("deploy_to_sacms's files accept a per-file encoding for binary assets", () => {
    const scoped = toolBlockOf("deploy_to_sacms")
    expect(scoped).toMatch(/encoding:\s*z\.enum\(\["utf-8", "base64"\]\)\.optional\(\)/)
  })

  it("registers get_deployment_build_logs reading real Vercel build output", () => {
    const scoped = toolBlockOf("get_deployment_build_logs")
    expect(scoped).toMatch(/deploymentId:\s*z\.string\(\)\.optional\(\)/)
    expect(scoped).toMatch(/resolveDeploymentId/)
    expect(scoped).toMatch(/getDeploymentBuildLogs/)
  })

  it("registers verify_deployment_url to actually fetch the live site, not just trust Vercel's status", () => {
    const scoped = toolBlockOf("verify_deployment_url")
    expect(scoped).toMatch(/expectedText:\s*z\.string\(\)\.optional\(\)/)
    expect(scoped).toMatch(/runHttpChecks/)
  })

  it("runHttpChecks (shared by verify_deployment_url and promote_deployment) actually fetches via the SSRF-safe client and checks binary signatures", () => {
    expect(routeSource).toMatch(/async function runHttpChecks/)
    const fnStart = routeSource.indexOf("async function runHttpChecks")
    const fnBlock = routeSource.slice(fnStart, routeSource.indexOf("\n}\n", fnStart))
    expect(fnBlock).toMatch(/safeFetch/)
    expect(fnBlock).toMatch(/matchesSignature/)
    expect(fnBlock).toMatch(/containsExpectedText/)
  })

  it("registers start_website_build and get_build_run for a resumable entry point", () => {
    const scopedStart = toolBlockOf("start_website_build")
    expect(scopedStart).toMatch(/startOrResumeBuildRun/)
    expect(scopedStart).toMatch(/TARGET_CONFLICT|conflict/)
    // Deliberately doesn't claim to be "the first step" the same way
    // get_agent_playbook does — see the single-FIRST-claim test above.
    expect(scopedStart).not.toMatch(/call this first/i)

    const scopedGet = toolBlockOf("get_build_run")
    expect(scopedGet).toMatch(/getBuildRun/)
  })

  it("deploy_to_sacms and verify_deployment_url accept a runId to advance the build run", () => {
    for (const tool of ["deploy_to_sacms", "verify_deployment_url"]) {
      const scoped = toolBlockOf(tool)
      expect(scoped, `${tool} should accept runId`).toMatch(/runId:\s*z\.string\(\)\.optional\(\)/)
      expect(scoped, `${tool} should advance the build run`).toMatch(/advanceBuildRun/)
    }
  })

  // ── chatgpt1.md round ────────────────────────────────────────────────────

  it("get_deployment_status returns productionUrl and deploymentUrl as separate fields, not a single collapsed url", () => {
    const scoped = toolBlockOf("get_deployment_status")
    expect(scoped).toMatch(/productionUrl:\s*z\.string\(\)\.nullable\(\)/)
    expect(scoped).toMatch(/deploymentUrl:\s*z\.string\(\)/)
  })

  it("deploy_to_sacms persists a source snapshot and returns sourceRevision/productionUrl/deploymentUrl", () => {
    const scoped = toolBlockOf("deploy_to_sacms")
    expect(scoped).toMatch(/saveDeploymentSource/)
    expect(scoped).toMatch(/sourceRevision:\s*z\.string\(\)\.optional\(\)/)
    expect(scoped).toMatch(/productionUrl:\s*z\.string\(\)\.optional\(\)/)
    expect(scoped).toMatch(/deploymentUrl:\s*z\.string\(\)\.optional\(\)/)
  })

  it("get_deployment_source prefers a persisted snapshot and supports paths/manifestOnly", () => {
    const scoped = toolBlockOf("get_deployment_source")
    expect(scoped).toMatch(/getLatestDeploymentSource|getDeploymentSourceByDeploymentId/)
    expect(scoped).toMatch(/paths:\s*z\.array\(z\.string\(\)\)\.optional\(\)/)
    expect(scoped).toMatch(/manifestOnly:\s*z\.boolean\(\)\.optional\(\)/)
    expect(scoped).toMatch(/checksum:\s*z\.string\(\)/)
    expect(scoped).toMatch(/sourceRevision:\s*z\.string\(\)\.optional\(\)/)
  })

  it("registers deploy_website_patch with baseSourceRevision conflict detection", () => {
    const scoped = toolBlockOf("deploy_website_patch")
    expect(scoped).toMatch(/baseSourceRevision:\s*z\.string\(\)/)
    expect(scoped).toMatch(/changedFiles:/)
    expect(scoped).toMatch(/deletedFiles:/)
    expect(scoped).toMatch(/getDeploymentSourceByRevision/)
    expect(scoped).toMatch(/CONFLICT/)
  })

  it("registers list_website_versions and rollback_website", () => {
    expect(toolBlockOf("list_website_versions")).toMatch(/listDeploymentSources/)

    const scopedRollback = toolBlockOf("rollback_website")
    expect(scopedRollback).toMatch(/sourceRevision:\s*z\.string\(\)/)
    expect(scopedRollback).toMatch(/getDeploymentSourceByRevision/)
  })

  it("verify_deployment_url supports multiple required checks and documents the HTTP-only limitation", () => {
    const scoped = toolBlockOf("verify_deployment_url")
    expect(scoped).toMatch(/checks:\s*z\.array/)
    expect(scoped).toMatch(/KNOWN LIMITATION/)
    expect(scoped).toMatch(/ALL.*must pass/i)
  })

  it("start_website_build returns a structured nextAction, intent-aware for a revision", () => {
    const scoped = toolBlockOf("start_website_build")
    expect(scoped).toMatch(/nextAction:/)
    expect(scoped).toMatch(/get_deployment_source/)
  })

  it("get_api_info's sample code reads the real injected env var name, not a hardcoded SACMS_TOKEN", () => {
    const scoped = toolBlockOf("get_api_info")
    expect(scoped).not.toMatch(/SACMS_TOKEN/)
    expect(scoped).toMatch(/SYSTEM_ENV_VARS/)
    expect(scoped).toMatch(/tokenEnvKey/)
  })

  // ── chatgpt2.md round ────────────────────────────────────────────────────

  it("get_deployment_source reports missingPaths and auto-imports a complete live read into persisted source history", () => {
    const scoped = toolBlockOf("get_deployment_source")
    expect(scoped).toMatch(/missingPaths/)
    expect(scoped).toMatch(/saveDeploymentSource/)
    expect(scoped).toMatch(/SOURCE_INCOMPLETE/)
  })

  it("deploy_website_patch's NOT_FOUND-for-missing-base now surfaces as SOURCE_IMPORT_REQUIRED, and re-checks for a concurrent change right before persisting", () => {
    const scoped = toolBlockOf("deploy_website_patch")
    expect(scoped).toMatch(/SOURCE_IMPORT_REQUIRED/)
    expect(scoped).toMatch(/concurrentChangeDetected/)
    expect(scoped).toMatch(/CONCURRENT_CHANGE_DURING_DEPLOY/)
  })

  it("deploy_to_sacms and deploy_website_patch accept idempotencyKey and resolve it via resolveIdempotency", () => {
    for (const tool of ["deploy_to_sacms", "deploy_website_patch"]) {
      const scoped = toolBlockOf(tool)
      expect(scoped, `${tool} should accept idempotencyKey`).toMatch(/idempotencyKey:\s*z\.string\(\)\.optional\(\)/)
      expect(scoped, `${tool} should resolve idempotency`).toMatch(/resolveIdempotency/)
      expect(scoped, `${tool} should handle an in-progress replay`).toMatch(/DEPLOY_IN_PROGRESS/)
    }
  })

  it("get_build_run accepts an idempotencyKey as an alternative lookup to runId", () => {
    const scoped = toolBlockOf("get_build_run")
    expect(scoped).toMatch(/idempotencyKey:\s*z\.string\(\)\.optional\(\)/)
  })

  it("verify_deployment_url binds to a specific deploymentId and flags PRODUCTION_VERSION_MISMATCH instead of a false pass", () => {
    const scoped = toolBlockOf("verify_deployment_url")
    expect(scoped).toMatch(/deploymentId:\s*z\.string\(\)\.optional\(\)/)
    expect(scoped).toMatch(/PRODUCTION_VERSION_MISMATCH/)
    expect(scoped).toMatch(/getLatestDeployment/)
  })

  // ── chatgpt3.md round ────────────────────────────────────────────────────

  it("deploy_to_sacms, deploy_website_patch and rollback_website return RATE_LIMITED with retryAfterSeconds instead of a bare error", () => {
    for (const tool of ["deploy_to_sacms", "deploy_website_patch", "rollback_website"]) {
      const scoped = toolBlockOf(tool)
      expect(scoped, `${tool} should return code RATE_LIMITED`).toMatch(/code:\s*"RATE_LIMITED"/)
      expect(scoped, `${tool} should return retryAfterSeconds`).toMatch(/retryAfterSeconds/)
    }
  })

  it("deploy_to_sacms and deploy_website_patch release their idempotency claim on a rate-limit rejection, so a same-key retry isn't misread as still in progress", () => {
    for (const tool of ["deploy_to_sacms", "deploy_website_patch"]) {
      const scoped = toolBlockOf(tool)
      expect(scoped, `${tool} should mark the claimed run failed on rate limit`).toMatch(/stage:\s*"failed",\s*lastError:\s*"RATE_LIMITED"/)
    }
  })

  it("deploy_website_patch and rollback_website refuse a corrupted stored revision (SOURCE_CORRUPTED) instead of redeploying it", () => {
    const patch = toolBlockOf("deploy_website_patch")
    expect(patch).toMatch(/findSourceIssues\(base\.files\)/)
    expect(patch).toMatch(/SOURCE_CORRUPTED/)

    const rollback = toolBlockOf("rollback_website")
    expect(rollback).toMatch(/findSourceIssues\(target\.files\)/)
    expect(rollback).toMatch(/SOURCE_CORRUPTED/)
  })

  it("get_deployment_source re-validates a persisted snapshot and reports invalidAssets/SOURCE_INVALID/SOURCE_REPAIRED/SOURCE_NEEDS_REIMPORT", () => {
    const scoped = toolBlockOf("get_deployment_source")
    expect(scoped).toMatch(/findSourceIssues\(persistedRaw\.files\)/)
    expect(scoped).toMatch(/invalidAssets/)
    expect(scoped).toMatch(/SOURCE_INVALID/)
    expect(scoped).toMatch(/SOURCE_REPAIRED/)
    expect(scoped).toMatch(/SOURCE_NEEDS_REIMPORT/)
  })

  it("verify_deployment_url's checks accept expectedSignature/expectedChecksum/expectedContentType for binary assets, not just an HTTP 200", () => {
    const scoped = toolBlockOf("verify_deployment_url")
    expect(scoped).toMatch(/expectedSignature:\s*z\.enum/)
    expect(scoped).toMatch(/expectedChecksum:\s*z\.string\(\)\.optional\(\)/)
    expect(scoped).toMatch(/expectedContentType:\s*z\.string\(\)\.optional\(\)/)
    expect(scoped).toMatch(/runHttpChecks/)
  })

  it("verify_deployment_url clears lastError when a re-verification succeeds instead of leaving a stale error on a done run", () => {
    const scoped = toolBlockOf("verify_deployment_url")
    expect(scoped).toMatch(/stage:\s*"done",\s*lastError:\s*null/)
  })

  // ── 4th-party findings round (encoding normalization, intent sync) ───────

  it("deploy_to_sacms normalizes a missing per-file encoding to utf-8 before both deploying and persisting", () => {
    const scoped = toolBlockOf("deploy_to_sacms")
    expect(scoped).toMatch(/normalizedFiles/)
    expect(scoped).toMatch(/f\.encoding \|\| \("utf-8" as const\)/)
  })

  it("deploy_website_patch normalizes carried-over base files' encoding, not just changedFiles", () => {
    const scoped = toolBlockOf("deploy_website_patch")
    expect(scoped).toMatch(/base\.files\.map\(\(f\) => \[f\.name, \{ \.\.\.f, encoding: f\.encoding \|\| \("utf-8" as const\) \}\]/)
  })

  it("rollback_website normalizes the restored revision's encoding before redeploying and re-persisting it", () => {
    const scoped = toolBlockOf("rollback_website")
    expect(scoped).toMatch(/normalizedTargetFiles/)
  })

  it("get_deployment_source's persisted branch defaults a missing encoding to utf-8 on read-back of an old revision", () => {
    const scoped = toolBlockOf("get_deployment_source")
    expect(scoped).toMatch(/encoding: f\.encoding \|\| "utf-8"/)
  })

  // ── richText/markdown rendering-contract finding ──────────────────────────

  it("get_agent_playbook warns richText needs sanitized dangerouslySetInnerHTML and markdown needs a Markdown renderer, not plain-text interpolation", () => {
    expect(routeSource).toMatch(/richText.*dangerouslySetInnerHTML/)
    expect(routeSource).toMatch(/markdown.*Markdown renderer/i)
  })

  // ── chatgpt5.md round — error-contract consistency ────────────────────────

  it("every get_component/get_webhook not-found response sets isError and a consistent NOT_FOUND code (chatgpt5.md P1 — get_component returned plain 'not found' text with no isError at all)", () => {
    for (const tool of ["get_component", "update_component", "delete_component", "get_webhook", "update_webhook", "delete_webhook", "test_webhook"]) {
      const scoped = toolBlockOf(tool)
      expect(scoped, `${tool} should set isError on its not-found path`).toMatch(/not found\.`[^}]*\}\],\s*structuredContent: \{ ok: false, code: "NOT_FOUND"/)
    }
  })

  it("content-type/single-type/content-entry not-found responses also carry a consistent NOT_FOUND code", () => {
    for (const tool of ["get_content_type", "update_content_type", "delete_content_type", "query_content", "get_content_entry", "update_content_entry", "delete_content_entry", "update_single_type_content", "update_single_type", "delete_single_type", "get_single_type"]) {
      const scoped = toolBlockOf(tool)
      expect(scoped, `${tool} should carry code: "NOT_FOUND"`).toMatch(/code: "NOT_FOUND"/)
    }
  })

  it("create_webhook and update_webhook's SSRF-rejected URL response sets isError too, not just a bare error message", () => {
    for (const tool of ["create_webhook", "update_webhook"]) {
      const scoped = toolBlockOf(tool)
      expect(scoped, `${tool} should mark a rejected webhook URL isError`).toMatch(/Webhook URL rejected:[\s\S]*?\}\], isError: true/)
    }
  })

  // ── chatgpt5.md round — tenant isolation (test-coverage gap, not a found leak) ─

  it("every get-by-id/slug tool scopes its lookup to auth.tenantId, so a valid token for tenant A structurally cannot reach tenant B's row by guessing an id", () => {
    for (const tool of ["get_content_entry", "get_component", "get_webhook", "get_single_type", "get_content_type"]) {
      const scoped = toolBlockOf(tool)
      expect(scoped, `${tool} should scope its lookup by auth.tenantId`).toMatch(/auth\.tenantId/)
    }
  })

  it("call_external_api and create_webhook/update_webhook route every outbound URL through the SSRF guard (safeFetch/assertPublicUrl), never a bare fetch", () => {
    const callExternal = toolBlockOf("call_external_api")
    expect(callExternal).toMatch(/safeFetch\(/)

    for (const tool of ["create_webhook", "update_webhook"]) {
      const scoped = toolBlockOf(tool)
      expect(scoped, `${tool} should validate the URL via assertPublicUrl`).toMatch(/assertPublicUrl/)
    }
  })

  // ── chatgpt5.md round — staged deploy / promote (P0) ──────────────────────

  it("deploy_to_sacms and deploy_website_patch deploy to a STAGING candidate, not production directly", () => {
    for (const tool of ["deploy_to_sacms", "deploy_website_patch"]) {
      const scoped = toolBlockOf(tool)
      expect(scoped, `${tool} should deploy with target: "staging"`).toMatch(/deployToVercel\([^)]*"staging"\)/)
      expect(scoped, `${tool} should signal AWAITING_PROMOTION`).toMatch(/AWAITING_PROMOTION/)
      expect(scoped, `${tool} should NOT write vercelDeploymentUrl itself`).not.toMatch(/vercelDeploymentUrl: result\.url/)
    }
  })

  it("keeps rollback in staging and hands production release to Hosting", () => {
    expect(toolBlockOf("rollback_website")).toMatch(/deployToVercel\([^)]*"staging"\)/)
    expect(toolBlockOf("promote_deployment")).toContain("DASHBOARD_REQUIRED")
    expect(routeSource).not.toContain("await promoteDeployment(")
  })

  it("registers get_deployment_runtime_logs as a separate tool from get_deployment_build_logs, for diagnosing a runtime HTTP 500 a build log would never show", () => {
    const scoped = toolBlockOf("get_deployment_runtime_logs")
    expect(scoped).toMatch(/getRuntimeLogs\(/)
    expect(scoped).toMatch(/resolveDeploymentId/)
    expect(scoped).toMatch(/errorLines/)
    expect(scoped).toMatch(/truncated/)
  })

  it("get_agent_playbook and the server's top-level instructions both describe the stage -> promote flow, not a direct-to-production one", () => {
    expect(routeSource).toMatch(/promote_deployment/)
    const playbookMatches = routeSource.match(/promote_deployment/g) || []
    expect(playbookMatches.length).toBeGreaterThan(2) // appears in the playbook text, the instructions string, AND the tool's own registration
  })

  // ── chatgpt6.md round ──────────────────────────────────────────────────────

  it("test_webhook reports delivered/httpStatus distinctly from the tool call's own success, and flags isError on a non-2xx response", () => {
    const scoped = toolBlockOf("test_webhook")
    expect(scoped).toMatch(/delivered: z\.boolean\(\)/)
    expect(scoped).toMatch(/httpStatus: z\.number\(\)\.optional\(\)/)
    expect(scoped).toMatch(/const delivered = res\.ok/)
    expect(scoped).toMatch(/isError: !delivered/)
  })

  it("reorder_content_type_groups' underlying service uses the interactive $transaction callback form, never the array form that strips PrismaPromise branding on a dedicated-tenant Proxy client", () => {
    const groupServiceSource = readFileSync(
      join(__dirname, "../../src/lib/content-type-group-service.ts"),
      "utf-8",
    )
    const fnStart = groupServiceSource.indexOf("export async function reorderContentTypeGroups")
    const fnBlock = groupServiceSource.slice(fnStart, groupServiceSource.indexOf("\n}\n", fnStart))
    expect(fnBlock).toMatch(/\$transaction\(async/)
    expect(fnBlock).not.toMatch(/\$transaction\(\s*orderedIds\.map/)
  })

  // ── chatgpt.md round (site-settings follow-up): richText/markdown values
  // kept rendering as literal tags/raw syntax on generated frontends even
  // though the rule already existed in list_field_types and the agent
  // playbook — both require the agent to remember a separate earlier call.
  // get_content_entry/get_single_type now attach a _renderHints entry
  // directly alongside the field values themselves, in the same response.

  it("get_content_entry fetches the content type's schemaFields and attaches _renderHints next to the field values", () => {
    const scoped = toolBlockOf("get_content_entry")
    expect(scoped).toMatch(/schemaFields:\s*true/)
    expect(scoped).toMatch(/buildRenderHints\(entry\.contentType\.schemaFields\)/)
    expect(scoped).toMatch(/_renderHints:\s*renderHints/)
  })

  it("get_single_type attaches _renderHints computed from its own schemaFields, alongside the returned data", () => {
    const scoped = toolBlockOf("get_single_type")
    expect(scoped).toMatch(/buildRenderHints\(st\.schemaFields\)/)
    expect(scoped).toMatch(/_renderHints:\s*renderHints/)
  })

  it("the server's top-level instructions also warn about richText/markdown rendering, not just a tool description buried deeper", () => {
    const instructionsStart = routeSource.indexOf("instructions:")
    const instructionsBlock = routeSource.slice(instructionsStart, instructionsStart + 4000)
    expect(instructionsBlock).toMatch(/richText field's value is raw HTML/)
    expect(instructionsBlock).toMatch(/_renderHints/)
  })

  // ── check_sdk_availability: @sacms/sdk is an ordinary npm package, so its
  // availability can never be asserted statically from inside this server —
  // it must be live-checked against the real registry before an agent is
  // told to install/use it.

  it("check_sdk_availability live-checks the npm registry and never hardcodes a published claim", () => {
    const scoped = toolBlockOf("check_sdk_availability")
    expect(scoped).toMatch(/registry\.npmjs\.org\/\$\{packageName\}/)
    expect(scoped).toMatch(/outputSchema:/)
    expect(scoped).toMatch(/available:\s*false/)
    expect(scoped).toMatch(/available:\s*true/)
  })

  it("check_sdk_availability's quick-start snippet uses the real resolved origin and tenant slug, not placeholders", () => {
    const scoped = toolBlockOf("check_sdk_availability")
    expect(scoped).toMatch(/resolveApiOrigin/)
    expect(scoped).toMatch(/auth\.tenantSlug/)
  })

  it("get_agent_playbook and the top-level instructions both point to check_sdk_availability", () => {
    const playbookBlock = toolBlockOf("get_agent_playbook")
    expect(playbookBlock).toMatch(/check_sdk_availability/)
    const instructionsStart = routeSource.indexOf("instructions:")
    const instructionsBlock = routeSource.slice(instructionsStart, instructionsStart + 4000)
    expect(instructionsBlock).toMatch(/check_sdk_availability/)
  })

  // ── Kabar Nusa report: apply_website_template — applying a catalog
  // Website Template used to be dashboard-only ("Terapkan"), no MCP path.

  it("apply_website_template reuses the shared apply-website-template lib instead of a second copy of the apply logic", () => {
    const scoped = toolBlockOf("apply_website_template")
    expect(scoped).toMatch(/applyWebsiteTemplateToTenant/)
    expect(scoped).toMatch(/import\("@\/lib\/infrastructure\/apply-website-template"\)/)
  })

  it("apply_website_template gates on write scope and the Pro/Business plan rule before touching anything", () => {
    const scoped = toolBlockOf("apply_website_template")
    expect(scoped).toMatch(/hasScope\(auth, "write"\)/)
    expect(scoped).toMatch(/canUseWebsiteTemplates\(auth\.plan\)/)
    expect(scoped.indexOf("canUseWebsiteTemplates(auth.plan)")).toBeLessThan(scoped.indexOf("applyWebsiteTemplateToTenant("))
  })

  it("apply_website_template only matches published templates and declares a union outputSchema for the ok/error cases", () => {
    const scoped = toolBlockOf("apply_website_template")
    expect(scoped).toMatch(/published: true/)
    expect(scoped).toMatch(/z\.union\(/)
    expect(scoped).toMatch(/WORKSPACE_NOT_EMPTY/)
  })

  it("get_agent_playbook's Phase 0 offers apply_website_template as the catalog-template alternative to building from scratch", () => {
    const playbookBlock = toolBlockOf("get_agent_playbook")
    expect(playbookBlock).toMatch(/apply_website_template/)
  })

  it("defines resolveSubdomainLabel (read-only — never generates a token for an existing tenant) and every deployToVercel call site uses it instead of the raw tenant slug", () => {
    expect(routeSource).toMatch(/async function resolveSubdomainLabel\(/)
    const occurrences = routeSource.match(/deployToVercel\([^)]*\bsubdomainLabel\b[^)]*\)/g) || []
    expect(occurrences.length).toBe(3) // deploy_to_sacms, deploy_website_patch, rollback_website
    expect(routeSource).not.toMatch(/deployToVercel\([^)]*\bauth\.tenantSlug\b[^)]*\)/)
  })
})

describe("sync_dev_env — local .env for a downloaded project", () => {
  it("builds the env from the same resolver deploy_to_sacms uses, not a separately maintained setting", () => {
    const block = toolBlockOf("sync_dev_env")
    expect(block).toMatch(/resolveFrontendEnv\(auth\.tenantId, auth\.tenantSlug, resolveApiOrigin\(\)\)/)
    expect(block).toMatch(/renderDotEnv\(env\)/)
    expect(block).not.toMatch(/_dev_env_config/)
    expect(block).not.toMatch(/sacms\.cloud\/api/)
  })

  it("requires write scope, since the returned SACMS_API_KEY can write over REST", () => {
    const block = toolBlockOf("sync_dev_env")
    expect(block).toMatch(/if \(!hasScope\(auth, "write"\)\) return permissionDenied\("write"\)/)
    expect(block.indexOf('hasScope(auth, "write")')).toBeLessThan(block.indexOf("resolveFrontendEnv("))
  })
})
