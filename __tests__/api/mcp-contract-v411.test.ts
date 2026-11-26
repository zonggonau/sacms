import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

// Source-level contract checks for the 4.11.0 workspace MCP changes. The
// behaviour itself is covered where it runs; these keep the documented
// contracts from silently drifting back.
const read = (rel: string) => readFileSync(join(__dirname, "../..", rel), "utf-8")
const deploy = read("src/lib/mcp/workspace/deploy-tools.ts")
const platform = read("src/lib/mcp/workspace/platform-tools.ts")
const guidance = read("src/lib/mcp/workspace-guidance.ts")

describe("workspace MCP 4.11.0 contracts", () => {
  it("verify_deployment_url resolves the same deployment as get_deployment_status and reports the one production serves", () => {
    expect(deploy).toMatch(/liveBase = tenant\.vercelDeploymentUrl \|\| latest\?\.productionUrl/)
    expect(deploy).toMatch(/servedDeploymentId: servedId/)
    expect(deploy).toMatch(/READY only means the build finished/)
  })

  it("list_website_versions labels draft rows and documents the shared revision id", () => {
    expect(deploy).toMatch(/kind: z\.enum\(\["deployed", "draft"\]\)/)
    expect(deploy).toMatch(/baseSourceRevision to deploy_website_patch/)
    expect(deploy).toMatch(/It is not a Vercel deployment id/)
  })

  it("get_deployment_source reports whether it imported a snapshot", () => {
    expect(deploy).toMatch(/imported: z\.boolean\(\)\.optional\(\)/)
    expect(deploy).toMatch(/const structured = \{ deploymentId: resolved\.id, sourceRevision, source, imported/)
  })

  it("sync_dev_env needs its own env scope, not write", () => {
    expect(platform).toMatch(/hasScope\(auth, "env"\)\) return permissionDenied\("env"\)/)
  })

  it("call_external_api can restrict secret destinations to a workspace allowlist", () => {
    expect(deploy).toMatch(/DESTINATION_NOT_ALLOWED/)
    expect(deploy).toMatch(/_secretHostAllowlist/)
  })

  it("the playbook reads site-settings slugs from the workspace schema and documents template eligibility", () => {
    expect(guidance).toMatch(/Before writing any field, call .{1,6}get_single_type/)
    // Backticks are escaped in the TypeScript source, so match the words, not the markup.
    expect(guidance).toMatch(/apply_website_template.{1,6}with .{1,6}dryRun: true/)
    expect(guidance).toMatch(/default .{1,6}site-settings.{1,6} Single Type is excluded/)
  })
})
