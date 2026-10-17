/**
 * Curated shortlist from the Vercel AI Gateway catalog for the AI Schema
 * Generator's model picker — deliberately narrow (2 options, user's explicit
 * ask) and specific to *structured architecture reasoning*: this is a
 * one-shot `generateObject` call that has to produce a coherent, correctly-
 * related multi-collection database design, not a chat/coding task, so the
 * bar is JSON-schema adherence and relational reasoning, not speed.
 *
 * Every option here was confirmed live against this Gateway account's
 * actual tier with a cheap `generateText` smoke call before being listed —
 * both `anthropic/claude-*` models and `google/gemini-3-flash` looked like
 * reasonable picks on paper (Claude Sonnet especially, for "complex
 * architecture") but are denied on this tier ("Free tier users do not have
 * access to this model"). Don't re-add a model here without re-checking
 * access the same way first (see `references/architecture.md` in the
 * `ai-gateway` skill for the check snippet).
 *
 * Shared between the client (schema-step.tsx, for the dropdown) and the
 * server (plan-schema/route.ts, to reject any other model id) so the two
 * can't drift — the dropdown is the *only* way a tenant is meant to pick a
 * model, so the server must enforce the same list it renders.
 */
export const SCHEMA_MODEL_OPTIONS = [
  { value: "openai/gpt-4o", label: "GPT-4o", hint: "Flagship — paling presisi untuk relasi data kompleks" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", hint: "Cepat & hemat untuk iterasi singkat" },
] as const

export type SchemaModelValue = (typeof SCHEMA_MODEL_OPTIONS)[number]["value"]

const VALID_SCHEMA_MODEL_VALUES = new Set<string>(SCHEMA_MODEL_OPTIONS.map((m) => m.value))

/** Is `model` one of the curated options shown in the dropdown? */
export function isAllowedSchemaModel(model: string | undefined | null): model is SchemaModelValue {
  return !!model && VALID_SCHEMA_MODEL_VALUES.has(model)
}

export const DEFAULT_SCHEMA_MODEL: SchemaModelValue = SCHEMA_MODEL_OPTIONS[0].value
