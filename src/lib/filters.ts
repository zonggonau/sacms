import { Prisma } from "@prisma/client"

/**
 * Advanced filtering engine for the Public API.
 * Translates Strapi-style filter params to Prisma JSON field queries.
 *
 * Supports:
 *   ?filters[field][$op]=value
 *   ?filters[$or][0][field][$op]=value
 *   ?filters[$and][0][field][$op]=value
 *
 * $and conditions are folded into the same flat, implicitly-AND'ed
 * `conditions` list as plain `filters[field][$op]` ones — AND-of-AND is
 * still just AND, so this doesn't need its own branch in buildFilterSQL.
 * This is one level of grouping, matching $or; it does not support nesting
 * an $or group inside $and or vice versa.
 *
 * Operators: $eq, $ne, $gt, $gte, $lt, $lte, $contains, $startsWith, $endsWith,
 *            $in, $notIn, $null, $notNull
 */

const ALLOWED_OPERATORS = new Set([
  "$eq",
  "$ne",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$contains",
  // Fifth external audit: documented (and used by real callers, e.g. the
  // @sacms/sdk README) as a case-insensitive contains, but never actually
  // accepted — silently dropped like any other unrecognized operator.
  // $contains is already case-insensitive (ILIKE), so this is a plain
  // alias, not new SQL-building logic (see conditionToSQL).
  "$containsi",
  "$startsWith",
  "$endsWith",
  "$in",
  "$notIn",
  "$null",
  "$notNull",
])

// Max filter depth to prevent abuse
const MAX_FILTER_DEPTH = 4
// Max number of filter conditions
const MAX_CONDITIONS = 20

interface FilterCondition {
  field: string
  operator: string
  value: unknown
}

/**
 * Parse filter query params from URLSearchParams into structured conditions.
 * Input: ?filters[title][$contains]=next&filters[price][$gte]=100
 *
 * Fifth external audit: a filter key this function couldn't recognize
 * (unknown field, unknown operator, or a shape it didn't parse at all) used
 * to be silently dropped — the single most dangerous finding, since a
 * caller whose ENTIRE filter consisted of one typo'd key got back a query
 * with NO filter conditions at all, i.e. every row, instead of an error or
 * zero rows. `rejected` surfaces every such key so the caller can refuse
 * the request instead of silently serving more than was asked for.
 */
export function parseFilters(
  searchParams: URLSearchParams,
  allowedFields: Set<string>
): { conditions: FilterCondition[]; orGroups: FilterCondition[][]; rejected: string[] } {
  const conditions: FilterCondition[] = []
  const orGroups: FilterCondition[][] = []
  const rejected: string[] = []
  // Fifth external audit: the SDK (and real Strapi convention) serializes
  // an array-valued operator ($in/$notIn) as indexed sub-keys —
  // filters[tags][$in][0]=a&filters[tags][$in][1]=b — not a single
  // comma-joined value. That 3-bracket shape matched NONE of this
  // function's branches before (not $or/$and, and the plain
  // `filters[field][$op]` branch required p3 to be absent), so it was
  // silently dropped in full: confirmed as the actual root cause behind
  // "$in is ignored". Accumulated here by (field, op), index order
  // preserved, into one condition per pair once the whole query is read.
  const arrayAccumulators = new Map<string, Map<number, string>>()
  let conditionCount = 0

  for (const [key, value] of searchParams.entries()) {
    if (!key.startsWith("filters[")) continue
    // Over the cap: reject instead of `break` — silently dropping the
    // remaining conditions would serve MORE rows than the caller asked
    // for, the exact failure `rejected` exists to prevent.
    if (conditionCount >= MAX_CONDITIONS) {
      rejected.push(key)
      continue
    }

    // Parse: filters[field][$op], filters[field][$op][idx], or filters[$or/$and][idx][field][$op]
    const parts = key.match(/filters\[([^\]]+)\](?:\[([^\]]+)\])?(?:\[([^\]]+)\])?(?:\[([^\]]+)\])?/)
    if (!parts) {
      rejected.push(key)
      continue
    }

    const [, p1, p2, p3, p4] = parts

    if (p1 === "$or" && p2 && p3 && p4) {
      // filters[$or][0][field][$op]
      const idx = parseInt(p2)
      if (isNaN(idx) || idx < 0 || idx > 10) {
        rejected.push(key)
        continue
      }
      const field = p3
      const op = p4

      if (!allowedFields.has(field) || !ALLOWED_OPERATORS.has(op)) {
        rejected.push(key)
        continue
      }

      while (orGroups.length <= idx) orGroups.push([])
      orGroups[idx].push({ field, operator: op, value })
      conditionCount++
    } else if (p1 === "$and" && p2 && p3 && p4) {
      // filters[$and][0][field][$op] — folds into the flat `conditions`
      // list; see this file's top-of-file comment for why.
      const field = p3
      const op = p4

      if (!allowedFields.has(field) || !ALLOWED_OPERATORS.has(op)) {
        rejected.push(key)
        continue
      }

      conditions.push({ field, operator: op, value })
      conditionCount++
    } else if (p1 && p2 && p3 && !p4 && /^\d+$/.test(p3)) {
      // filters[field][$op][idx] — array-valued operator, see this
      // function's own header comment.
      const field = p1
      const op = p2
      const idx = parseInt(p3, 10)

      if (!allowedFields.has(field) || !ALLOWED_OPERATORS.has(op) || idx > 100) {
        rejected.push(key)
        continue
      }

      const accKey = `${field}\u0000${op}`
      if (!arrayAccumulators.has(accKey)) arrayAccumulators.set(accKey, new Map())
      arrayAccumulators.get(accKey)!.set(idx, value)
      conditionCount++
    } else if (p1 && p2 && !p3) {
      // filters[field][$op]
      const field = p1
      const op = p2

      if (!allowedFields.has(field) || !ALLOWED_OPERATORS.has(op)) {
        rejected.push(key)
        continue
      }

      conditions.push({ field, operator: op, value })
      conditionCount++
    } else {
      rejected.push(key)
    }
  }

  for (const [accKey, byIndex] of arrayAccumulators) {
    const [field, op] = accKey.split("\u0000")
    const values = Array.from(byIndex.keys())
      .sort((a, b) => a - b)
      .map((idx) => byIndex.get(idx)!)
    conditions.push({ field, operator: op, value: values })
  }

  return { conditions, orGroups, rejected }
}

/**
 * Build Prisma-compatible raw SQL WHERE clause fragments for JSON data field filtering.
 * All values are parameterized to prevent SQL injection.
 *
 * Returns { whereClause: string, params: unknown[] } for use in Prisma.$queryRawUnsafe
 */
export function buildFilterSQL(
  conditions: FilterCondition[],
  orGroups: FilterCondition[][],
  paramOffset: number = 1
): { fragments: string[]; params: unknown[]; nextParam: number } {
  const fragments: string[] = []
  const params: unknown[] = []
  let paramIdx = paramOffset

  for (const cond of conditions) {
    const result = conditionToSQL(cond, paramIdx)
    if (result) {
      fragments.push(result.sql)
      params.push(...result.params)
      paramIdx += result.params.length
    }
  }

  // Fifth external audit: `orGroups[i]` is every condition belonging to
  // the SAME `$or` array index — i.e. ONE alternative, whose own
  // conditions must be AND'ed together (Strapi semantics: $or: [{a, b},
  // {c}] means (a AND b) OR (c)). This used to build each index's own
  // `(...)` fragment by OR-ing ITS conditions together, then AND the
  // per-index fragments against each other at the top level — exactly
  // backwards on both axes. For the common single-condition-per-index
  // case (filters[$or][0][field][$eq]=x&filters[$or][1][field][$eq]=y,
  // i.e. "field = x OR field = y"), that inversion collapsed straight to
  // `field = x AND field = y`, impossible for one field to satisfy at
  // once — confirmed as exactly why $or always returned zero rows.
  const orAlternatives: string[] = []
  for (const group of orGroups) {
    if (group.length === 0) continue
    const groupFragments: string[] = []
    for (const cond of group) {
      const result = conditionToSQL(cond, paramIdx)
      if (result) {
        groupFragments.push(result.sql)
        params.push(...result.params)
        paramIdx += result.params.length
      }
    }
    if (groupFragments.length > 0) {
      orAlternatives.push(groupFragments.length > 1 ? `(${groupFragments.join(" AND ")})` : groupFragments[0])
    }
  }
  if (orAlternatives.length > 0) {
    fragments.push(`(${orAlternatives.join(" OR ")})`)
  }

  return { fragments, params, nextParam: paramIdx }
}

function conditionToSQL(
  cond: FilterCondition,
  paramIdx: number
): { sql: string; params: unknown[] } | null {
  // Drop the whole condition if the (already field-whitelisted) slug is not a
  // plain identifier — never interpolate anything questionable into raw SQL,
  // and don't silently "fix" a hostile field by stripping characters out of it.
  if (!isSafeFieldIdentifier(cond.field)) return null
  const field = cond.field
  const jsonPath = `"data"->>'${field}'`
  const numericPath = `("data"->>'${field}')::numeric`

  switch (cond.operator) {
    case "$eq":
      return { sql: `${jsonPath} = $${paramIdx}`, params: [String(cond.value)] }
    case "$ne":
      return { sql: `${jsonPath} != $${paramIdx}`, params: [String(cond.value)] }
    case "$gt":
      return numericOrDateComparison(field, numericPath, ">", cond.value, paramIdx)
    case "$gte":
      return numericOrDateComparison(field, numericPath, ">=", cond.value, paramIdx)
    case "$lt":
      return numericOrDateComparison(field, numericPath, "<", cond.value, paramIdx)
    case "$lte":
      return numericOrDateComparison(field, numericPath, "<=", cond.value, paramIdx)
    case "$contains":
    // Fifth external audit: documented and expected to work (an alias for
    // the already-case-insensitive $contains, see ALLOWED_OPERATORS'
    // own comment) — no separate SQL needed, ILIKE is already
    // case-insensitive on Postgres.
    case "$containsi":
      return {
        sql: `${jsonPath} ILIKE $${paramIdx}`,
        params: [`%${escapeLike(String(cond.value))}%`],
      }
    case "$startsWith":
      return {
        sql: `${jsonPath} ILIKE $${paramIdx}`,
        params: [`${escapeLike(String(cond.value))}%`],
      }
    case "$endsWith":
      return {
        sql: `${jsonPath} ILIKE $${paramIdx}`,
        params: [`%${escapeLike(String(cond.value))}`],
      }
    case "$in": {
      const values = toValueArray(cond.value)
      const placeholders = values.map((_, i) => `$${paramIdx + i}`).join(",")
      return {
        sql: `${jsonPath} IN (${placeholders})`,
        params: values,
      }
    }
    case "$notIn": {
      const values = toValueArray(cond.value)
      const placeholders = values.map((_, i) => `$${paramIdx + i}`).join(",")
      return {
        sql: `${jsonPath} NOT IN (${placeholders})`,
        params: values,
      }
    }
    case "$null":
      return { sql: `${jsonPath} IS NULL`, params: [] }
    case "$notNull":
      return { sql: `${jsonPath} IS NOT NULL`, params: [] }
    default:
      return null
  }
}

/** Accepts either a real array (the indexed filters[field][$op][idx]
 *  shape — see parseFilters) or a single comma-joined string (kept for any
 *  caller still sending the flat `filters[field][$in]=a,b,c` form), always
 *  producing a plain string array either way. */
function toValueArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  return String(value).split(",").map((v) => v.trim())
}

/**
 * Fifth external audit: $gt/$gte/$lt/$lte always cast the JSON value to
 * ::numeric — correct for a number/currency/percent field, but a raw SQL
 * error (or, depending on the exact value, silently wrong results) for a
 * date/datetime field, since a date string like "2026-01-15" is never
 * valid `numeric` input. No field-type metadata reaches this function (by
 * design — see conditionToSQL's own field-identifier comment), so this
 * infers it from the VALUE instead: a value that parses as a number uses
 * the existing numeric path unchanged; one that doesn't but parses as a
 * real date/datetime falls back to a timestamptz comparison instead of
 * erroring the whole query.
 */
function numericOrDateComparison(
  field: string,
  numericPath: string,
  op: ">" | ">=" | "<" | "<=",
  value: unknown,
  paramIdx: number,
): { sql: string; params: unknown[] } | null {
  const asNumber = Number(value)
  if (value !== "" && value !== null && value !== undefined && !Number.isNaN(asNumber)) {
    return { sql: `${numericPath} ${op} $${paramIdx}`, params: [asNumber] }
  }
  const asDate = new Date(String(value))
  if (!Number.isNaN(asDate.getTime())) {
    return { sql: `("data"->>'${field}')::timestamptz ${op} $${paramIdx}::timestamptz`, params: [asDate.toISOString()] }
  }
  // Neither a number nor a parseable date — drop the condition rather than
  // let a genuinely invalid value crash the whole query with a raw
  // Postgres cast error.
  return null
}

/**
 * Sanitize field name to prevent SQL injection in JSON path.
 * Only allow alphanumeric, underscore, and dash.
 */
function sanitizeFieldName(field: string): string {
  return field.replace(/[^a-zA-Z0-9_-]/g, "")
}

/**
 * A field slug is safe to interpolate into a raw `"data"->>'<slug>'` expression
 * only if it contains nothing that could break out of the single-quoted JSON key
 * literal. Slugs are `slugify()`-generated (lowercase alphanumerics, `_`, `-`),
 * so this both matches every legitimate slug and rejects `'`, `\`, whitespace,
 * and SQL metacharacters. Callers should already have checked the slug against
 * the content type's known fields; this is the last-line guard.
 */
export function isSafeFieldIdentifier(field: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(field)
}

/**
 * Escape LIKE wildcards in values.
 */
function escapeLike(value: string): string {
  return value.replace(/%/g, "\\%").replace(/_/g, "\\_")
}

/**
 * Parse field selection from query params.
 * ?fields=title,slug,author → ["title", "slug", "author"]
 */
export function parseFieldSelection(
  searchParams: URLSearchParams,
  allowedFields: Set<string>
): string[] | null {
  const fieldsParam = searchParams.get("fields")
  if (!fieldsParam) return null

  const fields = fieldsParam
    .split(",")
    .map((f) => f.trim())
    .filter((f) => allowedFields.has(f))

  return fields.length > 0 ? fields : null
}

/**
 * Parse populate (relation expansion) from query params.
 * ?populate=author,category → ["author", "category"]
 * ?populate=* → all relations
 */
export function parsePopulate(
  searchParams: URLSearchParams
): string[] | "*" | null {
  const populate = searchParams.get("populate")
  if (!populate) return null
  if (populate === "*") return "*"
  return populate.split(",").map((p) => p.trim()).filter(Boolean)
}

/**
 * Parse sort param: "createdAt:desc" → { field, order }
 */
export function parseSort(
  searchParams: URLSearchParams
): { field: string; order: "asc" | "desc" } {
  const sort = searchParams.get("sort") || "createdAt:desc"
  const [field, order] = sort.split(":")
  return {
    field: sanitizeFieldName(field || "createdAt"),
    order: order === "asc" ? "asc" : "desc",
  }
}

/**
 * Apply field selection to parsed entry data.
 * Returns only the selected fields from the data object.
 */
export function applyFieldSelection(
  data: Record<string, unknown>,
  fields: string[] | null
): Record<string, unknown> {
  if (!fields) return data
  const result: Record<string, unknown> = {}
  for (const field of fields) {
    if (field in data) {
      result[field] = data[field]
    }
  }
  return result
}
