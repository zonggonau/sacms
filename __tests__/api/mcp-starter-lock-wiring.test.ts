import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

// Static source checks for the starter lock: every write path that can change a locked starter file
// must run the check, or the lock is only a promise. Behaviour of the check itself is covered by
// __tests__/lib/starter-template.test.ts; this file keeps the call sites from being removed silently.
const read = (rel: string) => readFileSync(join(__dirname, "../..", rel), "utf-8").replace(/\r\n/g, "\n")

const deployTools = read("src/lib/mcp/workspace/deploy-tools.ts")
const buildTools = read("src/lib/mcp/workspace/build-tools.ts")
const preview = read("src/lib/infrastructure/mcp-preview.ts")
const globalTemplates = read("src/lib/mcp/global/website-template-tools.ts")
const applyTemplate = read("src/lib/infrastructure/apply-website-template.ts")

const count = (source: string, needle: string) => source.split(needle).length - 1

describe("starter lock is enforced on every workspace write path", () => {
  it("deploy_to_sacms (and deploy_site_version, which calls it), deploy_website_patch and rollback_website each check the lock before deploying", () => {
    expect(count(deployTools, "starterLockBreach(workspaceLockKey(auth.tenantId)")).toBe(3)
    expect(deployTools).toContain("return starterLockedResult(starterBreach)")
    expect(deployTools).toContain('code: "STARTER_LOCKED"')
  })

  it("the preview apply tool checks the files it writes, and both preview save branches check the full set", () => {
    expect(preview).toContain("starterChangeBreach(workspace ? workspaceLockKey(t.id) : templateLockKey(t.id), changedFiles)")
    expect(count(preview, "await guardStarter(")).toBe(2) // save (workspace branch), save (template branch)
    expect(preview).toContain("starterLockBreach(workspace ? workspaceLockKey(targetId) : templateLockKey(targetId), files)")
  })

  it("the Website Template update checks the lock on every file source, including restoreFromVersion", () => {
    expect(globalTemplates).toContain("starterLockBreach(templateLockKey(existing.id), filesData)")
    // The check must sit after filesData is computed, so restore/patch/full replacement are all covered.
    expect(globalTemplates.indexOf("starterLockBreach(templateLockKey(existing.id), filesData)")).toBeGreaterThan(globalTemplates.indexOf("filesData = parsedFiles.data"))
  })
})

describe("starter download and creation", () => {
  it("create_website_template writes the starter lock in the same transaction as the template", () => {
    const tx = globalTemplates.indexOf("writeStarterLock(tx, templateLockKey(createdTemplate.id)")
    expect(tx).toBeGreaterThan(-1)
    expect(tx).toBeLessThan(globalTemplates.indexOf("return { schemaTemplate: resolvedSchemaTemplate, template: createdTemplate, firstWebsite }"))
  })

  it("applying a catalog Website Template clears any workspace starter lock, a starter apply sets one", () => {
    expect(applyTemplate).toContain("if (starter) {")
    expect(applyTemplate).toContain("tx.setting.deleteMany({ where: { key: workspaceLockKey(tenantId) } })")
    expect(applyTemplate).toContain("writeStarterLock(tx, workspaceLockKey(tenantId), tenantId, starterLockFor(starter))")
  })
})
