import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { requiredScopeForTool } from "@/lib/mcp-global-scopes"

const manifest = JSON.parse(readFileSync(join(__dirname, "../../docs/mcp/tool-manifest.json"), "utf8")) as { workspace: string[]; global: string[] }
const reference = readFileSync(join(__dirname, "../../docs/mcp/tool-reference.md"), "utf8")
const read = (rel: string) => readFileSync(join(__dirname, "../..", rel), "utf8").replace(/\r\n/g, "\n")

describe("global scopes", () => {
  it("deletes of catalog data need the delete scope, not write", () => {
    expect(requiredScopeForTool("delete_website_template")).toBe("delete")
    expect(requiredScopeForTool("delete_schema_template")).toBe("delete")
    expect(requiredScopeForTool("delete_global_component")).toBe("delete")
    expect(requiredScopeForTool("update_website_template")).toBe("write")
  })
})

describe("workspace tool hardening", () => {
  it("removes the site preview aliases", () => {
    expect(manifest.workspace).not.toContain("start_site_preview")
    expect(manifest.workspace).not.toContain("get_site_preview")
  })

  it("keeps the canonical operation status tool in the workspace", () => {
    expect(manifest.workspace).toContain("get_operation_status")
  })

  it("mints API keys and calls external APIs only with the env scope", () => {
    const scopes = read("src/lib/mcp/workspace/tool-scopes.ts")
    expect(scopes).toMatch(/get_or_create_api_key: "env"/)
    expect(scopes).toMatch(/call_external_api: "env"/)
  })

  it("sends stored secrets only over HTTPS", () => {
    expect(read("src/lib/mcp/workspace/deploy-tools.ts")).toContain('targetUrl.protocol !== "https:"')
  })
})

describe("annotations", () => {
  it("every tool carries a hint, so clients know whether it reads or writes", () => {
    const rows = reference.split(String.fromCharCode(10))
    // Table rows: "| `name` | hints | description |" splits into ["", " `name` ", " hints ", ...].
    const unannotated = rows.filter((line) => line.startsWith("| `") && line.split("|")[2]?.trim() === "not annotated")
    expect(unannotated).toEqual([])
  })

  it("every preview registration declares annotations", () => {
    const preview = read("src/lib/infrastructure/mcp-preview.ts")
    const registrations = preview.match(/server\.registerTool\("[a-z_]+", \{/g) ?? []
    const annotated = preview.match(/server\.registerTool\("[a-z_]+", \{ annotations:/g) ?? []
    expect(registrations.length).toBeGreaterThan(0)
    expect(annotated.length).toBe(registrations.length)
  })
})

describe("deploy_to_sacms on both servers", () => {
  it("the workspace server deploys the built site with deploy_to_sacms", () => {
    expect(manifest.workspace).toContain("deploy_to_sacms")
  })

  it("the global server deploys a built Website Template to its demo hosting under the same name", () => {
    expect(manifest.global).toContain("deploy_to_sacms")
    expect(requiredScopeForTool("deploy_to_sacms")).toBe("write")
  })
})
