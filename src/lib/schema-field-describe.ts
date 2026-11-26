import { FIELD_TYPES } from "@/lib/field-types"

/**
 * Plain-text summary of one field for the AI schema review screen: its type
 * name in words, what it points at, and anything that will block the save.
 * Kept pure and client-safe so the review card and its tests share one rule.
 */

export interface ReviewFieldOptions {
  choices?: unknown[]
  relationType?: string
  targetModel?: string
  repeatable?: boolean
  allowedComponents?: string[]
  componentSlug?: string
}

export interface ReviewField {
  name: string
  slug: string
  type: string
  relationSlug?: string
  componentSlug?: string
  options?: ReviewFieldOptions | null
}

export interface KnownSlugs {
  /** Content Type + Single Type slugs in the plan and already in the workspace. */
  models: Set<string>
  /** Component slugs in the plan and already in the workspace. */
  components: Set<string>
}

export interface FieldReview {
  typeLabel: string
  /** What the field points at or holds, e.g. "→ authors (satu)", "3 pilihan". */
  detail: string | null
  /** Set when the server would reject this field on save. */
  warning: string | null
}

export function describeReviewField(field: ReviewField, known: KnownSlugs): FieldReview {
  const typeLabel = FIELD_TYPES.find((f) => f.type === field.type)?.label ?? field.type
  const opts: ReviewFieldOptions = field.options ?? {}

  if (field.type === "relation") {
    if (opts.targetModel === "member") {
      return { typeLabel, detail: "→ Member (akun pengguna)", warning: null }
    }
    const target = field.relationSlug
    if (!target) {
      return { typeLabel, detail: null, warning: "Relasi belum menunjuk Content Type tujuan." }
    }
    const kind = opts.relationType === "oneToMany" || opts.relationType === "manyToMany" ? "daftar" : "satu"
    if (!known.models.has(target)) {
      return { typeLabel, detail: `→ ${target}`, warning: `"${target}" tidak ada di rencana ini maupun di workspace.` }
    }
    return { typeLabel, detail: `→ ${target} (${kind})`, warning: null }
  }

  if (field.type === "component") {
    const slug = field.componentSlug ?? opts.componentSlug
    if (!slug) {
      return { typeLabel, detail: null, warning: "Komponen belum dipilih." }
    }
    const detail = `${opts.repeatable ? "daftar " : ""}komponen ${slug}`
    if (!known.components.has(slug)) {
      return { typeLabel, detail, warning: `Komponen "${slug}" tidak ada di rencana ini maupun di workspace.` }
    }
    return { typeLabel, detail, warning: null }
  }

  if (field.type === "repeater") {
    const allowed = opts.allowedComponents ?? []
    return { typeLabel, detail: allowed.length ? `${allowed.length} jenis komponen` : "semua komponen", warning: null }
  }

  if (field.type === "select" || field.type === "multiselect") {
    const count = Array.isArray(opts.choices) ? opts.choices.length : 0
    if (count === 0) {
      return { typeLabel, detail: null, warning: "Belum ada pilihan. Akan ditolak saat disimpan." }
    }
    return { typeLabel, detail: `${count} pilihan`, warning: null }
  }

  return { typeLabel, detail: null, warning: null }
}
