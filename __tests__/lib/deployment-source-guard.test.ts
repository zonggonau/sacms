import { describe, it, expect } from "vitest"
import {
  detectWrapperPrefix,
  stripWrapperPrefix,
  matchesSignature,
  findInvalidBinaryAssets,
  findSourceIssues,
} from "@/lib/infrastructure/deployment-source-guard"

// chatgpt3.md: a persisted or live-read file set must be validated the same
// way whether it's about to be imported, used as a deploy_website_patch
// base, or restored via rollback_website — these pure helpers are that one
// shared representation.

describe("detectWrapperPrefix", () => {
  it("returns empty when package.json is already at root", () => {
    expect(detectWrapperPrefix(["package.json", "src/app/page.tsx"])).toBe("")
  })

  it("returns empty when no package.json exists anywhere (nothing to prove a wrapper with)", () => {
    expect(detectWrapperPrefix(["index.html", "styles.css"])).toBe("")
  })

  it("finds a single-level wrapper directory via package.json's own location", () => {
    expect(detectWrapperPrefix(["src/package.json", "src/public/icon.png"])).toBe("src")
  })

  it("finds a deeper wrapper path", () => {
    expect(detectWrapperPrefix(["apps/web/package.json", "apps/web/app/page.tsx"])).toBe("apps/web")
  })

  it("picks the SHALLOWEST package.json when more than one exists", () => {
    expect(detectWrapperPrefix(["package.json", "packages/ui/package.json"])).toBe("")
  })
})

describe("stripWrapperPrefix", () => {
  it("strips the detected prefix from every leaf under it", () => {
    const leaves = [{ path: "src/package.json" }, { path: "src/public/icon.png" }]
    const { leaves: result, dropped } = stripWrapperPrefix(leaves)
    expect(result.map((l) => l.path)).toEqual(["package.json", "public/icon.png"])
    expect(dropped).toEqual([])
  })

  it("drops (and reports) a leaf that sits outside the detected wrapper rather than keeping it at a confusing path", () => {
    const leaves = [{ path: "src/package.json" }, { path: "README.md" }]
    const { leaves: result, dropped } = stripWrapperPrefix(leaves)
    expect(result.map((l) => l.path)).toEqual(["package.json"])
    expect(dropped).toEqual(["README.md"])
  })

  it("is a no-op when there's no wrapper to strip", () => {
    const leaves = [{ path: "package.json" }, { path: "src/app/page.tsx" }]
    const { leaves: result, dropped } = stripWrapperPrefix(leaves)
    expect(result).toEqual(leaves)
    expect(dropped).toEqual([])
  })
})

describe("matchesSignature", () => {
  it("confirms a real PNG signature", () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1])
    expect(matchesSignature("png", bytes)).toBe(true)
  })

  it("rejects bytes that don't match the claimed format", () => {
    const bytes = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])
    expect(matchesSignature("png", bytes)).toBe(false)
  })

  it("rejects bytes shorter than the signature itself", () => {
    expect(matchesSignature("png", Buffer.from([0x89, 0x50]))).toBe(false)
  })

  it("returns false for an unknown format rather than throwing", () => {
    expect(matchesSignature("tiff", Buffer.from([1, 2, 3]))).toBe(false)
  })
})

describe("findInvalidBinaryAssets", () => {
  it("flags a PNG-named file whose bytes don't match the PNG signature", () => {
    const badPng = Buffer.from([1, 2, 3, 4]).toString("base64")
    const files = [{ name: "icon.png", content: badPng, encoding: "base64" as const }]
    expect(findInvalidBinaryAssets(files)).toEqual(["icon.png"])
  })

  it("leaves a genuinely valid PNG alone", () => {
    const goodPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1]).toString("base64")
    const files = [{ name: "icon.png", content: goodPng, encoding: "base64" as const }]
    expect(findInvalidBinaryAssets(files)).toEqual([])
  })

  it("ignores extensions it has no known signature for (e.g. source files, fonts)", () => {
    const files = [{ name: "app.js", content: "console.log(1)", encoding: "utf-8" as const }]
    expect(findInvalidBinaryAssets(files)).toEqual([])
  })
})

describe("findSourceIssues", () => {
  it("is empty for a clean, correctly-rooted file set", () => {
    const files = [
      { name: "package.json", content: "{}", encoding: "utf-8" as const },
      { name: "src/app/page.tsx", content: "export default function Page() {}", encoding: "utf-8" as const },
    ]
    expect(findSourceIssues(files)).toEqual([])
  })

  it("flags a wrapper-prefix set (package.json nested, same bug get_deployment_source/deploy_website_patch/rollback_website all need to catch)", () => {
    const files = [
      { name: "src/package.json", content: "{}", encoding: "utf-8" as const },
      { name: "src/public/icon.png", content: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64"), encoding: "base64" as const },
    ]
    const issues = findSourceIssues(files)
    expect(issues.some((i) => i.startsWith("WRAPPER_PREFIX:"))).toBe(true)
  })

  it("flags a corrupted binary asset even with a correctly-rooted package.json", () => {
    const files = [
      { name: "package.json", content: "{}", encoding: "utf-8" as const },
      { name: "public/icon.png", content: Buffer.from([1, 2, 3, 4]).toString("base64"), encoding: "base64" as const },
    ]
    const issues = findSourceIssues(files)
    expect(issues).toEqual(["INVALID_ASSET:public/icon.png"])
  })
})
