import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { resolveGlobalMcpScopes, requiredScopeForTool, GLOBAL_MCP_SCOPES } from "@/lib/mcp-global-scopes"

describe("resolveGlobalMcpScopes", () => {
  it("gives a legacy ['schema-template'] token full access so existing agents keep working", () => {
    expect(resolveGlobalMcpScopes(["schema-template"])).toEqual([...GLOBAL_MCP_SCOPES])
  })

  it("always adds read to any scoped token and drops unknown entries", () => {
    expect(resolveGlobalMcpScopes(["write", "bogus"])).toEqual(["read", "write"])
    expect(resolveGlobalMcpScopes(["demo"])).toEqual(["read", "demo"])
  })

  it("returns no scopes for a token with nothing recognisable — the caller rejects it", () => {
    expect(resolveGlobalMcpScopes([])).toEqual([])
    expect(resolveGlobalMcpScopes(null)).toEqual([])
    expect(resolveGlobalMcpScopes("schema-template")).toEqual([])
  })
})

describe("requiredScopeForTool", () => {
  it("maps read-only tools to read", () => {
    for (const tool of ["whoami", "get_approval_status", "list_schema_templates", "get_operation_status", "list_template_versions"]) {
      expect(requiredScopeForTool(tool), tool).toBe("read")
    }
  })

  it("maps demo-content tools to demo", () => {
    expect(requiredScopeForTool("save_demo_content_entry")).toBe("demo")
    expect(requiredScopeForTool("reset_demo_content")).toBe("demo")
  })

  it("every get_/list_ tool actually registered on the server is reachable with a read-only token", () => {
    const source = readFileSync(join(__dirname, "../../src/app/api/mcp/global-schema/[[...transport]]/route.ts"), "utf-8")
    const registered = [...source.matchAll(/server\.registerTool\(\s*"([a-z_]+)"/g)].map((m) => m[1])
    expect(registered.length).toBeGreaterThan(20)
    for (const tool of registered.filter((t) => /^(get|list)_/.test(t) || t === "whoami")) {
      expect(requiredScopeForTool(tool), tool).toBe("read")
    }
  })

  it("fails closed: any tool not explicitly listed needs write", () => {
    expect(requiredScopeForTool("create_website_template")).toBe("write")
    expect(requiredScopeForTool("some_future_tool")).toBe("write")
  })
})
