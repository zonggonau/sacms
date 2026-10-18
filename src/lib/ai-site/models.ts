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
}

/** Shown before the live catalog has loaded, and as a fallback if fetching it fails. */
export const FALLBACK_AI_SITE_MODEL_OPTIONS: AiSiteModelOption[] = [
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini", provider: "openai" },
  { value: "openai/gpt-4o", label: "GPT-4o", provider: "openai" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google" },
]

export const DEFAULT_AI_SITE_MODEL = FALLBACK_AI_SITE_MODEL_OPTIONS[0].value

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
