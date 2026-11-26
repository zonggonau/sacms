import { describe, it, expect } from "vitest"
import { describeReviewField, type KnownSlugs } from "@/lib/schema-field-describe"

const known: KnownSlugs = {
  models: new Set(["authors", "menu", "homepage"]),
  components: new Set(["feature-card"]),
}

describe("describeReviewField", () => {
  it("names the type in words, not the raw key", () => {
    expect(describeReviewField({ name: "Harga", slug: "harga", type: "currency" }, known).typeLabel).not.toBe("currency")
  })

  it("shows a relation target and whether it holds one or a list", () => {
    const one = describeReviewField({ name: "Penulis", slug: "penulis", type: "relation", relationSlug: "authors", options: { relationType: "manyToOne" } }, known)
    expect(one.detail).toBe("→ authors (satu)")
    expect(one.warning).toBeNull()
    const many = describeReviewField({ name: "Tag", slug: "tag", type: "relation", relationSlug: "authors", options: { relationType: "manyToMany" } }, known)
    expect(many.detail).toBe("→ authors (daftar)")
  })

  it("labels a member relation as an end-user account, never as a missing target", () => {
    const r = describeReviewField({ name: "Pembeli", slug: "pembeli", type: "relation", options: { targetModel: "member" } }, known)
    expect(r.detail).toBe("→ Member (akun pengguna)")
    expect(r.warning).toBeNull()
  })

  it("warns on a relation pointing at nothing in the plan or the workspace", () => {
    const r = describeReviewField({ name: "X", slug: "x", type: "relation", relationSlug: "ghost" }, known)
    expect(r.warning).toContain("ghost")
  })

  it("warns on a relation with no target at all", () => {
    expect(describeReviewField({ name: "X", slug: "x", type: "relation" }, known).warning).not.toBeNull()
  })

  it("counts select choices and warns when there are none", () => {
    const ok = describeReviewField({ name: "S", slug: "s", type: "select", options: { choices: [{ label: "A", value: "a" }, { label: "B", value: "b" }] } }, known)
    expect(ok.detail).toBe("2 pilihan")
    expect(ok.warning).toBeNull()
    expect(describeReviewField({ name: "S", slug: "s", type: "select" }, known).warning).toContain("Belum ada pilihan")
    expect(describeReviewField({ name: "M", slug: "m", type: "multiselect", options: { choices: [] } }, known).warning).not.toBeNull()
  })

  it("shows a repeatable component and warns on an unknown one", () => {
    const ok = describeReviewField({ name: "Fitur", slug: "fitur", type: "component", componentSlug: "feature-card", options: { repeatable: true } }, known)
    expect(ok.detail).toBe("daftar komponen feature-card")
    expect(ok.warning).toBeNull()
    expect(describeReviewField({ name: "Hero", slug: "hero", type: "component", componentSlug: "hero" }, known).warning).toContain("hero")
  })

  it("leaves an ordinary field with no warning", () => {
    expect(describeReviewField({ name: "Judul", slug: "judul", type: "text" }, known)).toEqual({ typeLabel: expect.any(String), detail: null, warning: null })
  })
})
