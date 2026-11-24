import { z } from "zod"
import { getTenantDb } from "@/lib/database"

const model = z.object({
  slug: z.string(),
  fields: z.array(z.object({ slug: z.string(), type: z.string(), required: z.boolean().optional(), relationSlug: z.string().nullable().optional() })).optional(),
})
const groups = ["contentTypes", "singleTypes", "components"] as const
const schema = z.object({
  contentTypes: z.array(model).default([]), singleTypes: z.array(model).default([]), components: z.array(model).default([]),
})
export function schemaRequirements(value: unknown) {
  const parsed = schema.parse(value)
  return groups.flatMap(kind => parsed[kind].map(m => ({ kind, slug: m.slug, fields: m.fields ?? [] })))
}
export async function activeSchema(tenantId: string, slug: string) {
  const db = await getTenantDb(slug)
  const select = { slug: true, schemaFields: { select: { slug: true, type: true, required: true, relationSlug: true } } } as const
  const where = { draftTemplateId: null, OR: [{ tenantId }, { tenantId: null, tenants: { some: { tenantId, enabled: true } } }] }
  const [contentTypes, singleTypes, components] = await Promise.all([
    db.contentType.findMany({ where, select }), db.singleType.findMany({ where, select }), db.component.findMany({ where: { ...where, deletedAt: null }, select }),
  ])
  return groups.flatMap(kind => ({ contentTypes, singleTypes, components })[kind].map(m => ({ kind, slug: m.slug, fields: m.schemaFields })))
}

export function compareSchema(saved: unknown, active: Awaited<ReturnType<typeof activeSchema>>) {
  const requirements = z.array(model.extend({ kind: z.enum(groups) })).safeParse(saved)
  if (!requirements.success) return { status: "unknown", reason: "No schema snapshot was recorded with this source revision." }
  const issues: string[] = []
  for (const required of requirements.data) {
    const current = active.find(m => m.kind === required.kind && m.slug === required.slug)
    const name = required.kind + "/" + required.slug
    if (!current) issues.push(name + " missing")
    else for (const field of required.fields ?? []) {
      if (!current.fields.some(f => f.slug === field.slug && f.type === field.type && (!field.relationSlug || f.relationSlug === field.relationSlug) && (field.required !== true || f.required))) issues.push(name + "/" + field.slug + " missing or its definition changed")
    }
  }
  return { status: issues.length ? "schema_changed" : "matches_snapshot", issues }
}
