import { describe, it, expect } from "vitest"
import { checkFrontendSource, type CheckFile } from "@/lib/infrastructure/frontend-content-check"

const schema = { contentTypes: ["reviews", "menu"], singleTypes: ["homepage"] }
const codes = (files: CheckFile[]) => checkFrontendSource(files, schema).map((w) => w.code)

const clean: CheckFile = {
  name: "app/menu/page.tsx",
  content: `
export async function getMenu(locale: string) {
  const res = await fetch(\`\${base}/api/public/acme/content/menu?locale=\${locale}\`, { next: { revalidate: 60 } })
  if (!res.ok) throw new Error("gagal")
  return res.json()
}`,
}

describe("checkFrontendSource", () => {
  it("passes a page that uses known slugs, sends a locale, checks status, and revalidates", () => {
    const hook: CheckFile = { name: "app/api/revalidate/route.ts", content: 'import { revalidatePath } from "next/cache"; export async function POST() { revalidatePath("/menu") }' }
    expect(checkFrontendSource([clean, hook], schema)).toEqual([])
  })

  it("flags a fetched slug the schema does not have (the review/testimonial case)", () => {
    const f: CheckFile = {
      name: "app/testimoni/page.tsx",
      content: `const r = await fetch("/api/public/acme/content/testimonials?locale=id"); if (!r.ok) return []`,
    }
    const w = checkFrontendSource([f], schema).find((x) => x.code === "UNKNOWN_CONTENT_TYPE")
    expect(w).toMatchObject({ file: "app/testimoni/page.tsx", line: 1 })
    expect(w!.message).toContain("testimonials")
  })

  it("flags a single type the schema does not have", () => {
    const f: CheckFile = { name: "app/page.tsx", content: `fetch("/api/public/acme/single/landing?locale=id"); if (!r.ok) {}` }
    expect(codes([f])).toContain("UNKNOWN_SINGLE_TYPE")
  })

  it("flags a fetch whose HTTP status is never checked", () => {
    const f: CheckFile = { name: "app/menu.tsx", content: `const data = await (await fetch("/api/public/acme/content/menu?locale=id")).json()` }
    expect(codes([f])).toContain("HTTP_STATUS_UNCHECKED")
  })

  it("flags a site that reads content but has no revalidation anywhere", () => {
    const f: CheckFile = { name: "app/menu.tsx", content: `fetch("/api/public/acme/content/menu?locale=id"); if (!r.ok) return []` }
    expect(codes([f])).toContain("NO_REVALIDATION")
  })

  it("does not demand revalidation from a site that never reads content", () => {
    const f: CheckFile = { name: "app/about.tsx", content: `export default function About() { return <p>Tentang</p> }` }
    expect(codes([f])).toEqual([])
  })

  it("ignores non-source files, such as a README that mentions the API", () => {
    const f: CheckFile = { name: "README.txt", content: `/api/public/acme/content/whatever` }
    expect(codes([f])).toEqual([])
  })

  it("does not read a template placeholder as a slug", () => {
    const f: CheckFile = { name: "app/x.tsx", content: `fetch(\`/api/public/acme/content/\${slug}?locale=id\`); if (!r.ok) {}\nrevalidatePath("/")` }
    expect(codes([f]).filter((c) => c === "UNKNOWN_CONTENT_TYPE")).toEqual([])
  })
})
