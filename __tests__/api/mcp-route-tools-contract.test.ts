import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

// Static source-text contract checks for the MCP audit's P0 fixes
// (chatgpt.md): no tool should claim to be "the first step" except
// get_agent_playbook, and the tools driving the deploy/revise flow must
// declare outputSchema and the new optional params. These assert against
// the route file's own source rather than importing/executing it: the
// module registers all its tools through `createMcpHandler`'s factory,
// which the underlying SDK only invokes lazily per-request — there is no
// reliable way to mock that interception in this test environment, so a
// behavioral/integration test would exercise nothing. A source-text check
// still catches the regression that matters here: someone reverting the
// description text or removing a field.

const routeSource = readFileSync(
  join(__dirname, "../../src/app/api/mcp/[[...transport]]/route.ts"),
  "utf-8",
)

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
      "get_deployment_status",
      "get_deployment_source",
      "get_deployment_build_logs",
      "verify_deployment_url",
      "start_website_build",
      "get_build_run",
    ]) {
      const toolBlock = routeSource.slice(routeSource.indexOf(`"${tool}",`))
      const nextRegisterTool = toolBlock.indexOf("server.registerTool(", 1)
      const scoped = nextRegisterTool === -1 ? toolBlock : toolBlock.slice(0, nextRegisterTool)
      expect(scoped, `${tool} should be registered`).toMatch(new RegExp(`"${tool}"`))
      expect(scoped, `${tool} should declare an outputSchema`).toMatch(/outputSchema:/)
    }
  })

  it("get_deployment_status's deploymentId is optional, with a fallback to the latest deployment", () => {
    const toolBlock = routeSource.slice(routeSource.indexOf('"get_deployment_status",'))
    const scoped = toolBlock.slice(0, toolBlock.indexOf("server.registerTool(", 1))
    expect(scoped).toMatch(/deploymentId:\s*z\.string\(\)\.optional\(\)/)
    expect(scoped).toMatch(/resolveDeploymentId/)
  })

  it("resolveDeploymentId (shared by get_deployment_status/source/build_logs) falls back to getLatestDeployment", () => {
    const fnBlock = routeSource.slice(routeSource.indexOf("async function resolveDeploymentId"))
    const scoped = fnBlock.slice(0, fnBlock.indexOf("\n}\n"))
    expect(scoped).toMatch(/getLatestDeployment/)
  })

  it("deploy_to_sacms exposes intent/confirmOverwrite and a TARGET_CONFLICT guard", () => {
    const toolBlock = routeSource.slice(routeSource.indexOf('"deploy_to_sacms",'))
    const scoped = toolBlock.slice(0, toolBlock.indexOf("server.registerTool(", 1))
    expect(scoped).toMatch(/intent:\s*z\.enum/)
    expect(scoped).toMatch(/confirmOverwrite:\s*z\.boolean\(\)\.optional\(\)/)
    expect(scoped).toMatch(/TARGET_CONFLICT/)
  })

  it("registers get_deployment_source as a new tool reading back real deployed files, encoding included", () => {
    const toolBlock = routeSource.slice(routeSource.indexOf('"get_deployment_source",'))
    const scoped = toolBlock.slice(0, toolBlock.indexOf("server.registerTool(", 1))
    expect(scoped).toMatch(/deploymentId:\s*z\.string\(\)\.optional\(\)/)
    expect(scoped).toMatch(/getDeploymentFiles/)
    expect(scoped).toMatch(/encoding:\s*z\.enum\(\["utf-8", "base64"\]\)/)
  })

  it("deploy_to_sacms's files accept a per-file encoding for binary assets", () => {
    const toolBlock = routeSource.slice(routeSource.indexOf('"deploy_to_sacms",'))
    const scoped = toolBlock.slice(0, toolBlock.indexOf("server.registerTool(", 1))
    expect(scoped).toMatch(/encoding:\s*z\.enum\(\["utf-8", "base64"\]\)\.optional\(\)/)
  })

  it("registers get_deployment_build_logs reading real Vercel build output", () => {
    const toolBlock = routeSource.slice(routeSource.indexOf('"get_deployment_build_logs",'))
    const scoped = toolBlock.slice(0, toolBlock.indexOf("server.registerTool(", 1))
    expect(scoped).toMatch(/deploymentId:\s*z\.string\(\)\.optional\(\)/)
    expect(scoped).toMatch(/resolveDeploymentId/)
    expect(scoped).toMatch(/getDeploymentBuildLogs/)
  })

  it("registers verify_deployment_url to actually fetch the live site, not just trust Vercel's status", () => {
    const toolBlock = routeSource.slice(routeSource.indexOf('"verify_deployment_url",'))
    const scoped = toolBlock.slice(0, toolBlock.indexOf("server.registerTool(", 1))
    expect(scoped).toMatch(/expectedText:\s*z\.string\(\)\.optional\(\)/)
    expect(scoped).toMatch(/safeFetch/)
    expect(scoped).toMatch(/containsExpectedText/)
  })

  it("registers start_website_build and get_build_run for a resumable entry point", () => {
    const startBlock = routeSource.slice(routeSource.indexOf('"start_website_build",'))
    const scopedStart = startBlock.slice(0, startBlock.indexOf("server.registerTool(", 1))
    expect(scopedStart).toMatch(/startOrResumeBuildRun/)
    expect(scopedStart).toMatch(/TARGET_CONFLICT|conflict/)
    // Deliberately doesn't claim to be "the first step" the same way
    // get_agent_playbook does — see the single-FIRST-claim test above.
    expect(scopedStart).not.toMatch(/call this first/i)

    const getBlock = routeSource.slice(routeSource.indexOf('"get_build_run",'))
    const scopedGet = getBlock.slice(0, getBlock.indexOf("server.registerTool(", 1))
    expect(scopedGet).toMatch(/getBuildRun/)
  })

  it("deploy_to_sacms and verify_deployment_url accept a runId to advance the build run", () => {
    for (const tool of ["deploy_to_sacms", "verify_deployment_url"]) {
      const toolBlock = routeSource.slice(routeSource.indexOf(`"${tool}",`))
      const scoped = toolBlock.slice(0, toolBlock.indexOf("server.registerTool(", 1))
      expect(scoped, `${tool} should accept runId`).toMatch(/runId:\s*z\.string\(\)\.optional\(\)/)
      expect(scoped, `${tool} should advance the build run`).toMatch(/advanceBuildRun/)
    }
  })
})
