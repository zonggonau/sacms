import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { buildManifest } from "../../scripts/mcp-manifest.cjs"
import { GLOBAL_MCP_VERSION } from "@/lib/mcp/global-guidance"
import { WORKSPACE_MCP_VERSION } from "@/lib/mcp/workspace-guidance"

const root = join(__dirname, "..", "..")
const committed = JSON.parse(readFileSync(join(root, "docs/mcp/tool-manifest.json"), "utf8"))
const current = buildManifest(root)

describe("MCP tool manifest", () => {
  it("matches the tools the servers register; regenerate with `node scripts/mcp-manifest.cjs` after a tool change", () => {
    expect(current).toEqual(committed)
  })

  it("the global server exposes get_global_operation_status and no longer the removed get_operation_status alias", () => {
    expect(current.global).toContain("get_global_operation_status")
    expect(current.global).not.toContain("get_operation_status")
  })

  it("the canonical workspace release tools are all registered", () => {
    for (const name of ["start_preview", "get_preview_url", "read_preview_file", "apply_preview_changes", "save_preview_changes", "get_preview_logs", "extend_preview"]) {
      expect(current.workspace).toContain(name)
    }
  })

  it("version constants are semver strings the servers report", () => {
    expect(GLOBAL_MCP_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    expect(WORKSPACE_MCP_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
