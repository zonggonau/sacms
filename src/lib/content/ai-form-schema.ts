import { z } from "zod/v4"
import { getTenantDbById } from "@/lib/database"
import { resolveWritableContentType } from "@/lib/content/entry-service"
import { parseSchemaFieldOptions } from "@/actions/content-pipeline"
import { isWorkspaceAdmin } from "@/lib/rbac/staff"
import { normalizeAiFieldValue, supportsFieldAi, type AiField, type AiFormTarget } from "@/lib/content/field-ai"
import { isStudioFieldEnabled } from "@/lib/field-visibility"
import { sanitizeHtml } from "@/lib/sanitize-html"

export const aiFormTargetSchema = z.object({
  kind: z.enum(["contentType", "singleType", "component"]),
  slug: z.string().min(1).max(128),
})

export const aiFormContextSchema = z.record(z.string().max(128), z.string().max(1800))

export async function loadAiFormSchema(
  target: AiFormTarget,
  access: { tenantId: string; role: string },
): Promise<{ name: string; fields: AiField[] } | null> {
  if (target.kind === "singleType" && !isWorkspaceAdmin(access.role)) return null
  const client = await getTenantDbById(access.tenantId)
  if (target.kind === "contentType") {
    const resolved = await resolveWritableContentType(client, target.slug, { tenantId: access.tenantId })
    return resolved.ok ? { name: resolved.data.contentType.name, fields: resolved.data.fields } : null
  }

  const where = {
    slug: target.slug,
    draftTemplateId: null,
    OR: [
      { tenantId: access.tenantId },
      { tenantId: null, tenants: { some: { tenantId: access.tenantId, enabled: true } } },
      ...(target.kind === "component" ? [{ tenantId: null, tenants: { none: {} } }] : []),
    ],
  }
  const include = { schemaFields: { orderBy: { order: "asc" as const } } }
  const orderBy = { tenantId: { sort: "desc" as const, nulls: "last" as const } }
  const model = target.kind === "singleType"
    ? await client.singleType.findFirst({ where: { ...where, showInCms: true }, include, orderBy })
    : await client.component.findFirst({ where, include, orderBy })
  return model ? { name: model.name, fields: parseSchemaFieldOptions(model.schemaFields) } : null
}

export function filterAiContext(fields: AiField[], context: Record<string, string> = {}) {
  return Object.fromEntries(fields.filter((field) => supportsFieldAi(field) && isStudioFieldEnabled(field))
    .filter((field) => field.type !== "seo" && Object.hasOwn(context, field.slug) && context[field.slug].trim())
    .slice(0, 12)
    .map((field) => [field.name, context[field.slug]]))
}

export function isAiQuotaError(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error && error.status === 429
}

export function normalizeGeneratedField(field: AiField, value: unknown) {
  const normalized = normalizeAiFieldValue(field, value)
  return field.type === "richText" && typeof normalized === "string"
    ? normalizeAiFieldValue(field, sanitizeHtml(normalized))
    : normalized
}
