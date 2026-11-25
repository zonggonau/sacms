import { describe, it, expect } from "vitest"
import { buildWorkspacePlaybook, WORKSPACE_MCP_INSTRUCTIONS } from "@/lib/mcp/workspace-guidance"
import { GLOBAL_MCP_INSTRUCTIONS } from "@/lib/mcp/global-guidance"

const phase = (text: string, from: string, to: string) => text.slice(text.indexOf(from), text.indexOf(to))

describe("MCP guidance", () => {
  const playbook = buildWorkspacePlaybook("Acme")

  it("the workspace playbook releases through the preview path", () => {
    const release = phase(playbook, "## Phase 4", "## Rules that apply throughout")
    expect(release).toMatch(/start_preview/)
    expect(release).toMatch(/save_preview_changes/)
    expect(release).toMatch(/administrator/)
    expect(release).toMatch(/Never call `promote_deployment`/)
  })

  it("marks deploy_to_sacms as staging only, not the normal release path", () => {
    const release = phase(playbook, "## Phase 4", "## Rules that apply throughout")
    expect(release).toMatch(/STAGING candidates\. They are\s+not the normal release path/)
  })

  it("interpolates the tenant name into the playbook heading", () => {
    expect(playbook.startsWith("# SaCMS Agent Playbook — Workspace: Acme")).toBe(true)
  })

  it("keeps both servers' instructions under the length Claude Code truncates at", () => {
    // Claude Code cuts long `instructions` mid-sentence (see the global server's comment).
    expect(WORKSPACE_MCP_INSTRUCTIONS.length).toBeLessThan(2000)
    expect(GLOBAL_MCP_INSTRUCTIONS.length).toBeLessThan(2000)
  })

  it("the workspace instructions point to the preview release path", () => {
    expect(WORKSPACE_MCP_INSTRUCTIONS).toMatch(/start_preview/)
    expect(WORKSPACE_MCP_INSTRUCTIONS).toMatch(/Infrastructure → Hosting/)
  })
})
