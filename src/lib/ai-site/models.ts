/**
 * Curated shortlist from the Vercel AI Gateway catalog for AI Site's model
 * picker — same curation spirit as the AI Schema Generator's
 * `src/lib/ai/schema-models.ts` (one subscription covers all of these, this
 * is a reasonable spread of providers/price points, not the full
 * multi-hundred-model catalog), kept as its own list rather than sharing
 * schema-models.ts's because AI Site's 40-step tool-calling loop has a
 * different reliability bar than a single `generateObject` call.
 *
 * Shared between the client (ai-site-landing.tsx, for the dropdown) and the
 * server (the chats route, to reject any other model id) so the two can't
 * drift — the dropdown is the *only* way a user is meant to pick a model.
 */
export const AI_SITE_MODEL_OPTIONS = [
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini", hint: "Cepat, hemat, tool-calling andal — default" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", hint: "Cepat & hemat — default Vercel Gateway" },
  { value: "google/gemini-3-flash", label: "Gemini 3 Flash", hint: "Generasi terbaru Google" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini", hint: "Cepat & efisien OpenAI" },
  { value: "openai/gpt-4o", label: "GPT-4o", hint: "Flagship multimodal OpenAI" },
  { value: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", hint: "Arsitektur kompleks & presisi" },
  { value: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5", hint: "Responsif & hemat Claude" },
] as const

export type AiSiteModelValue = (typeof AI_SITE_MODEL_OPTIONS)[number]["value"]

const VALID_AI_SITE_MODEL_VALUES = new Set<string>(AI_SITE_MODEL_OPTIONS.map((m) => m.value))

/** Is `model` one of the curated options shown in the dropdown? */
export function isAllowedAiSiteModel(model: string | undefined | null): model is AiSiteModelValue {
  return !!model && VALID_AI_SITE_MODEL_VALUES.has(model)
}

export const DEFAULT_AI_SITE_MODEL: AiSiteModelValue = AI_SITE_MODEL_OPTIONS[0].value
