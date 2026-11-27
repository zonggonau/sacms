import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { withStaffAuth, readJson, apiError } from "@/lib/api/route-helpers"
import { fieldAiActions, getFieldAiMode, isAiFieldEmpty } from "@/lib/content/field-ai"
import { isStudioFieldEnabled } from "@/lib/field-visibility"
import { aiFormContextSchema, aiFormTargetSchema, filterAiContext, isAiQuotaError, loadAiFormSchema, normalizeGeneratedField } from "@/lib/content/ai-form-schema"

const assistSchema = z.object({
  action: z.enum(["generate", "improve", "summarize", "seo"]),
  form: aiFormTargetSchema.optional(),
  fieldSlug: z.string().max(128).optional(),
  prompt: z.string().trim().max(4000).optional(),
  content: z.string().max(24000).optional(),
  context: aiFormContextSchema.default({}),
  tone: z.string().max(100).optional(),
})

const instructions = {
  generate: "Write a draft based on the supplied source and brief.",
  improve: "Improve clarity and grammar. Preserve names, facts and meaning.",
  summarize: "Summarize the provided text while preserving its key facts.",
  seo: "Suggest concise and accurate search metadata using the supplied source.",
}

export const POST = withStaffAuth(async (request, _context, { access }) => {
  const parsed = await readJson(request, assistSchema)
  if (!parsed.ok) return parsed.response
  const { action, form, fieldSlug, tone, prompt, content } = parsed.data
  const definition = form ? await loadAiFormSchema(form, access) : null
  if (form && !definition) return apiError("not_found", { message: "Formulir tidak tersedia untuk AI Assist." })

  const field = definition?.fields.find((item) => item.slug === fieldSlug && isStudioFieldEnabled(item))
  if (form && (!field || !fieldAiActions(field, form).includes(action))) {
    return apiError("validation", { message: "Aksi AI ini tidak tersedia untuk field tersebut." })
  }

  const context = form && definition ? filterAiContext(
    definition.fields.filter((item) => getFieldAiMode(item, form) !== "off"),
    parsed.data.context,
  ) : {}
  const polishOnly = !!(field && form && getFieldAiMode(field, form) === "polish")
  const hasContent = !isAiFieldEmpty(content)
  if (
    (action === "generate" && !prompt && Object.keys(context).length === 0) ||
    (action !== "generate" && action !== "seo" && !hasContent) ||
    (action === "seo" && !hasContent && (polishOnly || (!prompt && Object.keys(context).length === 0)))
  ) {
    return apiError("validation", { message: "Isi teks atau informasi sumber terlebih dahulu." })
  }

  const titleAlternatives = field?.type === "text" && action === "generate"
  const seo = action === "seo"
  const rule = polishOnly
    ? "Only refine existing wording in its original language. Do not add information."
    : "Use only supplied facts. Do not invent prices, dates, places, names, certification, or other claims."
  const languageRule = "Write in the language of the brief and the existing content unless polishing existing wording."
  const format = seo
    ? field
      ? 'Return JSON with "meta_title" (max 60 chars) and "meta_description" (max 160 chars).'
      : 'Return JSON with "metaTitle" (max 60 chars) and "metaDescription" (max 160 chars).'
    : titleAlternatives
      ? 'Return JSON with "suggestions", an array of three short, distinct single-line alternatives.'
      : field?.type === "richText"
        ? "Return simple HTML. Preserve paragraph, heading, and list structure. Do not add images or links."
        : "Return only the resulting text without commentary."

  try {
    const { safeGenerateContent } = await import("@/lib/ai")
    const result = await safeGenerateContent(
      [instructions[action], rule, languageRule, format].join(" "),
      JSON.stringify({ field: field?.name, tone, prompt: polishOnly ? undefined : prompt, content, context: polishOnly ? undefined : context }),
      {
        tenantId: access.tenantId,
        action: "content_assist_" + action,
        responseFormat: seo || titleAlternatives ? "json_object" : "text",
        maxTokens: seo || titleAlternatives ? 500 : 2500,
      },
    )

    if (!field) return NextResponse.json({ success: true, result: result.text.trim() })
    const modelOutput = seo || titleAlternatives ? JSON.parse(result.text) : result.text
    const choices: unknown[] = titleAlternatives && Array.isArray(modelOutput?.suggestions)
      ? modelOutput.suggestions.slice(0, 3)
      : [modelOutput]
    const suggestions = choices.flatMap((choice) => {
      const value = normalizeGeneratedField(field, choice)
      return value === null ? [] : [value]
    })
    if (suggestions.length === 0) {
      return apiError("validation", { message: "AI tidak menghasilkan saran yang sesuai. Coba tambahkan informasi sumber." })
    }

    return NextResponse.json({ success: true, suggestions })
  } catch (error) {
    if (isAiQuotaError(error)) return apiError("rate_limited", { message: "Kuota AI workspace tidak mencukupi." })
    console.error("[AI Assist] Generation failed", error instanceof Error ? error.name : "Unknown")
    return apiError("internal", { status: 503, message: "AI Assist sedang tidak tersedia. Isi field tetap seperti sebelumnya." })
  }
}, { minRole: "editor" })
