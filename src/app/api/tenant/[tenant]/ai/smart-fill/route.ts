import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { withStaffAuth, readJson, apiError } from "@/lib/api/route-helpers"
import { getFieldAiMode, SMART_FILL_CREDIT_COST, smartFillFields } from "@/lib/content/field-ai"
import { aiFormContextSchema, aiFormTargetSchema, filterAiContext, isAiQuotaError, loadAiFormSchema, normalizeGeneratedField } from "@/lib/content/ai-form-schema"

const smartFillSchema = z.object({
  form: aiFormTargetSchema,
  fieldSlugs: z.array(z.string().min(1).max(128)).min(1).max(64),
  prompt: z.string().trim().max(4000).default(""),
  context: aiFormContextSchema.default({}),
})

const factsRule = "Use only facts explicitly supplied in the brief or the existing content. Never invent prices, dates, places, provenance, names or certification. Omit a field if there is insufficient information."

export const POST = withStaffAuth(async (request, _context, { access, session }) => {
  const parsed = await readJson(request, smartFillSchema)
  if (!parsed.ok) return parsed.response
  const { form, fieldSlugs, prompt } = parsed.data
  const definition = await loadAiFormSchema(form, access)
  if (!definition) return apiError("not_found", { message: "Formulir tidak tersedia untuk Smart Fill." })

  const requested = new Set(fieldSlugs)
  const fields = smartFillFields(definition.fields, form).filter((field) => requested.has(field.slug))
  if (fields.length === 0) return apiError("validation", { message: "Tidak ada field penulisan yang dapat diisi." })

  const context = filterAiContext(
    definition.fields.filter((field) => getFieldAiMode(field, form) !== "off"),
    parsed.data.context,
  )
  if (!prompt && Object.keys(context).length === 0) {
    return apiError("validation", { message: "Tambahkan informasi sumber sebelum menjalankan Smart Fill." })
  }

  try {
    const { safeGenerateContent } = await import("@/lib/ai")
    const fieldsGuide = fields.map((field) => ({
      slug: field.slug,
      label: field.name,
      format: field.type === "seo"
        ? "object with meta_title (max 60 chars) and meta_description (max 160 chars)"
        : field.type === "richText" ? "simple HTML with paragraphs, headings and lists" : field.type === "text" ? "short single line" : field.type,
    }))
    const result = await safeGenerateContent(
      "You assist a human CMS editor. Return a JSON object with only the requested field slugs as keys. " + factsRule +
        " Keep existing editorial tone. Write in the language of the brief and the existing content. Do not include external links or embedded media.",
      JSON.stringify({ model: definition.name, fields: fieldsGuide, source: context, brief: prompt }),
      {
        tenantId: access.tenantId,
        userId: session.user.id,
        creditsCost: SMART_FILL_CREDIT_COST,
        refundOnFailure: true,
        action: "smart_fill",
        responseFormat: "json_object",
        maxTokens: 2500,
      },
    )

    const generated = JSON.parse(result.text) as Record<string, unknown> | null
    const content = Object.fromEntries(fields.flatMap((field) => {
      const value = normalizeGeneratedField(field, generated?.[field.slug])
      return value === null ? [] : [[field.slug, value]]
    }))
    if (Object.keys(content).length === 0) {
      return apiError("validation", { message: "AI tidak menghasilkan saran yang sesuai. Tambahkan konteks yang lebih spesifik." })
    }

    return NextResponse.json({ success: true, content })
  } catch (error) {
    if (isAiQuotaError(error)) {
      return apiError("rate_limited", { message: "Kredit atau kuota AI tidak mencukupi." })
    }
    console.error("[Smart Fill] Generation failed", error instanceof Error ? error.name : "Unknown")
    return apiError("internal", { status: 503, message: "Smart Fill sedang tidak tersedia. Isi formulir tetap seperti sebelumnya." })
  }
}, { minRole: "editor" })
