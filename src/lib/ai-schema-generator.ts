import { z } from "zod"
import { generateObject } from "ai"
import { VALID_FIELD_TYPES, type FieldTypeValue, FIELD_TYPES } from "./field-types"

// Re-export for backwards compatibility
export { VALID_FIELD_TYPES, type FieldTypeValue }

const fieldSchema = z.object({
  name: z.string(),
  slug: z.string(),
  type: z.enum(VALID_FIELD_TYPES),
  required: z.boolean().optional().default(false),
  unique: z.boolean().optional().default(false),
  relationSlug: z.string().optional().describe("If type is relation, the slug of the target ContentType"),
  componentSlug: z.string().optional().describe("If type is component, the slug of the target Component"),
})

const modelSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  fields: z.array(fieldSchema),
  // Kept for the static heuristic/blueprint fallback data below, which
  // hardcodes a few example records — free, since it isn't AI-generated.
  // The live LLM call never sees this field (see aiModelSchema): nothing
  // downstream (materializeSchemaIntoTenant, the review-step UI) reads
  // dummyData, so asking a real model to generate 2-3 "highly realistic"
  // records per collection was pure wasted output-token spend.
  dummyData: z.array(z.record(z.string(), z.any())).optional()
})

const systemSchema = z.object({
  contentTypes: z.array(modelSchema).describe("Collection types (e.g., Rooms, Products, Facilities, Articles)"),
  singleTypes: z.array(modelSchema).describe("Single types (e.g., HotelSettings, StoreConfig, SiteProfile)"),
  components: z.array(modelSchema).describe("Reusable components (e.g., SEO, Contact, Badge)"),
})

export type GeneratedSystemSchema = z.input<typeof systemSchema>

// Schema actually sent to generateObject for the live LLM call — same shape
// minus dummyData (see the comment on modelSchema above).
const aiModelSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  fields: z.array(fieldSchema),
})

const aiSystemSchema = z.object({
  contentTypes: z.array(aiModelSchema).describe("Collection types (e.g., Rooms, Products, Facilities, Articles)"),
  singleTypes: z.array(aiModelSchema).describe("Single types (e.g., HotelSettings, StoreConfig, SiteProfile)"),
  components: z.array(aiModelSchema).describe("Reusable components (e.g., SEO, Contact, Badge)"),
})

const FIELD_TYPE_DOCS = FIELD_TYPES.map(
  (f) => `- ${f.type} (${f.category} - ${f.label}): ${f.description}`
).join("\n")

const SYSTEM_PROMPT = `You are an expert Headless CMS database architect for SaCMS, designing the schema for a website's ENTIRE frontend — not just its main business data. A frontend built against your schema must never fall back to hardcoded placeholder text anywhere, from the header to the footer.

Work through the whole page structure methodically, header to footer, before generating anything:

1. **Global site settings (always exactly one Single Type, e.g. 'site-settings')** — whatever the generated frontend needs on every page: site name/logo/favicon ('media'), primary/secondary/accent brand color ('color' — this covers "tipe warna website"), typography choice ('select' listing a few font pairings), header nav links, footer columns/links, footer copyright text, social media links, contact info (email/phone/address — 'location' if a real address matters), and ONE 'seo' field for the site-wide default meta title/description/OG image that other pages fall back to. This Single Type is what the header and footer actually render from — never leave header/footer content hardcoded in the frontend with nothing behind it.

2. **Each distinct, one-off page (one Single Type per page)** — the homepage (slug exactly 'homepage', not 'home-page' or 'landing-page'), About, Contact, or any other page that exists exactly once. Each gets its own hero heading/subheading/image, its own body sections, and its own 'seo' field (meta tags specific to that page override the site default). Think about what's actually ON that page section by section — a homepage hero, an about page's story + team intro, a contact page's form intro + map — model each distinct section as real fields or embedded components, not one giant 'richText' blob standing in for the whole page.

3. **Repeatable business content (one Content Type per kind of thing that repeats)** — products, rooms, services, articles, team members, testimonials, FAQ entries, bookings, whatever the user's domain actually needs multiple of. This is the "2 to 4 rich Content Types" the user is really asking to manage day-to-day. Each public-facing one also gets its own 'seo' field. Wire real relations between them with 'relation' (e.g. an article 'relation'-s to its author in Team, a product 'relation'-s to its Category) instead of duplicating data.

4. **Reusable embedded groups (Components)** — anything whose *shape* repeats *inside* another type rather than needing its own list/URL: a CTA block (heading + button text + link), a feature/benefit card, a social-links group, a testimonial-quote block embedded directly in the Homepage Single Type instead of justifying its own Content Type. Use 'component' with 'componentSlug' for these. A Component is the right call when the content is always edited alongside its parent and never needs its own detail page; a Content Type is the right call when it needs its own list, its own URL, or there could be many unbounded over time.

Use diverse field types strictly from this supported SaCMS list:
${FIELD_TYPE_DOCS}

Field Selection Rules:
- Monetary amounts & prices MUST use 'currency' (e.g. price, fee, rate, budget).
- Discounts, taxes, & percentage values MUST use 'percent'.
- Star reviews (1-5) MUST use 'rating'.
- Single cover/avatar image MUST use 'media'; photo galleries MUST use 'mediaMultiple'; documents/PDFs MUST use 'file'.
- Multi-item badges/sizes/amenities MUST use 'tags' or 'multiselect'.
- Dropdown options MUST use 'select'.
- Comprehensive descriptions & body text MUST use 'richText' (HTML) or 'markdown'.
- Geolocation coordinates & address MUST use 'location'.
- Brand/theme colors MUST use 'color', never free-text ('tipe warna website' always gets a real color field, not a text description of a color).
- Search engine optimization MUST use 'seo' — every public-facing Single Type and Content Type gets one, not just the homepage.
- Related collections MUST use 'relation' with 'relationSlug' matching target ContentType.
- Embedded reusable groups MUST use 'component' with 'componentSlug' matching target Component.
- 'document_template' is ONLY for a Content Type that represents a fillable letter/official document (surat), and only add it when the user's prompt or attached reference material actually describes one. Never add it to ordinary business content (products, articles, bookings, etc.).

If the user's reference material includes a block labeled "Variabel Placeholder Dokumen" listing exact field keys (e.g. from an uploaded .docx letter template), you MUST: create one Content Type representing that document, give it fields whose slugs are EXACTLY those keys verbatim — including underscores, NOT converted to kebab-case, this is the one exception to the kebab-case rule below — using the suggested types, and add exactly one additional field of type 'document_template' to that same Content Type. This lets the uploaded document later be attached as that type's fill-in letter template with the field slugs already matching.

Do not skip step 1 or step 2 even if the user's prompt only describes the business content from step 3 — a real frontend always has a header, a footer, and at least a homepage, so the schema must cover them whether or not the user mentioned them explicitly.

All slugs must be kebab-case lowercase (letters, digits, hyphens only — never underscores), e.g. 'cover-image', 'is-available'.`

async function generateWithAi(prompt: string, tenantId?: string, userId?: string, overrideModel?: string, skipQuotaCheck?: boolean): Promise<GeneratedSystemSchema> {
  const { resolveGatewayModel, enforceAiQuota, recordAiUsage, refundAiQuota, toUsageTotals, withAiRetry } = await import("./ai")

  const config = { tenantId, userId, creditsCost: 5, action: "generate_schema" }
  // Callers that already reserved quota for this cost as part of a larger
  // combined check pass true here so this doesn't check — and potentially
  // pass — a balance that the outer call is also about to spend from
  // before either deduction lands. (No current caller actually does this
  // anymore, but the escape hatch is cheap to keep for whoever needs it.)
  if (!skipQuotaCheck) {
    await enforceAiQuota(config)
  }

  try {
    const { model, modelId } = await resolveGatewayModel(overrideModel)

    // Pass the real zod schema straight to generateObject instead of asking
    // for JSON in the prompt and hand-parsing it — the model's output is
    // validated against aiSystemSchema at generation time, provider-agnostic.
    const result = await withAiRetry(() =>
      generateObject({
        model,
        schema: aiSystemSchema,
        system: SYSTEM_PROMPT,
        prompt,
        // The prompt now asks for the whole site (global settings + every
        // one-off page + repeatable content + components), not just a
        // handful of content types — raised from 16000 to leave real
        // headroom for that larger, more complete structure.
        maxOutputTokens: 24000,
      })
    )

    await recordAiUsage(config, toUsageTotals(result.usage), modelId, JSON.stringify(result.object))

    return result.object
  } catch (err) {
    if (!skipQuotaCheck) await refundAiQuota(config)
    throw err
  }
}

/**
 * The save endpoint (POST .../ai-builder/import-schema) enforces the exact
 * same kebab-case-only slug rule a human hits creating a Content Type by
 * hand (see createContentTypeSchema in lib/validations/admin.ts): letters,
 * digits, hyphens — no underscores. The system prompt above tells the model
 * "snake_case or kebab-case", so a schema that previews fine can otherwise
 * routinely 400 on save. Normalizing every slug (model-level and
 * field-level, including relationSlug/componentSlug references, with the
 * same function so cross-references still match) right before it's
 * returned closes that gap without touching the platform-wide rule.
 */
function toKebabSlug(input: string): string {
  const slug = input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return slug || "field"
}

function normalizeSchemaSlugs(schema: GeneratedSystemSchema): GeneratedSystemSchema {
  type Model = GeneratedSystemSchema["contentTypes"][number]
  const normalizeModel = (model: Model): Model => ({
    ...model,
    slug: toKebabSlug(model.slug),
    fields: (model.fields || []).map((field) => ({
      ...field,
      slug: toKebabSlug(field.slug),
      ...(field.relationSlug ? { relationSlug: toKebabSlug(field.relationSlug) } : {}),
      ...(field.componentSlug ? { componentSlug: toKebabSlug(field.componentSlug) } : {}),
    })),
  })

  return {
    contentTypes: (schema.contentTypes || []).map(normalizeModel),
    singleTypes: (schema.singleTypes || []).map(normalizeModel),
    components: (schema.components || []).map(normalizeModel),
  }
}

/**
 * Safety net for the SYSTEM_PROMPT's step 1/2 (global site settings +
 * homepage) — the model doesn't always include these even though it's
 * instructed to. Adds a minimal 'site-settings' and/or 'homepage' Single
 * Type whenever one isn't already present under that slug — leaves an
 * already-correct AI-generated version completely untouched, only fills
 * an actual gap.
 */
// Confirmed live (3 test prompts against the real model): even though the
// prompt names 'homepage' as the suggested exact slug, the model sometimes
// names it 'home-page' or 'landing-page' instead — an exact-match hasSlug()
// check then missed it and injected a redundant second homepage-equivalent
// Single Type alongside the model's own. Broader alias matching avoids
// that false negative.
const HOMEPAGE_SLUG_ALIASES = ["homepage", "home-page", "home", "landing-page", "landing"]
const SITE_SETTINGS_SLUG_ALIASES = ["site-settings", "global-settings", "settings", "site-config"]

function ensureCoreSingleTypes(schema: GeneratedSystemSchema): GeneratedSystemSchema {
  const singleTypes = schema.singleTypes || []
  const hasAnySlug = (aliases: string[]) => singleTypes.some((st) => aliases.includes(st.slug))
  const additions: typeof singleTypes = []

  if (!hasAnySlug(SITE_SETTINGS_SLUG_ALIASES)) {
    additions.push({
      name: "Site Settings",
      slug: "site-settings",
      description: "Pengaturan global situs — logo, warna brand, navigasi, footer, kontak, dan SEO default yang dipakai di setiap halaman.",
      fields: [
        { name: "Logo", slug: "logo", type: "media" },
        { name: "Warna Utama", slug: "warna-utama", type: "color" },
        { name: "Warna Sekunder", slug: "warna-sekunder", type: "color" },
        { name: "Link Navigasi", slug: "link-navigasi", type: "tags" },
        { name: "Teks Footer", slug: "teks-footer", type: "text" },
        { name: "Link Sosial Media", slug: "link-sosial-media", type: "tags" },
        { name: "Email Kontak", slug: "email-kontak", type: "text" },
        { name: "Telepon Kontak", slug: "telepon-kontak", type: "text" },
        { name: "SEO Default", slug: "seo-default", type: "seo" },
      ],
    })
  }

  if (!hasAnySlug(HOMEPAGE_SLUG_ALIASES)) {
    additions.push({
      name: "Homepage",
      slug: "homepage",
      description: "Konten halaman utama — hero dan bagian-bagian utama halaman depan.",
      fields: [
        { name: "Judul Hero", slug: "judul-hero", type: "text" },
        { name: "Subjudul Hero", slug: "subjudul-hero", type: "richText" },
        { name: "Gambar Hero", slug: "gambar-hero", type: "media" },
        { name: "SEO", slug: "seo", type: "seo" },
      ],
    })
  }

  if (additions.length === 0) return schema
  return { ...schema, singleTypes: [...singleTypes, ...additions] }
}

/** Applied once at every return point in generateSystemSchema — the one pipeline every generation path (real AI, blueprint match, heuristic) goes through before the client ever sees it. */
function finalizeGeneratedSchema(schema: GeneratedSystemSchema): GeneratedSystemSchema {
  return normalizeSchemaSlugs(ensureCoreSingleTypes(schema))
}

export interface GenerateSystemSchemaResult {
  schema: GeneratedSystemSchema
}

/**
 * No fallback schema of any kind, by deliberate product decision — a canned
 * blueprint/heuristic result used to silently stand in for a failed real-AI
 * call, which looked AI-generated but wasn't and confused users who had no
 * way to tell the difference. Every failure now throws instead:
 * - `.status === 429` — the user/tenant is genuinely out of their own AI
 *   credits (enforceAiQuota, src/lib/ai.ts). Already a clear, actionable
 *   message; just re-thrown as-is.
 * - anything else (Gateway not configured, Gateway/provider outage, the
 *   platform's own upstream AI subscription/quota exhausted, network
 *   failure, model access denied, …) — none of these are the user's credits
 *   being depleted, so they must never be reported or treated as that case.
 *   Wrapped into a distinct `.status === 503` error with a clear message
 *   pointing at retrying later or building the schema manually.
 * generateWithAi already refunds any reserved credits on failure regardless
 * of which of these it is, so neither path costs the user anything.
 */
async function generateSystemSchemaCore(prompt: string, tenantId?: string, userId?: string, model?: string, skipQuotaCheck?: boolean): Promise<GenerateSystemSchemaResult> {
  try {
    console.log("[AI Schema] Analyzing user prompt with LLM to generate custom dynamic schema...")
    const schema = await generateWithAi(prompt, tenantId, userId, model, skipQuotaCheck)
    return { schema: finalizeGeneratedSchema(schema) }
  } catch (error: any) {
    if (error?.status === 429) throw error

    console.error("[AI Schema] AI generation failed:", error?.message)
    const wrapped: Error & { status?: number } = new Error(
      "AI Schema Generator sedang tidak bisa digunakan (bukan karena kredit AI Anda — kemungkinan Vercel AI Gateway/langganan platform bermasalah). Coba lagi beberapa saat lagi, atau buat schema secara manual lewat tombol \"atau buat manual\" di bawah."
    )
    wrapped.status = 503
    throw wrapped
  }
}

/**
 * placeholderKeys: the exact {placeholder} keys detected in an attached
 * .docx letter template (see document-analysis.ts / docx-template-parser.ts,
 * surfaced through schema-step.tsx's attachment flow). normalizeSchemaSlugs
 * (inside finalizeGeneratedSchema, used by every path in
 * generateSystemSchemaCore) unconditionally kebab-cases every field slug —
 * which would silently break the document_template merge for any of these
 * fields, since that merge matches by exact slug text, underscores
 * included. This restores the verbatim key wherever a field's
 * kebab-normalized slug matches one of these, so the schema stays correct
 * by construction even if the model's prompt-level instruction to preserve
 * them verbatim isn't followed exactly.
 */
export async function generateSystemSchema(
  prompt: string,
  tenantId?: string,
  userId?: string,
  model?: string,
  skipQuotaCheck?: boolean,
  placeholderKeys?: string[],
): Promise<GenerateSystemSchemaResult> {
  const result = await generateSystemSchemaCore(prompt, tenantId, userId, model, skipQuotaCheck)
  if (!placeholderKeys || placeholderKeys.length === 0) return result
  return { ...result, schema: restoreVerbatimPlaceholderSlugs(result.schema, placeholderKeys) }
}

function restoreVerbatimPlaceholderSlugs(schema: GeneratedSystemSchema, placeholderKeys: string[]): GeneratedSystemSchema {
  const byKebab = new Map(placeholderKeys.map((k) => [toKebabSlug(k), k]))
  type Model = GeneratedSystemSchema["contentTypes"][number]
  const fix = (model: Model): Model => ({
    ...model,
    fields: (model.fields || []).map((field) => {
      const verbatim = byKebab.get(field.slug)
      return verbatim ? { ...field, slug: verbatim } : field
    }),
  })
  return {
    contentTypes: (schema.contentTypes || []).map(fix),
    singleTypes: (schema.singleTypes || []).map(fix),
    components: (schema.components || []).map(fix),
  }
}
