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
    for (const tool of ["get_full_schema", "list_deployment_env", "deploy_to_sacms", "get_deployment_status", "get_deployment_source"]) {
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
    expect(scoped).toMatch(/getLatestDeployment/)
  })

  it("deploy_to_sacms exposes intent/confirmOverwrite and a TARGET_CONFLICT guard", () => {
    const toolBlock = routeSource.slice(routeSource.indexOf('"deploy_to_sacms",'))
    const scoped = toolBlock.slice(0, toolBlock.indexOf("server.registerTool(", 1))
    expect(scoped).toMatch(/intent:\s*z\.enum/)
    expect(scoped).toMatch(/confirmOverwrite:\s*z\.boolean\(\)\.optional\(\)/)
    expect(scoped).toMatch(/TARGET_CONFLICT/)
  })

  it("registers get_deployment_source as a new tool reading back real deployed files", () => {
    const toolBlock = routeSource.slice(routeSource.indexOf('"get_deployment_source",'))
    const scoped = toolBlock.slice(0, toolBlock.indexOf("server.registerTool(", 1))
    expect(scoped).toMatch(/deploymentId:\s*z\.string\(\)\.optional\(\)/)
    expect(scoped).toMatch(/getDeploymentFiles/)
  })
})
