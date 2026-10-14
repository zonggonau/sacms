/**
 * Curated shortlist from the Vercel AI Gateway catalog for the AI Schema
 * Generator's model picker — one subscription covers all of these, this is
 * just a reasonable spread of providers/price points rather than dumping the
 * full multi-hundred-model catalog on the user.
 *
 * Shared between the client (schema-step.tsx, for the dropdown) and the
 * server (plan-schema/route.ts, to reject any other model id) so the two
 * can't drift — the dropdown is the *only* way a tenant is meant to pick a
 * model, so the server must enforce the same list it renders.
 */
export const SCHEMA_MODEL_OPTIONS = [
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", hint: "Cepat & hemat — default Vercel Gateway" },
  { value: "google/gemini-3-flash", label: "Gemini 3 Flash", hint: "Generasi terbaru Google" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini", hint: "Cepat & efisien OpenAI" },
  { value: "openai/gpt-4o", label: "GPT-4o", hint: "Flagship multimodal OpenAI" },
  { value: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", hint: "Arsitektur kompleks & presisi" },
  { value: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5", hint: "Responsif & hemat Claude" },
] as const

export type SchemaModelValue = (typeof SCHEMA_MODEL_OPTIONS)[number]["value"]

const VALID_SCHEMA_MODEL_VALUES = new Set<string>(SCHEMA_MODEL_OPTIONS.map((m) => m.value))

/** Is `model` one of the curated options shown in the dropdown? */
export function isAllowedSchemaModel(model: string | undefined | null): model is SchemaModelValue {
  return !!model && VALID_SCHEMA_MODEL_VALUES.has(model)
}

export const DEFAULT_SCHEMA_MODEL: SchemaModelValue = SCHEMA_MODEL_OPTIONS[0].value
