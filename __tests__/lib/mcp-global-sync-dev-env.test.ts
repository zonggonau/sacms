import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { requiredScopeForTool } from "@/lib/mcp-global-scopes"

const source = readFileSync(join(__dirname, "../../src/lib/mcp/global/website-template-tools.ts"), "utf8").replace(/\r\n/g, "\n")
const block = source.slice(source.indexOf('"sync_dev_env"'), source.indexOf("// ── get_starter_template"))

describe("global sync_dev_env", () => {
  it("needs the demo scope, because its env belongs to a demo workspace", () => {
    expect(requiredScopeForTool("sync_dev_env")).toBe("demo")
  })

  it("resolves the template's own demo workspace, never another tenant", () => {
    expect(block).toContain("findSchemaDemoWorkspace(db, schemaTemplate)")
    expect(block).toContain("resolveFrontendEnv(demo.id, demo.slug")
  })

  it("refuses a request that gives both or neither template id", () => {
    expect(block).toContain("Berikan tepat satu dari websiteTemplateId atau schemaTemplateId")
  })
})
