import { describe, it, expect, vi } from "vitest"
import { readFileSync, readdirSync } from "fs"
import { join } from "path"
import { buildManifest } from "../../scripts/mcp-manifest.cjs"
import { WORKSPACE_TOOL_SCOPES } from "@/lib/mcp/workspace/tool-scopes"
import { withWorkspaceScopeGate } from "@/lib/mcp/workspace/scope-gate"
import { authContext } from "@/lib/mcp/workspace/context"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/database", () => ({ db: {}, getTenantDb: vi.fn() }))
vi.mock("@/lib/infrastructure/global-mcp-operations", () => ({ startBackgroundOperation: vi.fn() }))
vi.mock("@/lib/vercel-client", () => ({ getDeploymentStatus: vi.fn(), getLatestDeployment: vi.fn() }))
vi.mock("@/lib/infrastructure/mcp-build-run", () => ({ findOrClaimByIdempotencyKey: vi.fn(), isIdempotencyClaimStillInFlight: vi.fn() }))
vi.mock("@/lib/infrastructure/deployment-source-guard", () => ({ matchesSignature: vi.fn() }))
vi.mock("@/lib/safe-url", () => ({ safeFetch: vi.fn() }))
vi.mock("@/lib/infrastructure/hosting-plan", () => ({ isTenantPlanPaid: vi.fn() }))

const root = join(__dirname, "..", "..")
const manifest = buildManifest(root)

// Every workspace tool's source, same as the reference generator reads it.
const workspaceDir = join(root, "src/lib/mcp/workspace")
const source = [
  ...readdirSync(workspaceDir).filter((f) => f.endsWith(".ts")).map((f) => join(workspaceDir, f)),
  join(root, "src/lib/infrastructure/mcp-preview.ts"),
].map((f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n")).join("\n")

function blockFor(name: string) {
  const m = new RegExp(`registerTool\\(\\s*"${name}"`).exec(source)
  if (!m) return ""
  const rest = source.slice(m.index + m[0].length)
  const next = rest.search(/registerTool\(/)
  return next === -1 ? rest : rest.slice(0, next)
}

function fakeServer() {
  const registered = new Map<string, (...args: unknown[]) => unknown>()
  const server = {
    registerTool: vi.fn((name: string, _config: unknown, handler: (...args: unknown[]) => unknown) => {
      registered.set(name, handler)
    }),
  }
  return { server, registered }
}

function authWith(permissions: string[]) {
  return { tenantId: "t1", tenantSlug: "acme", tenantName: "Acme", permissions, plan: "pro", isPaid: true, isHostingPlanPaid: true }
}

describe("workspace MCP scope gate", () => {
  it("has exactly one scope entry per registered workspace tool", () => {
    expect(Object.keys(WORKSPACE_TOOL_SCOPES).sort()).toEqual([...manifest.workspace].sort())
  })

  it("agrees with each handler's own hasScope() checks", () => {
    for (const name of manifest.workspace) {
      const checked = [...new Set([...blockFor(name).matchAll(/hasScope\([^,]+,\s*"([a-z]+)"\)/g)].map((m) => m[1]))]
      if (checked.length === 0) continue
      expect(checked, `${name} checks scopes ${checked.join("|")} but the table says ${WORKSPACE_TOOL_SCOPES[name]}`).toContain(WORKSPACE_TOOL_SCOPES[name])
    }
  })

  it("requires write for promote_deployment, which previously had no scope check at all", () => {
    expect(WORKSPACE_TOOL_SCOPES.promote_deployment).toBe("write")
  })

  it("refuses a tool when the token lacks its scope, without running the handler", async () => {
    const { server, registered } = fakeServer()
    const gated = withWorkspaceScopeGate(server as never) as unknown as { registerTool: (...a: unknown[]) => unknown }
    const handler = vi.fn(async () => ({ content: [{ type: "text", text: "ran" }] }))
    gated.registerTool("delete_content_type", {}, handler)

    const result = await authContext.run(authWith(["read", "write"]) as never, () => registered.get("delete_content_type")!({}))

    expect(handler).not.toHaveBeenCalled()
    expect(result).toMatchObject({ isError: true })
    expect((result as { content: { text: string }[] }).content[0].text).toContain('"delete" permission')
  })

  it("runs the handler when the token has the scope, or full_access", async () => {
    const { server, registered } = fakeServer()
    const gated = withWorkspaceScopeGate(server as never) as unknown as { registerTool: (...a: unknown[]) => unknown }
    const handler = vi.fn(async () => ({ content: [{ type: "text", text: "ran" }] }))
    gated.registerTool("delete_content_type", {}, handler)
    const run = registered.get("delete_content_type")!

    await authContext.run(authWith(["delete"]) as never, () => run({}))
    await authContext.run(authWith(["full_access"]) as never, () => run({}))

    expect(handler).toHaveBeenCalledTimes(2)
  })

  it("leaves the handler's own UNAUTHORIZED answer in place when no auth is in scope", async () => {
    const { server, registered } = fakeServer()
    const gated = withWorkspaceScopeGate(server as never) as unknown as { registerTool: (...a: unknown[]) => unknown }
    const handler = vi.fn(async () => ({ content: [] }))
    gated.registerTool("get_content_type", {}, handler)

    await registered.get("get_content_type")!({})

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it("fails registration for a tool with no scope entry, so none can ship ungated", () => {
    const { server } = fakeServer()
    const gated = withWorkspaceScopeGate(server as never) as unknown as { registerTool: (...a: unknown[]) => unknown }

    expect(() => gated.registerTool("not_a_real_tool", {}, vi.fn())).toThrow(/no entry in WORKSPACE_TOOL_SCOPES/)
  })
})
