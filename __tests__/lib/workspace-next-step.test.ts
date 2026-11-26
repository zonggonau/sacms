import { describe, it, expect } from "vitest"
import { readdirSync } from "fs"
import { join } from "path"
import { deriveNextStep, NEXT_STEP_STAGE_COUNT, type WorkspaceFacts } from "@/lib/workspace-next-step"

const empty: WorkspaceFacts = { contentTypeCount: 0, singleTypeCount: 0, componentCount: 0, entryCount: 0, hasSite: false }
const slug = "acme"

describe("deriveNextStep", () => {
  it("an empty workspace is at the plan-schema stage", () => {
    const step = deriveNextStep(empty, slug)
    expect(step.stage).toBe("plan_schema")
    expect(step.stageNumber).toBe(1)
    expect(step.stageCount).toBe(NEXT_STEP_STAGE_COUNT)
  })

  it("a component alone counts as a schema", () => {
    const step = deriveNextStep({ ...empty, componentCount: 1 }, slug)
    expect(step.stage).toBe("add_content")
  })

  it("a schema with no entries and no site is at the add-content stage, offering the sample-content tool", () => {
    const step = deriveNextStep({ ...empty, contentTypeCount: 2 }, slug)
    expect(step.stage).toBe("add_content")
    expect(step.actions.some((a) => a.via === "mcp" && a.tool === "seed_sample_content")).toBe(true)
  })

  it("entries without a site move to deploy-frontend", () => {
    const step = deriveNextStep({ ...empty, contentTypeCount: 1, entryCount: 5 }, slug)
    expect(step.stage).toBe("deploy_site")
    expect(step.stageNumber).toBe(3)
    expect(step.actions.some((a) => a.via === "mcp" && a.tool === "start_website_build")).toBe(true)
  })

  it("a deployed site is live and points at revision and domain tools", () => {
    const step = deriveNextStep({ ...empty, contentTypeCount: 1, entryCount: 5, hasSite: true }, slug)
    expect(step.stage).toBe("live")
    expect(step.stageNumber).toBe(4)
    expect(step.actions.some((a) => a.via === "mcp" && a.tool === "deploy_website_patch")).toBe(true)
  })

  it("a site with no entries yet is still live once deployed", () => {
    const step = deriveNextStep({ ...empty, contentTypeCount: 1, hasSite: true }, slug)
    expect(step.stage).toBe("live")
  })

  it("dashboard actions link into this workspace's slug", () => {
    for (const facts of [empty, { ...empty, contentTypeCount: 1 }, { ...empty, contentTypeCount: 1, entryCount: 1 }, { ...empty, contentTypeCount: 1, entryCount: 1, hasSite: true }]) {
      const step = deriveNextStep(facts, slug)
      for (const action of step.actions) {
        if (action.via === "dashboard") expect(action.href.startsWith(`/dashboard/${slug}/`)).toBe(true)
      }
    }
  })

  it("every stage offers at least one action", () => {
    const stages = [
      empty,
      { ...empty, contentTypeCount: 1 },
      { ...empty, contentTypeCount: 1, entryCount: 1 },
      { ...empty, contentTypeCount: 1, entryCount: 1, hasSite: true },
    ]
    for (const facts of stages) expect(deriveNextStep(facts, slug).actions.length).toBeGreaterThan(0)
  })
})

// Every dashboard link must point at a page that exists. A link to a missing
// route (cms/content had no page.tsx) shipped once and 404'd for users.
describe("dashboard links resolve to real pages", () => {
  const appRoot = join(__dirname, "../../src/app/(workspace)/dashboard/[tenant]")

  function routesUnder(dir: string, prefix = ""): string[] {
    const out: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        // Route groups like (cms) do not appear in the URL.
        const seg = /^\(.*\)$/.test(entry.name) ? "" : `/${entry.name}`
        out.push(...routesUnder(full, prefix + seg))
      } else if (entry.name === "page.tsx") {
        out.push(prefix || "/")
      }
    }
    return out
  }

  it("every dashboard href from every stage has a matching page", () => {
    const pages = new Set(routesUnder(appRoot))
    const stages: WorkspaceFacts[] = [
      empty,
      { ...empty, contentTypeCount: 1 },
      { ...empty, contentTypeCount: 1, entryCount: 1 },
      { ...empty, contentTypeCount: 1, entryCount: 1, hasSite: true },
    ]
    for (const facts of stages) {
      for (const action of deriveNextStep(facts, slug).actions) {
        if (action.via !== "dashboard") continue
        const route = action.href.replace(`/dashboard/${slug}`, "") || "/"
        expect(pages.has(route), `${action.href} has no page.tsx`).toBe(true)
      }
    }
  })
})
