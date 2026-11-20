import { db } from "@/lib/database"

const POLICY_KEYS = ["rateLimiting", "requestsPerMinute", "burstLimit", "corsOrigins"] as const

export function parseCorsOrigins(value: string): string[] {
  const origins = value.split(/[\s,]+/).filter(Boolean).map((candidate) => {
    const url = new URL(candidate)
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash
    ) throw new Error("Gunakan origin HTTP(S) tanpa path, parameter, atau tanda wildcard.")
    if (url.hostname.includes("*")) throw new Error("Origin CORS harus berupa alamat yang spesifik.")
    return url.origin
  })
  return [...new Set(origins)]
}

function readLimit(value: string | undefined, fallback: number, max: number) {
  const limit = Number(value)
  return Number.isInteger(limit) && limit >= 1 && limit <= max ? limit : fallback
}

export function readWorkspaceApiPolicy(tenantId: string, rows: { key: string; value: string }[]) {
  const settings = Object.fromEntries(rows.map(({ key, value }) => [key, value]))
  const storedCors = settings[`${tenantId}_corsOrigins`] || ""
  const corsValue = storedCors.trim() === "*" ? "" : storedCors
  let origins: string[] = []
  let invalidCors = false
  try {
    origins = parseCorsOrigins(corsValue)
  } catch {
    // Old data was accepted without validation. Keep the restriction active
    // while allowing operators to correct the stored value in API Settings.
    invalidCors = true
  }
  return {
    tenantId,
    rateLimiting: settings[`${tenantId}_rateLimiting`] === "true",
    requestsPerMinute: readLimit(settings[`${tenantId}_requestsPerMinute`], 60, 10_000),
    burstLimit: readLimit(settings[`${tenantId}_burstLimit`], 100, 1_000),
    corsOrigins: corsValue,
    origins,
    invalidCors,
  }
}

export async function getWorkspaceApiPolicy(tenantId: string) {
  const rows = await db.setting.findMany({
    where: { tenantId, key: { in: POLICY_KEYS.map((key) => `${tenantId}_${key}`) } },
    select: { key: true, value: true },
  })
  return readWorkspaceApiPolicy(tenantId, rows)
}

export async function resolveWorkspaceApiPolicy(path: string) {
  const match = /^\/api\/public\/([^/]+)\/(?:content|single|graphql|brand|openapi\.json)(?:\/|$)/.exec(path)
  if (!match) return null
  const reference = decodeURIComponent(match[1])
  const tenant = await db.tenant.findFirst({
    where: { OR: [{ id: reference }, { slug: reference }] },
    select: { id: true },
  })
  return tenant ? getWorkspaceApiPolicy(tenant.id) : null
}
