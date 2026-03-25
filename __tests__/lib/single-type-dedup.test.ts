import { describe, it, expect } from "vitest"

describe("Single Type Deduplication Logic", () => {
  it("should prioritize tenant-specific single types over global templates", () => {
    const singleTypes = [
      { id: "global-1", slug: "navbar", tenantId: null, name: "Global Navbar" },
      { id: "tenant-1", slug: "navbar", tenantId: "tenant-a", name: "Tenant Navbar" },
      { id: "global-2", slug: "footer", tenantId: null, name: "Global Footer" },
    ]

    const singleTypesMap = new Map()

    for (const st of singleTypes) {
      const mappedSt = {
        ...st,
        isGlobal: st.tenantId === null,
      }

      if (!singleTypesMap.has(st.slug) || st.tenantId !== null) {
        singleTypesMap.set(st.slug, mappedSt)
      }
    }

    const result = Array.from(singleTypesMap.values())

    expect(result).toHaveLength(2)
    
    const navbar = result.find(st => st.slug === "navbar")
    expect(navbar?.id).toBe("tenant-1")
    expect(navbar?.name).toBe("Tenant Navbar")
    expect(navbar?.isGlobal).toBe(false)

    const footer = result.find(st => st.slug === "footer")
    expect(footer?.id).toBe("global-2")
    expect(footer?.isGlobal).toBe(true)
  })

  it("should work when only global templates are present", () => {
    const singleTypes = [
      { id: "global-1", slug: "navbar", tenantId: null, name: "Global Navbar" },
    ]

    const singleTypesMap = new Map()

    for (const st of singleTypes) {
      const mappedSt = {
        ...st,
        isGlobal: st.tenantId === null,
      }

      if (!singleTypesMap.has(st.slug) || st.tenantId !== null) {
        singleTypesMap.set(st.slug, mappedSt)
      }
    }

    const result = Array.from(singleTypesMap.values())
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("global-1")
  })
})
