/**
 * Curated shortlist from the Vercel AI Gateway catalog for AI Site's model
 * picker — deliberately narrow (3 options, user's explicit ask) and specific
 * to *coding*: fast, reliable tool-calling, good at producing modern,
 * polished frontend code, not a broad "every provider" spread. Kept as its
 * own list rather than sharing `src/lib/ai/schema-models.ts`'s because AI
 * Site's 40-step tool-calling loop has a different reliability bar than a
 * single `generateObject` call.
 *
 * Every option here was confirmed live against this Gateway account's
 * actual tier with a cheap `generateText` smoke call before being listed —
 * `google/gemini-3-flash` and both `anthropic/claude-*` models looked like
 * reasonable coding picks on paper but are denied on this tier ("Free tier
 * users do not have access to this model"). Don't re-add a model here
 * without re-checking access the same way first (see `references/
 * architecture.md` in the `ai-gateway` skill for the check snippet) — a
 * dropdown option that 429s/403s the moment it's picked is worse than not
 * offering it.
 *
 * Shared between the client (ai-site-landing.tsx + chat-conversation.tsx,
 * for the dropdown) and the server (the chats route, to reject any other
 * model id) so the two can't drift — the dropdown is the *only* way a user
 * is meant to pick a model.
 */
export const AI_SITE_MODEL_OPTIONS = [
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini", hint: "Cepat, hemat, tool-calling andal — default" },
  { value: "openai/gpt-4o", label: "GPT-4o", hint: "Flagship — kualitas kode & UI terbaik" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", hint: "Tercepat & termurah" },
] as const

export type AiSiteModelValue = (typeof AI_SITE_MODEL_OPTIONS)[number]["value"]

const VALID_AI_SITE_MODEL_VALUES = new Set<string>(AI_SITE_MODEL_OPTIONS.map((m) => m.value))

/** Is `model` one of the curated options shown in the dropdown? */
export function isAllowedAiSiteModel(model: string | undefined | null): model is AiSiteModelValue {
  return !!model && VALID_AI_SITE_MODEL_VALUES.has(model)
}

export const DEFAULT_AI_SITE_MODEL: AiSiteModelValue = AI_SITE_MODEL_OPTIONS[0].value
