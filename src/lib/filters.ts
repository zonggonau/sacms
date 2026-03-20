import { Prisma } from "@prisma/client"

/**
 * Advanced filtering engine for the Public API.
 * Translates Strapi-style filter params to Prisma JSON field queries.
 *
 * Supports:
 *   ?filters[field][$op]=value
 *   ?filters[$or][0][field][$op]=value
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
 */
export function parseFilters(
  searchParams: URLSearchParams,
  allowedFields: Set<string>
): { conditions: FilterCondition[]; orGroups: FilterCondition[][] } {
  const conditions: FilterCondition[] = []
  const orGroups: FilterCondition[][] = []
  let conditionCount = 0

  for (const [key, value] of searchParams.entries()) {
    if (!key.startsWith("filters[")) continue
    if (conditionCount >= MAX_CONDITIONS) break

    // Parse: filters[field][$op] or filters[$or][idx][field][$op]
    const parts = key.match(/filters\[([^\]]+)\](?:\[([^\]]+)\])?(?:\[([^\]]+)\])?(?:\[([^\]]+)\])?/)
    if (!parts) continue

    const [, p1, p2, p3, p4] = parts

    if (p1 === "$or" && p2 && p3 && p4) {
      // filters[$or][0][field][$op]
      const idx = parseInt(p2)
      if (isNaN(idx) || idx < 0 || idx > 10) continue
      const field = p3
      const op = p4

      if (!allowedFields.has(field) || !ALLOWED_OPERATORS.has(op)) continue

      while (orGroups.length <= idx) orGroups.push([])
      orGroups[idx].push({ field, operator: op, value })
      conditionCount++
    } else if (p1 && p2 && !p3) {
      // filters[field][$op]
      const field = p1
      const op = p2

      if (!allowedFields.has(field) || !ALLOWED_OPERATORS.has(op)) continue

      conditions.push({ field, operator: op, value })
      conditionCount++
    }
  }

  return { conditions, orGroups }
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

  // OR groups
  for (const group of orGroups) {
    if (group.length === 0) continue
    const orFragments: string[] = []
    for (const cond of group) {
      const result = conditionToSQL(cond, paramIdx)
      if (result) {
        orFragments.push(result.sql)
        params.push(...result.params)
        paramIdx += result.params.length
      }
    }
    if (orFragments.length > 0) {
      fragments.push(`(${orFragments.join(" OR ")})`)
    }
  }

  return { fragments, params, nextParam: paramIdx }
}

function conditionToSQL(
  cond: FilterCondition,
  paramIdx: number
): { sql: string; params: unknown[] } | null {
  const jsonPath = `"data"->>'${sanitizeFieldName(cond.field)}'`
  const numericPath = `("data"->>'${sanitizeFieldName(cond.field)}')::numeric`

  switch (cond.operator) {
    case "$eq":
      return { sql: `${jsonPath} = $${paramIdx}`, params: [String(cond.value)] }
    case "$ne":
      return { sql: `${jsonPath} != $${paramIdx}`, params: [String(cond.value)] }
    case "$gt":
      return {
        sql: `${numericPath} > $${paramIdx}`,
        params: [Number(cond.value)],
      }
    case "$gte":
      return {
        sql: `${numericPath} >= $${paramIdx}`,
        params: [Number(cond.value)],
      }
    case "$lt":
      return {
        sql: `${numericPath} < $${paramIdx}`,
        params: [Number(cond.value)],
      }
    case "$lte":
      return {
        sql: `${numericPath} <= $${paramIdx}`,
        params: [Number(cond.value)],
      }
    case "$contains":
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
      const values = String(cond.value).split(",").map((v) => v.trim())
      const placeholders = values.map((_, i) => `$${paramIdx + i}`).join(",")
      return {
        sql: `${jsonPath} IN (${placeholders})`,
        params: values,
      }
    }
    case "$notIn": {
      const values = String(cond.value).split(",").map((v) => v.trim())
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

/**
 * Sanitize field name to prevent SQL injection in JSON path.
 * Only allow alphanumeric, underscore, and dash.
 */
function sanitizeFieldName(field: string): string {
  return field.replace(/[^a-zA-Z0-9_-]/g, "")
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
