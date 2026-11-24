import { describe, it, expect } from "vitest"
import { parseFilters, buildFilterSQL, isSafeFieldIdentifier } from "../../src/lib/filters"

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

    it("should parse $and groups into the flat conditions list", () => {
      const params = new URLSearchParams()
      params.append("filters[$and][0][status][$eq]", "featured")
      params.append("filters[$and][1][price][$gt]", "500")

      const { conditions, orGroups } = parseFilters(params, allowedFields)

      expect(orGroups).toHaveLength(0)
      expect(conditions).toHaveLength(2)
      expect(conditions[0]).toMatchObject({ field: "status", operator: "$eq", value: "featured" })
      expect(conditions[1]).toMatchObject({ field: "price", operator: "$gt", value: "500" })
    })

    it("should enforce MAX_CONDITIONS limit", () => {
      const params = new URLSearchParams()
      for (let i = 0; i < 30; i++) {
        params.append(`filters[title][$eq]`, `val${i}`)
      }
      const { conditions } = parseFilters(params, allowedFields)
      expect(conditions.length).toBeLessThanOrEqual(20)
    })

    // Fifth external audit, the most dangerous finding: a filter key this
    // function can't recognize used to just vanish — if it was the only
    // filter in the request, that meant "no filter at all" (every row)
    // instead of "reject this request" or "zero rows". `rejected` now
    // surfaces exactly which key(s) didn't parse, so the caller can refuse
    // the request instead of silently serving more than was asked for.

    it("reports a disallowed/typo'd field in `rejected`, not just a silently empty conditions list", () => {
      const params = new URLSearchParams("filters[titlee][$eq]=hello")
      const { conditions, rejected } = parseFilters(params, allowedFields)
      expect(conditions).toHaveLength(0)
      expect(rejected).toEqual(["filters[titlee][$eq]"])
    })

    it("reports an unsupported operator in `rejected`", () => {
      const params = new URLSearchParams("filters[title][$regex]=hello")
      const { conditions, rejected } = parseFilters(params, allowedFields)
      expect(conditions).toHaveLength(0)
      expect(rejected).toEqual(["filters[title][$regex]"])
    })

    it("does not report anything in `rejected` for a well-formed filter", () => {
      const params = new URLSearchParams("filters[title][$eq]=hello")
      const { rejected } = parseFilters(params, allowedFields)
      expect(rejected).toEqual([])
    })

    // Confirmed root cause of "$in is ignored": @sacms/sdk (and real
    // Strapi) serializes an array-valued operator as indexed sub-keys,
    // not a flat comma-joined value — a shape this function didn't
    // recognize AT ALL before (neither the plain field/op branch, which
    // required no third bracket, nor the $or/$and branches).
    it("accepts the real indexed-array shape for $in (filters[field][$in][0], [1], ...) and reconstructs one array-valued condition", () => {
      const params = new URLSearchParams()
      params.append("filters[category][$in][0]", "a")
      params.append("filters[category][$in][1]", "b")
      params.append("filters[category][$in][2]", "c")
      const { conditions, rejected } = parseFilters(params, allowedFields)

      expect(rejected).toEqual([])
      expect(conditions).toHaveLength(1)
      expect(conditions[0]).toEqual({ field: "category", operator: "$in", value: ["a", "b", "c"] })
    })

    it("preserves index order for the array shape even when sent out of order", () => {
      const params = new URLSearchParams()
      params.append("filters[category][$in][2]", "c")
      params.append("filters[category][$in][0]", "a")
      params.append("filters[category][$in][1]", "b")
      const { conditions } = parseFilters(params, allowedFields)

      expect(conditions[0].value).toEqual(["a", "b", "c"])
    })

    it("accepts $containsi, the case-insensitive-contains alias", () => {
      const params = new URLSearchParams("filters[title][$containsi]=Next")
      const { conditions, rejected } = parseFilters(params, allowedFields)
      expect(rejected).toEqual([])
      expect(conditions[0]).toMatchObject({ field: "title", operator: "$containsi" })
    })
  })

  describe("parseFilters — negative controls for $or and $containsi", () => {
    const rejectedFor = (query: string) => {
      const { conditions, orGroups, rejected } = parseFilters(new URLSearchParams(query), allowedFields)
      return { rejected, accepted: conditions.length + orGroups.flat().length }
    }

    it.each([
      ["typo'd field inside $or", "filters[$or][0][titlee][$eq]=x"],
      ["unsupported operator inside $or", "filters[$or][0][title][$regex]=x"],
      ["$or index above the cap", "filters[$or][11][title][$eq]=x"],
      ["negative $or index", "filters[$or][-1][title][$eq]=x"],
      ["non-numeric $or index", "filters[$or][abc][title][$eq]=x"],
      ["$or key missing its operator", "filters[$or][0][title]=x"],
      ["$or nested inside $and (unsupported nesting)", "filters[$and][0][$or][0][title][$eq]=x"],
      ["$containsi on a typo'd field", "filters[titlee][$containsi]=x"],
    ])("rejects %s instead of silently dropping it", (_label, query) => {
      const { rejected, accepted } = rejectedFor(query)
      expect(rejected).toEqual([query.split("=")[0]])
      expect(accepted).toBe(0)
    })

    it("still reports the one bad key when it sits next to valid $or alternatives", () => {
      const query = "filters[$or][0][title][$eq]=a&filters[$or][1][titlee][$eq]=b"
      const { rejected } = rejectedFor(query)
      expect(rejected).toEqual(["filters[$or][1][titlee][$eq]"])
    })
  })

  describe("isSafeFieldIdentifier", () => {
    it("accepts slugify-style slugs", () => {
      expect(isSafeFieldIdentifier("title")).toBe(true)
      expect(isSafeFieldIdentifier("my-field_2")).toBe(true)
      expect(isSafeFieldIdentifier("A".repeat(64))).toBe(true)
    })
    it("rejects quotes, whitespace, SQL metachars, and over-long input", () => {
      expect(isSafeFieldIdentifier("pri'ce")).toBe(false)
      expect(isSafeFieldIdentifier("a b")).toBe(false)
      expect(isSafeFieldIdentifier("a);--")).toBe(false)
      expect(isSafeFieldIdentifier("")).toBe(false)
      expect(isSafeFieldIdentifier("A".repeat(65))).toBe(false)
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

    it("drops a condition whose field is not a plain slug (SQL-injection guard)", () => {
      const conditions = [
        { field: "title", operator: "$eq", value: "ok" },
        { field: "price'); DROP TABLE content_entries;--", operator: "$eq", value: "x" },
      ]
      const { fragments, params } = buildFilterSQL(conditions, [])
      expect(fragments).toHaveLength(1)
      expect(fragments[0]).toBe('"data"->>\'title\' = $1')
      expect(params).toEqual(["ok"])
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

    // Fifth external audit, the headline finding: `filters[$or][0][...]` /
    // `filters[$or][1][...]` — two SEPARATE array indices, the real
    // Strapi-style shape for "this field is X OR Y" — used to get AND'ed
    // together instead of OR'd (each index became its own `(...)`
    // fragment, and the flat `fragments` array is always joined with AND
    // at the call site), so two mutually-exclusive alternatives on the
    // SAME field always produced zero rows. This is the exact repro.
    it("ORs DIFFERENT $or array indices together (Strapi: $or: [{status: 'archived'}, {status: 'deleted'}])", () => {
      const orGroups = [
        [{ field: "status", operator: "$eq", value: "archived" }],
        [{ field: "status", operator: "$eq", value: "deleted" }],
      ]
      const { fragments, params } = buildFilterSQL([], orGroups)

      expect(fragments[0]).toBe('("data"->>\'status\' = $1 OR "data"->>\'status\' = $2)')
      expect(params).toEqual(["archived", "deleted"])
    })

    // Multiple conditions at the SAME $or index are one alternative's own
    // keys (Strapi: $or: [{status: 'featured', price: {$gt: 500}}]) and
    // must be AND'ed together, not OR'd — the inverse of the bug above.
    it("ANDs multiple conditions within the SAME $or index, as one single alternative", () => {
      const orGroups = [[
        { field: "status", operator: "$eq", value: "featured" },
        { field: "price", operator: "$gt", value: "500" },
      ]]
      const { fragments, params } = buildFilterSQL([], orGroups)

      expect(fragments[0]).toBe('(("data"->>\'status\' = $1 AND ("data"->>\'price\')::numeric > $2))')
      expect(params).toEqual(["featured", 500])
    })

    it("combines a same-index AND-group with a different-index OR alternative correctly", () => {
      const orGroups = [
        [
          { field: "status", operator: "$eq", value: "featured" },
          { field: "price", operator: "$gt", value: "500" },
        ],
        [{ field: "category", operator: "$eq", value: "clearance" }],
      ]
      const { fragments, params } = buildFilterSQL([], orGroups)

      expect(fragments[0]).toBe(
        '(("data"->>\'status\' = $1 AND ("data"->>\'price\')::numeric > $2) OR "data"->>\'category\' = $3)',
      )
      expect(params).toEqual(["featured", 500, "clearance"])
    })

    it("should handle $in operator with array expansion", () => {
      const conditions = [{ field: "category", operator: "$in", value: "a, b, c" }]
      const { fragments, params } = buildFilterSQL(conditions, [])

      expect(fragments[0]).toBe('"data"->>\'category\' IN ($1,$2,$3)')
      expect(params).toEqual(["a", "b", "c"])
    })

    it("handles $in with a real array value (the shape parseFilters now actually produces)", () => {
      const conditions = [{ field: "category", operator: "$in", value: ["a", "b", "c"] }]
      const { fragments, params } = buildFilterSQL(conditions, [])

      expect(fragments[0]).toBe('"data"->>\'category\' IN ($1,$2,$3)')
      expect(params).toEqual(["a", "b", "c"])
    })

    it("escapes LIKE wildcards in a $containsi value so '%' and '_' match literally", () => {
      const conditions = [
        { field: "title", operator: "$containsi", value: "50%" },
        { field: "title", operator: "$containsi", value: "a_b" },
      ]
      const { params } = buildFilterSQL(conditions, [])
      expect(params).toEqual(["%50\\%%", "%a\\_b%"])
    })

    it("accepts $containsi and generates the same case-insensitive ILIKE as $contains", () => {
      const conditions = [{ field: "title", operator: "$containsi", value: "Next" }]
      const { fragments, params } = buildFilterSQL(conditions, [])

      expect(fragments[0]).toBe('"data"->>\'title\' ILIKE $1')
      expect(params).toEqual(["%Next%"])
    })

    // Fifth external audit: $gt/$gte/$lt/$lte always cast to ::numeric,
    // which is a raw Postgres error for a genuine date string. Falls back
    // to a timestamptz comparison instead of crashing the whole query.
    it("falls back to a timestamptz comparison for $gte on a date value instead of casting it to ::numeric", () => {
      const conditions = [{ field: "publishedAt", operator: "$gte", value: "2026-01-15" }]
      const { fragments, params } = buildFilterSQL(conditions, [])

      expect(fragments[0]).toBe('("data"->>\'publishedAt\')::timestamptz >= $1::timestamptz')
      expect(params).toEqual([new Date("2026-01-15").toISOString()])
    })

    it("still uses the numeric path for $gte when the value genuinely is a number", () => {
      const conditions = [{ field: "price", operator: "$gte", value: "100" }]
      const { fragments, params } = buildFilterSQL(conditions, [])

      expect(fragments[0]).toBe('("data"->>\'price\')::numeric >= $1')
      expect(params).toEqual([100])
    })

    it("drops a $gte condition whose value is neither a number nor a parseable date, instead of crashing the query", () => {
      const conditions = [{ field: "price", operator: "$gte", value: "not-a-number-or-date!!" }]
      const { fragments } = buildFilterSQL(conditions, [])
      expect(fragments).toHaveLength(0)
    })
  })
})

describe("parseFilters — condition cap", () => {
  it("rejects filter keys beyond the 20-condition cap instead of silently dropping them (which would serve more rows than asked)", () => {
    const params = new URLSearchParams()
    for (let i = 0; i < 22; i++) params.append(`filters[title][$ne]`, `x${i}`)
    const allowed = new Set(["title"])
    const { conditions, rejected } = parseFilters(params, allowed)
    expect(conditions).toHaveLength(20)
    expect(rejected).toHaveLength(2)
  })
})
