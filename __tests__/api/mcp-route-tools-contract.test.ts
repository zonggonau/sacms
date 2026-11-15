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
    expect(scoped).toMatch(/safeFetch/)
    expect(scoped).toMatch(/containsExpectedText/)
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
    expect(scoped).toMatch(/matchesSignature/)
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
})
