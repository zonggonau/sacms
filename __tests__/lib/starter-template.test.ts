import { beforeEach, describe, expect, it, vi } from "vitest"
import JSZip from "jszip"

const safeFetch = vi.fn()
vi.mock("@/lib/safe-url", () => ({ safeFetch: (...args: unknown[]) => safeFetch(...args) }))

const settings = new Map<string, string>()
vi.mock("@/lib/database", () => ({
  db: {
    setting: {
      findUnique: async ({ where }: { where: { key: string } }) => (settings.has(where.key) ? { value: settings.get(where.key) } : null),
    },
  },
}))

import {
  loadStarterSnapshot,
  resetStarterCache,
  starterChangeBreach,
  starterLockBreach,
  starterLockFor,
  starterLockViolations,
  StarterUnavailableError,
  templateLockKey,
  workspaceLockKey,
} from "@/lib/infrastructure/starter-template"

const COMMIT = "a".repeat(40)
const ROOT = "sacms-nextjs-starter-aaaaaaa/"

const schemaJson = {
  $comment: "test",
  version: 1,
  components: [{ slug: "hero", name: "Hero", category: null, description: "x", fields: [{ name: "Title", slug: "title", type: "text", required: true }] }],
  singles: [{ slug: "site-settings", name: "Site", description: "x", fields: [{ name: "Name", slug: "name", type: "text", required: false }] }],
}

async function starterZip(extra: Record<string, string | Uint8Array> = {}): Promise<Buffer> {
  const zip = new JSZip()
  zip.folder(ROOT.slice(0, -1))
  zip.file(`${ROOT}package.json`, JSON.stringify({ name: "starter" }))
  zip.file(`${ROOT}app/page.tsx`, "export default function Page() { return null }")
  zip.file(`${ROOT}sacms/schema.json`, JSON.stringify(schemaJson))
  zip.file(`${ROOT}package-lock.json`, "{}")
  zip.file(`${ROOT}node_modules/left-pad/index.js`, "module.exports = 1")
  zip.file(`${ROOT}.git/config`, "[core]")
  zip.file(`${ROOT}public/logo.png`, new Uint8Array([137, 80, 78, 71]))
  for (const [path, content] of Object.entries(extra)) zip.file(`${ROOT}${path}`, content)
  return zip.generateAsync({ type: "nodebuffer" })
}

function respondWith(commit: string, zipBuffer: Buffer) {
  safeFetch.mockImplementation(async (url: string) => {
    if (url.startsWith("https://api.github.com/")) {
      return new Response(JSON.stringify({ sha: commit }), { status: 200 })
    }
    return new Response(new Uint8Array(zipBuffer), { status: 200 })
  })
}

describe("starter snapshot", () => {
  beforeEach(() => {
    safeFetch.mockReset()
    settings.clear()
    resetStarterCache()
  })

  it("downloads the commit's archive, strips the wrapper folder, and skips generated and machine-local files", async () => {
    respondWith(COMMIT, await starterZip())
    const snapshot = await loadStarterSnapshot()

    expect(snapshot.commit).toBe(COMMIT)
    expect(snapshot.files.map((f) => f.path)).toEqual(["app/page.tsx", "package.json", "public/logo.png", "sacms/schema.json"])
    expect(snapshot.files.find((f) => f.path === "public/logo.png")?.encoding).toBe("base64")
    expect(snapshot.files.find((f) => f.path === "package.json")?.encoding).toBe("utf-8")
    expect(snapshot.files.some((f) => f.path.includes("node_modules") || f.path.startsWith(".git"))).toBe(false)
  })

  it("reads sacms/schema.json into the Schema Template bundle shape (singles become Single Types)", async () => {
    respondWith(COMMIT, await starterZip())
    const { schema } = await loadStarterSnapshot()

    expect(schema.contentTypes).toEqual([])
    expect(schema.singleTypes.map((s) => s.slug)).toEqual(["site-settings"])
    expect(schema.components.map((c) => c.slug)).toEqual(["hero"])
  })

  it("fails with StarterUnavailableError when GitHub returns a malformed commit", async () => {
    respondWith("not-a-sha", await starterZip())
    await expect(loadStarterSnapshot()).rejects.toBeInstanceOf(StarterUnavailableError)
  })

  it("fails when the archive has no sacms/schema.json", async () => {
    const zip = new JSZip()
    zip.file(`${ROOT}package.json`, "{}")
    respondWith(COMMIT, await zip.generateAsync({ type: "nodebuffer" }))
    await expect(loadStarterSnapshot()).rejects.toThrow(/sacms\/schema\.json/)
  })

  it("serves the cached snapshot inside the TTL instead of hitting GitHub again", async () => {
    respondWith(COMMIT, await starterZip())
    await loadStarterSnapshot()
    await loadStarterSnapshot()
    expect(safeFetch).toHaveBeenCalledTimes(2) // one commit lookup + one archive download, once
  })
})

describe("starter lock", () => {
  const files = [
    { path: "package.json", content: "{}" },
    { path: "app/page.tsx", content: "export default null" },
  ]
  const lock = starterLockFor({
    repo: "zonggonau/sacms-nextjs-starter",
    commit: COMMIT,
    files: [
      { path: "package.json", content: "{}", encoding: "utf-8" },
      { path: "app/page.tsx", content: "export default null", encoding: "utf-8" },
    ],
    schema: { groups: [], contentTypes: [], singleTypes: [], components: [] },
  })

  it("allows new files and unchanged starter files", () => {
    expect(starterLockViolations(lock, [...files, { path: "app/blog/page.tsx", content: "new" }])).toEqual([])
  })

  it("reports a changed starter file", () => {
    expect(starterLockViolations(lock, [{ path: "package.json", content: '{"x":1}' }, files[1]])).toEqual(["diubah: package.json"])
  })

  it("reports a removed starter file", () => {
    expect(starterLockViolations(lock, [files[0]])).toEqual(["dihapus: app/page.tsx"])
  })

  it("returns no breach when no lock exists for the scope", async () => {
    expect(await starterLockBreach(workspaceLockKey("tenant-1"), [{ path: "package.json", content: "changed" }])).toBeNull()
  })

  it("returns an Indonesian breach message when a stored lock is violated", async () => {
    settings.set(templateLockKey("tpl-1"), JSON.stringify(lock))
    const breach = await starterLockBreach(templateLockKey("tpl-1"), [{ path: "package.json", content: "changed" }, files[1]])
    expect(breach).toMatch(/^Starter template terkunci/)
    expect(breach).toContain("diubah: package.json")
  })

  it("judges only the files a partial write carries", async () => {
    settings.set(workspaceLockKey("t-partial"), JSON.stringify(lock))
    // A new file, and a locked file carried with its starter content, pass.
    expect(await starterChangeBreach(workspaceLockKey("t-partial"), [{ path: "app/blog/page.tsx", content: "new" }, files[0]])).toBeNull()
    // A locked file carried with different content is refused, even though the rest of the set is not sent.
    expect(await starterChangeBreach(workspaceLockKey("t-partial"), [{ path: "app/page.tsx", content: "changed" }])).toMatch(/diubah: app\/page\.tsx/)
  })

  it("keeps workspace and Website Template locks in separate keys", () => {
    expect(workspaceLockKey("t1")).not.toBe(templateLockKey("t1"))
  })
})
