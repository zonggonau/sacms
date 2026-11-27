/**
 * Sample-content planner. Pure: reads a schema and says what could be seeded,
 * in what order, and what could not be filled automatically. Nothing is
 * written here; the runner in run.ts does that from this plan.
 *
 * Covers Content Types (many entries each) and Single Types (one entry per
 * Single Type). Components are not entries; they are filled inside the entry that
 * uses them.
 */
import { createHash } from "crypto"

export interface SampleField {
  name: string
  slug: string
  type: string
  required?: boolean
  options?: Record<string, any> | null
  relationSlug?: string | null
  componentSlug?: string | null
}

export interface SampleModel {
  name: string
  slug: string
  fields: SampleField[]
}

export interface SampleSchema {
  contentTypes: SampleModel[]
  singleTypes?: SampleModel[]
  components: SampleModel[]
}

export interface PlanOptions {
  /** Entries per Content Type. Clamped to 1..MAX_PER_TYPE. Single Types always get one. */
  perType?: number
  /** Slugs to consider (Content Types or Single Types). Omit for all. */
  contentTypes?: string[]
  /**
   * Existing data per model. Keys: `<slug>` for a Content Type's entry count,
   * `single:<slug>` for a Single Type that already has content.
   */
  existingCounts?: Record<string, number>
}

export const MAX_PER_TYPE = 10
export const DEFAULT_PER_TYPE = 3
export const SEED_VERSION = "2"

export type StepKind = "collection" | "single"

export interface PlanStep {
  kind: StepKind
  /** Model slug (not prefixed). */
  contentType: string
  count: number
  /** Content Type slugs whose entries this step links to; they are written first. */
  dependsOn: string[]
  /** Fields that will be filled, in schema order. */
  fields: string[]
}

export interface PlanIssue {
  contentType: string
  field?: string
  reason: string
}

export interface SamplePlan {
  perType: number
  batchKey: string
  steps: PlanStep[]
  /** Models left out entirely, with the reason. */
  skipped: PlanIssue[]
  /** Optional fields that cannot be filled automatically; the entry is still written without them. */
  unfillable: PlanIssue[]
}

const TITLE_LIKE = new Set(["title", "judul", "name", "nama"])
const MEDIA_TYPES = new Set(["media", "mediaMultiple", "file", "document_template"])
const MEMBER_TARGET = "member"

function clampPerType(n: number | undefined): number {
  if (!n || !Number.isFinite(n)) return DEFAULT_PER_TYPE
  return Math.min(MAX_PER_TYPE, Math.max(1, Math.floor(n)))
}

export function batchKeyFor(schema: SampleSchema, perType: number, selected: string[]): string {
  const material = JSON.stringify({
    v: SEED_VERSION,
    perType,
    selected: [...selected].sort(),
    shape: [...schema.contentTypes, ...(schema.singleTypes ?? [])].map((m) => [m.slug, m.fields.map((f) => [f.slug, f.type, f.relationSlug ?? null])]),
  })
  return createHash("sha256").update(material).digest("hex").slice(0, 16)
}

interface Verdict {
  fillable: boolean
  /** Content Type slug this field links to, if any. */
  dependsOn?: string
  reason?: string
  required: boolean
}

function judgeField(field: SampleField, schema: SampleSchema, collectionSlugs: Set<string>, existingCounts: Record<string, number>): Verdict {
  const required = !!field.required
  const no = (reason: string): Verdict => ({ fillable: false, reason, required })

  if (field.type === "slug") return { fillable: true, required }
  if (field.type === "relation") {
    if (field.options?.targetModel === MEMBER_TARGET) {
      return no("relasi ke Member butuh akun member yang sudah ada; isi manual")
    }
    const target = field.relationSlug
    if (!target) return no("relasi belum menunjuk Content Type tujuan")
    if (collectionSlugs.has(target)) return { fillable: true, dependsOn: target, required }
    if ((existingCounts[target] ?? 0) > 0) return { fillable: true, required }
    return no(`Content Type tujuan "${target}" tidak ada atau kosong`)
  }
  if (field.type === "component") {
    const comp = field.options?.componentSlug ?? field.componentSlug
    if (!comp) return no("komponen belum dipilih")
    if (!schema.components.some((c) => c.slug === comp)) return no(`komponen "${comp}" tidak ditemukan`)
    return { fillable: true, required }
  }
  if (field.type === "repeater") {
    const allowed: string[] = Array.isArray(field.options?.allowedComponents) ? field.options!.allowedComponents : []
    const usable = allowed.filter((s) => schema.components.some((c) => c.slug === s))
    if (usable.length === 0) return no("repeater tanpa komponen yang diizinkan")
    return { fillable: true, required }
  }
  if (MEDIA_TYPES.has(field.type)) return no("butuh file atau media yang diunggah; belum bisa dibuat otomatis")
  if (field.type === "password" || field.type === "uid") return no(`tipe ${field.type} tidak diisi otomatis`)
  return { fillable: true, required }
}

interface Node {
  kind: StepKind
  slug: string
  fields: SampleField[]
  key: string
}

/**
 * Builds the plan. A model is skipped when a required field cannot be filled,
 * when a relation it needs is unavailable, when it already has data, or when
 * it sits in a relation cycle. Optional unfillable fields are reported and the
 * entry is written without them.
 */
export function buildSamplePlan(schema: SampleSchema, options: PlanOptions): SamplePlan {
  const perType = clampPerType(options.perType)
  const existingCounts = options.existingCounts ?? {}
  const wanted = options.contentTypes ? new Set(options.contentTypes) : null
  const skipped: PlanIssue[] = []
  const unfillable: PlanIssue[] = []

  const allCollections = schema.contentTypes
  const allSingles = schema.singleTypes ?? []
  const collectionSlugs = new Set(allCollections.map((m) => m.slug))

  // Candidates after the user's filter and the already-populated check.
  const nodes: Node[] = []
  const consider = (kind: StepKind, model: SampleModel) => {
    if (wanted && !wanted.has(model.slug)) return
    const countKey = kind === "single" ? `single:${model.slug}` : model.slug
    if ((existingCounts[countKey] ?? 0) > 0) {
      const what = kind === "single" ? "sudah berisi data" : `sudah berisi ${existingCounts[countKey]} entri`
      skipped.push({ contentType: model.slug, reason: `${what}; tidak ditimpa` })
      return
    }
    nodes.push({ kind, slug: model.slug, fields: model.fields, key: `${kind}:${model.slug}` })
  }
  allCollections.forEach((m) => consider("collection", m))
  allSingles.forEach((m) => consider("single", m))

  // Only Content Types are link targets, so only they can be dependencies.
  const candidateCollections = new Set(nodes.filter((n) => n.kind === "collection").map((n) => n.slug))

  const verdicts = new Map<string, { fields: string[]; deps: Set<string>; blocked?: string }>()
  for (const node of nodes) {
    const fields: string[] = []
    const deps = new Set<string>()
    let blocked: string | undefined
    for (const field of node.fields) {
      const v = judgeField(field, schema, collectionSlugs, existingCounts)
      if (!v.fillable) {
        if (v.required) blocked = blocked ?? `field wajib "${field.slug}" ${v.reason}`
        else unfillable.push({ contentType: node.slug, field: field.slug, reason: v.reason! })
        continue
      }
      if (field.type === "slug" && !node.fields.some((f) => TITLE_LIKE.has(f.slug))) {
        unfillable.push({ contentType: node.slug, field: field.slug, reason: "slug dibuat dari field judul, tapi tidak ada field title/judul/name/nama" })
        continue
      }
      fields.push(field.slug)
      if (v.dependsOn) deps.add(v.dependsOn)
    }
    verdicts.set(node.key, { fields, deps, blocked })
  }

  // A dependency must be a planned Content Type or already populated.
  const available = (target: string) => candidateCollections.has(target) || (existingCounts[target] ?? 0) > 0
  let changed = true
  while (changed) {
    changed = false
    for (const node of nodes) {
      const v = verdicts.get(node.key)!
      if (v.blocked) continue
      for (const dep of v.deps) {
        const depNode = nodes.find((n) => n.kind === "collection" && n.slug === dep)
        const depVerdict = depNode ? verdicts.get(depNode.key) : undefined
        if (depVerdict?.blocked) {
          v.blocked = `relasi ke "${dep}" yang dilewati`
          changed = true
          break
        }
        if (!available(dep)) {
          v.blocked = `relasi ke "${dep}" tidak tersedia`
          changed = true
          break
        }
      }
    }
  }

  // Topological order over survivors. Anything left over sits in a cycle.
  const alive = nodes.filter((n) => !verdicts.get(n.key)!.blocked)
  const order: Node[] = []
  const placed = new Set<string>()
  let progress = true
  while (progress) {
    progress = false
    for (const node of alive) {
      if (placed.has(node.key)) continue
      const deps = [...verdicts.get(node.key)!.deps].filter((d) => candidateCollections.has(d))
      if (deps.every((d) => placed.has(`collection:${d}`))) {
        order.push(node)
        placed.add(node.key)
        progress = true
      }
    }
  }
  for (const node of alive) {
    if (!placed.has(node.key)) skipped.push({ contentType: node.slug, reason: "relasi melingkar antar Content Type" })
  }
  for (const node of nodes) {
    const v = verdicts.get(node.key)!
    if (v.blocked) skipped.push({ contentType: node.slug, reason: v.blocked })
  }

  const steps: PlanStep[] = order.map((node) => {
    const v = verdicts.get(node.key)!
    return {
      kind: node.kind,
      contentType: node.slug,
      count: node.kind === "single" ? 1 : perType,
      dependsOn: [...v.deps].filter((d) => candidateCollections.has(d)),
      fields: v.fields,
    }
  })

  const selected = wanted ? [...wanted] : [...allCollections, ...allSingles].map((m) => m.slug)
  return {
    perType,
    batchKey: batchKeyFor(schema, perType, selected),
    steps,
    skipped,
    unfillable,
  }
}
