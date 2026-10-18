/**
 * AI Site's model picker now offers the Gateway's full live catalog (every
 * provider/model Vercel AI Gateway exposes to this account), not a curated
 * shortlist — explicit user request: "gunakan seluruh model yang ada, user
 * bebas memilih model AI." `fetchGatewayLanguageModels()` (`@/lib/ai`,
 * served through `GET .../ai-site/models`) is the real source of truth;
 * this file only holds client-safe constants — no server-only import here,
 * since `chat-workspace.tsx` (a client component) needs `DEFAULT_AI_SITE_MODEL`.
 *
 * Trade-off accepted knowingly: a model picked from the live catalog might
 * still 403/429 at generation time if this Gateway account's tier doesn't
 * have access to it, or might perform worse than the curated default on
 * AI Site's 40-step tool-calling loop (not every model is equally reliable
 * at function calling). That's now the user's call, not something this
 * file pre-filters away.
 */
export interface AiSiteModelOption {
  value: string
  label: string
  provider: string
  /** Short caveat shown next to the option — e.g. a tier restriction confirmed live against this Gateway account. */
  note?: string
}

/** Shown before the live catalog has loaded, and as a fallback if fetching it fails. */
export const FALLBACK_AI_SITE_MODEL_OPTIONS: AiSiteModelOption[] = [
  { value: "openai/gpt-5-codex", label: "GPT-5-Codex", provider: "openai" },
  { value: "openai/gpt-4o", label: "GPT-4o", provider: "openai" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google" },
]

export const DEFAULT_AI_SITE_MODEL = FALLBACK_AI_SITE_MODEL_OPTIONS[0].value

/**
 * Pinned to the top of the picker, ahead of the live catalog — user's
 * explicit ask for models strong at both coding and schema design, across
 * Claude/Gemini/ChatGPT/GLM. Every entry here was checked live against this
 * Gateway account on 2026-10-18 with a cheap `generateText` smoke call
 * before being listed (see `references/architecture.md` in the `ai-gateway`
 * skill for the check snippet) — re-verify the same way before editing this
 * list, a recommended option that 403s the moment it's picked is worse than
 * not recommending it.
 *
 * The `anthropic/*` entries are **confirmed denied on this account's
 * current Gateway tier** ("Free tier users do not have access to this
 * model") — kept here anyway (with `note`) because the user explicitly
 * asked for Claude to be offered, and because the moment this account is
 * upgraded, they're already in the right place instead of needing this
 * list edited again. Don't remove them just because they currently fail;
 * do remove them if a future re-check shows the model id itself changed.
 */
export const RECOMMENDED_CODING_MODELS: AiSiteModelOption[] = [
  { value: "anthropic/claude-opus-5.5", label: "Claude Opus 5.5", provider: "anthropic", note: "perlu upgrade tier Gateway" },
  { value: "anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5", provider: "anthropic", note: "perlu upgrade tier Gateway" },
  { value: "openai/gpt-5-codex", label: "GPT-5-Codex", provider: "openai" },
  { value: "openai/gpt-5.1-codex-mini", label: "GPT 5.1 Codex Mini", provider: "openai" },
  { value: "openai/gpt-5", label: "GPT-5", provider: "openai" },
  { value: "openai/gpt-4o", label: "GPT-4o", provider: "openai" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google" },
  { value: "zai/glm-4.6", label: "GLM 4.6", provider: "zai" },
  { value: "zai/glm-4.5-air", label: "GLM 4.5 Air", provider: "zai" },
]

/**
 * Loose shape guard for a value stored on `AiSiteChat.model` — "provider/
 * model-id". Not a semantic allowlist: with the picker now open to the
 * Gateway's whole catalog, the dropdown itself is what keeps a normal user
 * on a real model id. This only blocks garbage/malformed input reaching
 * `resolveGatewayModel`; an invalid-but-well-formed id still fails there
 * with a clear Gateway error, which is an acceptable outcome for a value
 * nothing but a direct API call (not the dropdown) could have produced.
 */
const MODEL_ID_SHAPE = /^[a-z0-9_-]+\/[a-zA-Z0-9._:-]+$/

export function isAllowedAiSiteModel(model: unknown): model is string {
  return typeof model === "string" && MODEL_ID_SHAPE.test(model)
}
