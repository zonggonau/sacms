import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { buildManifest } from "../../scripts/mcp-manifest.cjs"
import { buildReference } from "../../scripts/mcp-tool-reference.cjs"

const root = join(__dirname, "..", "..")
const committed = readFileSync(join(root, "docs/mcp/tool-reference.md"), "utf8").replace(/\r\n/g, "\n")
const manifest = buildManifest(root)

describe("MCP tool reference", () => {
  it("is up to date with the server source; regenerate with `node scripts/mcp-tool-reference.cjs`", () => {
    expect(committed).toBe(buildReference(root))
  })

  it("lists every registered workspace and global tool", () => {
    for (const name of [...manifest.workspace, ...manifest.global]) {
      expect(committed).toContain(`| \`${name}\` |`)
    }
  })

  it("gives every tool a description", () => {
    expect(committed).not.toContain("(no description)")
  })
})
