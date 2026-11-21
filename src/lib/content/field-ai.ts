import { isFieldVisible, isStudioFieldEnabled } from "@/lib/field-visibility"

export type FieldAiMode = "off" | "polish" | "write"
export type FieldAiAction = "generate" | "improve" | "summarize" | "translate" | "seo"
export type AiFormKind = "contentType" | "singleType" | "component"

export interface AiFormTarget {
  kind: AiFormKind
  slug: string
}

export interface AiField {
  name: string
  slug: string
  type: string
  options?: unknown
  showInCms?: boolean
}

export type AiSeoSuggestion = { meta_title: string; meta_description: string }
export type AiFieldValue = string | AiSeoSuggestion
export const SMART_FILL_CREDIT_COST = 2

const WRITING_TYPES = new Set(["textarea", "richText", "markdown"])
const SENSITIVE_FIELD = /(^|[-_\s])(password|passwd|kata[-_\s]+sandi|secret|token|apikey|api[-_\s]+key|credential|credentials|email|phone|telepon|nik)([-_\s]|$)/i
const FACTUAL_FIELD = /^(?:slug|uid|price|harga|currency|mata-uang|date|tanggal|(?:tanggal|jadwal)-panen|harvest-(?:date|schedule)|status|certification|sertifikasi|contact|kontak|iban)$/i

export function aiFieldOptions(value: unknown): Record<string, unknown> {
  let option = value
  if (typeof option === "string") {
    try { option = JSON.parse(option) } catch { return {} }
  }
  return option && typeof option === "object" && !Array.isArray(option)
    ? option as Record<string, unknown>
    : {}
}

export function supportsFieldAi(field: AiField): boolean {
  const slug = field.slug.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/_/g, "-")
  return (field.type === "text" || field.type === "seo" || WRITING_TYPES.has(field.type))
    && !SENSITIVE_FIELD.test(slug) && !SENSITIVE_FIELD.test(field.name) && !FACTUAL_FIELD.test(slug)
    && aiFieldOptions(field.options).aiSensitive !== true
}

export function getFieldAiMode(field: AiField, target?: AiFormTarget): FieldAiMode {
  if (!supportsFieldAi(field)) return "off"
  const { aiAssist } = aiFieldOptions(field.options)
  if (aiAssist === "off" || aiAssist === "polish" || aiAssist === "write") return aiAssist
  if (WRITING_TYPES.has(field.type) || field.type === "seo") return "write"
  if (target?.kind === "contentType" && target.slug === "commodities" &&
      (field.slug === "name" || field.slug === "origin-location-description")) return "polish"
  return field.slug === "title" || field.slug === "judul" ? "write" : "off"
}

export function fieldAiActions(field: AiField, target: AiFormTarget): readonly FieldAiAction[] {
  const mode = getFieldAiMode(field, target)
  if (mode === "off") return []
  if (field.type === "seo") return ["seo"]
  if (mode === "polish") return ["improve"]
  return field.type === "text"
    ? ["generate", "improve"]
    : ["generate", "improve", "summarize", "translate"]
}

export function smartFillFields(fields: readonly AiField[], target: AiFormTarget) {
  return fields.filter((field) => isStudioFieldEnabled(field) && getFieldAiMode(field, target) === "write")
}

export function isAiFieldEmpty(value: unknown, field?: AiField): boolean {
  if (value == null) return true
  if (typeof value === "string") return value.replace(/<[^>]+>|&nbsp;/g, " ").trim() === ""
  if (field?.type === "seo" && typeof value === "object" && !Array.isArray(value)) {
    const seo = value as Partial<AiSeoSuggestion>
    return isAiFieldEmpty(seo.meta_title) && isAiFieldEmpty(seo.meta_description)
  }
  return typeof value === "object" && Object.keys(value).length === 0
}

export function visibleAiFields(fields: readonly AiField[], values: Record<string, unknown>) {
  return fields.filter((field) => isStudioFieldEnabled(field) && isFieldVisible(field, values))
}

function normalizeLine(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, limit) : ""
}

export function normalizeAiFieldValue(field: AiField, value: unknown): AiFieldValue | null {
  if (field.type === "seo" && value && typeof value === "object" && !Array.isArray(value)) {
    const source = value as Record<string, unknown>
    const meta_title = normalizeLine(source.meta_title, 60)
    const meta_description = normalizeLine(source.meta_description, 160)
    return meta_title && meta_description ? { meta_title, meta_description } : null
  }
  if (field.type === "seo" || typeof value !== "string" || isAiFieldEmpty(value)) return null
  return field.type === "text" ? normalizeLine(value, 240) : value.trim().slice(0, 24000)
}

export function applyAiFieldValue(field: AiField, current: unknown, suggestion: AiFieldValue): unknown {
  if (field.type !== "seo" || typeof suggestion === "string") return suggestion
  const existing = current && typeof current === "object" && !Array.isArray(current) ? current : {}
  return { ...existing, ...suggestion }
}

export function applyAiSuggestions(
  fields: readonly AiField[],
  current: Record<string, unknown>,
  suggestions: Record<string, AiFieldValue>,
  target: AiFormTarget,
): Record<string, unknown> {
  const accepted = smartFillFields(visibleAiFields(fields, current), target).flatMap((field) => {
    if (!Object.hasOwn(suggestions, field.slug)) return []
    const suggestion = normalizeAiFieldValue(field, suggestions[field.slug])
    return suggestion === null ? [] : [[field.slug, applyAiFieldValue(field, current[field.slug], suggestion)]]
  })
  return { ...current, ...Object.fromEntries(accepted) }
}

export function aiPreviewText(value: string, field: AiField): string {
  return field.type === "richText"
    ? value.replace(/<\/(?:p|h[1-6]|li)>/gi, "\n").replace(/<[^>]+>/g, "").trim()
    : value
}

export function aiFormContext(fields: readonly AiField[], values: Record<string, unknown>, target: AiFormTarget) {
  return Object.fromEntries(visibleAiFields(fields, values)
    .filter((field) => field.type !== "seo" && getFieldAiMode(field, target) !== "off" && typeof values[field.slug] === "string" && !isAiFieldEmpty(values[field.slug]))
    .slice(0, 12)
    .map((field) => [field.slug, (values[field.slug] as string).slice(0, 1800)]))
}
