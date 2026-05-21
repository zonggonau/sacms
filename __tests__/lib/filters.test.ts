import { describe, it, expect } from "vitest"
import { parseFilters, buildFilterSQL } from "../../src/lib/filters"

describe("Filter Engine", () => {
  const allowedFields = new Set(["title", "price", "category", "status"])

  describe("parseFilters", () => {
    it("should parse simple equality filters", () => {
      const params = new URLSearchParams("filters[title][$eq]=hello")
      const { conditions } = parseFilters(params, allowedFields)
      
      expect(conditions).toHaveLength(1)
      expect(conditions[0]).toEqual({
        field: "title",
        operator: "$eq",
        value: "hello"
      })
    })

    it("should parse numeric comparison filters", () => {
      const params = new URLSearchParams("filters[price][$gte]=100")
      const { conditions } = parseFilters(params, allowedFields)
      
      expect(conditions).toHaveLength(1)
      expect(conditions[0]).toEqual({
        field: "price",
        operator: "$gte",
        value: "100"
      })
    })

    it("should ignore disallowed fields", () => {
      const params = new URLSearchParams("filters[password][$eq]=secret")
      const { conditions } = parseFilters(params, allowedFields)
      
      expect(conditions).toHaveLength(0)
    })

    it("should parse $or groups", () => {
      const params = new URLSearchParams()
      params.append("filters[$or][0][status][$eq]", "featured")
      params.append("filters[$or][0][price][$gt]", "500")
      
      const { conditions, orGroups } = parseFilters(params, allowedFields)
      
      expect(conditions).toHaveLength(0)
      expect(orGroups[0]).toHaveLength(2)
      expect(orGroups[0][0]).toMatchObject({ field: "status", operator: "$eq", value: "featured" })
      expect(orGroups[0][1]).toMatchObject({ field: "price", operator: "$gt", value: "500" })
    })

    it("should enforce MAX_CONDITIONS limit", () => {
      const params = new URLSearchParams()
      for (let i = 0; i < 30; i++) {
        params.append(`filters[title][$eq]`, `val${i}`)
      }
      const { conditions } = parseFilters(params, allowedFields)
      expect(conditions.length).toBeLessThanOrEqual(20)
    })
  })

  describe("buildFilterSQL", () => {
    it("should generate correct SQL for equality", () => {
      const conditions = [{ field: "title", operator: "$eq", value: "Test" }]
      const { fragments, params } = buildFilterSQL(conditions, [])
      
      expect(fragments[0]).toBe('"data"->>\'title\' = $1')
      expect(params).toEqual(["Test"])
    })

    it("should generate correct SQL for numeric comparison", () => {
      const conditions = [{ field: "price", operator: "$gt", value: "100" }]
      const { fragments, params } = buildFilterSQL(conditions, [])
      
      expect(fragments[0]).toBe('("data"->>\'price\')::numeric > $1')
      expect(params).toEqual([100])
    })

    it("should generate correct SQL for $contains (ILIKE)", () => {
      const conditions = [{ field: "title", operator: "$contains", value: "next" }]
      const { fragments, params } = buildFilterSQL(conditions, [])
      
      expect(fragments[0]).toBe('"data"->>\'title\' ILIKE $1')
      expect(params).toEqual(["%next%"])
    })

    it("should handle multiple conditions with incremental parameter offsets", () => {
      const conditions = [
        { field: "category", operator: "$eq", value: "tutorial" },
        { field: "price", operator: "$lte", value: "200" }
      ]
      const { fragments, params } = buildFilterSQL(conditions, [])
      
      expect(fragments).toHaveLength(2)
      expect(fragments[0]).toContain("$1")
      expect(fragments[1]).toContain("$2")
      expect(params).toEqual(["tutorial", 200])
    })

    it("should generate OR clause for orGroups", () => {
      const orGroups = [[
        { field: "status", operator: "$eq", value: "archived" },
        { field: "status", operator: "$eq", value: "deleted" }
      ]]
      const { fragments, params } = buildFilterSQL([], orGroups)
      
      expect(fragments[0]).toBe('("data"->>\'status\' = $1 OR "data"->>\'status\' = $2)')
      expect(params).toEqual(["archived", "deleted"])
    })

    it("should handle $in operator with array expansion", () => {
      const conditions = [{ field: "category", operator: "$in", value: "a, b, c" }]
      const { fragments, params } = buildFilterSQL(conditions, [])
      
      expect(fragments[0]).toBe('"data"->>\'category\' IN ($1,$2,$3)')
      expect(params).toEqual(["a", "b", "c"])
    })
  })
})
