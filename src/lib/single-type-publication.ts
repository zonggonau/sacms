import { Prisma } from "@/lib/database"
import { invalidatePattern } from "@/lib/cache"

type Assignment = {
  data: unknown
  draftData?: unknown
  publishedAt: Date | null
  updatedAt: Date
}

export function parseSingleTypeData(value: unknown): Record<string, unknown> {
  let parsed: unknown = value
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return {}
    }
  }

  return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {}
}

export function readSingleTypeAssignment(assignment: Assignment, includeDraft = false) {
  const draft = includeDraft ? assignment.draftData : null
  return {
    data: parseSingleTypeData(draft ?? assignment.data),
    updatedAt: draft == null && assignment.publishedAt ? assignment.publishedAt : assignment.updatedAt,
    isDraft: draft != null || !assignment.publishedAt,
  }
}

export function singleTypeContentWrite(data: Record<string, unknown>, publish: boolean) {
  const payload = JSON.parse(JSON.stringify(data)) as Prisma.InputJsonObject
  return publish
    ? { data: payload, publishedAt: new Date(), draftData: Prisma.DbNull }
    : { draftData: payload }
}

export async function invalidateSingleTypePublication(tenantId: string, slug: string) {
  await Promise.all([
    invalidatePattern(`single:${tenantId}:${slug}:*`),
    invalidatePattern(`graphql:${tenantId}:*`),
  ])
}
