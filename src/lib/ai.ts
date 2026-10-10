import { createGateway } from "@ai-sdk/gateway"
import { generateText, generateObject, type LanguageModel } from "ai"
import { db } from "./database"
import { getTenantPlanConfig } from "./tenant-plan"

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export interface AIConfig {
  maxTokens?: number
  temperature?: number
  responseFormat?: "text" | "json_object"
  tenantId?: string
  userId?: string
  creditsCost?: number
  action?: string
  overrideModel?: string
}

interface UsageTotals {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/**
 * Resolve the single configured AI backend: Vercel AI Gateway. One Gateway
 * API key (Admin Settings → Mesin AI) covers every provider/model, so unlike
 * the old per-provider-key resolver there is no priority order to pick
 * between — just one credential and a model id in "provider/model" form.
 */
export async function resolveGatewayModel(overrideModel?: string): Promise<{ model: LanguageModel; modelId: string }> {
  const { getResolvedAiConfig } = await import("./settings")
  const config = await getResolvedAiConfig()

  if (!config.aiGatewayApiKey) {
    throw new Error("Vercel AI Gateway belum dikonfigurasi. Masukkan API Key di Admin > Pengaturan > Mesin AI.")
  }

  let rawBaseUrl = config.aiGatewayBaseUrl?.trim().replace(/\/$/, "")
  let baseURL: string | undefined = undefined
  if (rawBaseUrl) {
    if (rawBaseUrl.includes("ai-gateway.vercel.sh")) {
      // Vercel AI Gateway native SDK protocol requires /v4/ai
      baseURL = "https://ai-gateway.vercel.sh/v4/ai"
    } else {
      baseURL = rawBaseUrl
    }
  }

  const gateway = createGateway({
    apiKey: config.aiGatewayApiKey,
    ...(baseURL ? { baseURL } : {}),
  })
  const modelId = overrideModel || config.defaultModel
  return { model: gateway(modelId), modelId }
}

/**
 * Maps the AI SDK's usage shape ({inputTokens, outputTokens, totalTokens})
 * to the {promptTokens, completionTokens, totalTokens} shape the credit
 * ledger and every existing caller already expect.
 */
export function toUsageTotals(usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number }): UsageTotals {
  const promptTokens = usage.inputTokens ?? 0
  const completionTokens = usage.outputTokens ?? 0
  return {
    promptTokens,
    completionTokens,
    totalTokens: usage.totalTokens ?? (promptTokens + completionTokens),
  }
}

/**
 * Retry a Gateway call on rate-limit/connection errors with exponential
 * backoff (2s, 4s, 8s, ...). Any other error (bad request, auth, etc.)
 * fails immediately instead of burning retries on something that'll never
 * succeed.
 */
export async function withAiRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: any = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      const status = error.statusCode || error.status || (error.message?.includes("429") ? 429 : error.message?.includes("503") ? 503 : 0)
      const isConnectionError = error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.message?.includes("fetch failed") || error.message?.includes("Connection error")
      const retryable = status === 429 || status === 503 || status === 500 || isConnectionError
      console.warn(`[AI] Attempt ${attempt + 1}/${maxAttempts} failed (status ${status || "n/a"}):`, error.message)
      if (!retryable || attempt === maxAttempts - 1) break
      const waitTime = Math.pow(2, attempt + 1) * 1000
      console.log(`[AI] Retrying in ${waitTime}ms...`)
      await sleep(waitTime)
    }
  }

  // The Gateway key in Admin Settings can be non-empty but still invalid/
  // expired/revoked — resolveGatewayModel() only catches the "completely
  // unset" case, so this surfaces as the SDK's generic English message on
  // the actual request. Translate it into something actionable instead of
  // showing "Unauthenticated request to AI Gateway..." straight to the user.
  if (lastError?.message?.includes("Unauthenticated") || lastError?.message?.includes("AI_GATEWAY_API_KEY")) {
    throw new Error("Vercel AI Gateway menolak API Key yang terpasang (tidak valid/sudah expired). Cek kembali di Admin > Pengaturan > Mesin AI, lalu klik \"Uji Koneksi Vercel AI Gateway\" untuk memastikan key-nya benar.")
  }

  throw lastError || new Error("AI Gateway request failed")
}

/**
 * Checks user-level AI credits and tenant-level AI token quota before
 * spending money on a call. Throws (status 429) if over quota.
 *
 * For the userId path this actually RESERVES (atomically deducts) the
 * credits right here, not just previews the balance — enforceUserAiCredits
 * alone would re-introduce the TOCTOU race this closes: two concurrent
 * calls both reading "enough remaining" before either's deduction lands.
 * recordAiUsage below no longer deducts for this path (it already
 * happened); if the call this reserved for then fails, the caller must
 * call refundAiQuota so a failed generation stays free, same as before.
 */
export async function enforceAiQuota(config: AIConfig): Promise<void> {
  if (config.userId) {
    const { reserveUserAiCredits } = await import("./plan-enforcement")
    const reservation = await reserveUserAiCredits(config.userId, config.creditsCost || 1)
    if (!reservation.allowed) {
      const error: any = new Error(reservation.message)
      error.status = 429
      throw error
    }
  }

  if (config.tenantId) {
    const tenant = await db.tenant.findUnique({
      where: { id: config.tenantId },
      select: { aiTokensUsed: true, aiCreditsExtra: true } as any
    })

    if (tenant) {
      const planConfig = await getTenantPlanConfig(config.tenantId)
      let maxAiTokens = planConfig.max_ai_tokens || 0

      const override = await db.customPlanOverride.findUnique({ where: { tenantId: config.tenantId } })
      if (override && override.maxAiTokens !== null) {
        maxAiTokens = override.maxAiTokens
      }

      // Add one-time top-up extra tokens
      const extraTokens = Number((tenant as any).aiCreditsExtra || 0)
      maxAiTokens += extraTokens

      const usedTokens = Number((tenant as any).aiTokensUsed || 0)
      if (maxAiTokens > 0 && usedTokens >= maxAiTokens) {
        const error: any = new Error(`AI Quota Exceeded. Used: ${usedTokens}, Limit: ${maxAiTokens}`)
        error.status = 429
        throw error
      }
    }
  }
}

/**
 * Records the usage ledger entry after a successful call. For the userId
 * path, credits were already reserved/deducted atomically by
 * enforceAiQuota above — this only writes the ledger row, it does not
 * deduct again. Fire-and-forget — never blocks the response.
 */
export async function recordAiUsage(config: AIConfig, usage: UsageTotals, modelId: string, text: string): Promise<void> {
  if (config.userId) {
    db.aiQuotaLedger.create({
      data: {
        userId: config.userId,
        tenantId: config.tenantId || null,
        action: config.action || "generate",
        credits: config.creditsCost || 1,
        tokens: (config.creditsCost || 1) * 1000,
        model: modelId,
      },
    }).catch(err => console.error("[AI Quota Ledger Error]", err))
  } else if (config.tenantId && usage.totalTokens > 0) {
    db.$transaction([
      db.tenant.update({
        where: { id: config.tenantId },
        data: { aiTokensUsed: { increment: usage.totalTokens } }
      }),
      db.aiQuotaLedger.create({
        data: {
          tenantId: config.tenantId,
          action: config.action || "generate",
          tokens: usage.totalTokens,
          words: text.split(/\s+/).length,
          model: modelId
        }
      })
    ]).catch(err => console.error("[AI Quota Ledger Error]", err))
  }
}

/**
 * Undoes the reservation enforceAiQuota made for config.userId, for when
 * the call it was reserved for then failed — keeps a failed generation
 * free, matching the behavior before enforce/record were split from a
 * plain check into an atomic reserve. No-op for the tenantId-only path
 * (that quota is tracked from real usage after the fact, never reserved).
 */
export async function refundAiQuota(config: AIConfig): Promise<void> {
  if (!config.userId) return
  const { refundUserAiCredits } = await import("./plan-enforcement")
  await refundUserAiCredits(config.userId, config.creditsCost || 1)
}

/**
 * Executes a generative AI request through the Vercel AI Gateway, with
 * automatic retry on transient errors and tenant/user quota enforcement.
 */
export async function safeGenerateContent(
  systemPrompt: string,
  userPrompt: string,
  config: AIConfig | number = {}
): Promise<{ text: string; model: string; usage: any }> {
  const finalConfig: AIConfig = typeof config === 'number' ? { maxTokens: config } : config

  await enforceAiQuota(finalConfig)

  const { model, modelId } = await resolveGatewayModel(finalConfig.overrideModel)

  const { text, usage } = await withAiRetry(async () => {
    if (finalConfig.responseFormat === "json_object") {
      // generateObject's "no-schema" output mode gives us provider-agnostic
      // structured JSON (tool-calling or native JSON mode, whichever the
      // model supports) instead of relying on OpenAI-only response_format
      // and hand-stripping ```json fences from a text reply.
      const result = await generateObject({
        model,
        output: "no-schema",
        system: systemPrompt
          ? `${systemPrompt}\n\nRespond with ONLY raw JSON — no markdown code fences, no commentary before or after.`
          : "Respond with ONLY raw JSON — no markdown code fences, no commentary before or after.",
        prompt: userPrompt,
        maxOutputTokens: finalConfig.maxTokens || 4000,
        temperature: finalConfig.temperature ?? 0.7,
      })
      return { text: JSON.stringify(result.object), usage: toUsageTotals(result.usage) }
    }

    const result = await generateText({
      model,
      system: systemPrompt || undefined,
      prompt: userPrompt,
      maxOutputTokens: finalConfig.maxTokens || 4000,
      temperature: finalConfig.temperature ?? 0.7,
    })
    return { text: result.text, usage: toUsageTotals(result.usage) }
  })

  await recordAiUsage(finalConfig, usage, modelId, text)

  return { text, model: modelId, usage }
}

export interface GenerateContentParams {
  prompt: string
  contentType?: string
  fieldName?: string
  locale?: string
  maxTokens?: number
  tone?: "formal" | "casual" | "professional" | "creative" | "technical"
  mode?: "generate" | "correct"
  tenantId?: string
}

export interface GenerateContentResult {
  content: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Generate content via the configured Gateway model.
 */
export async function generateContent(
  params: GenerateContentParams
): Promise<GenerateContentResult> {
  const { prompt, contentType, fieldName, locale = "en", tone = "professional", maxTokens, mode = "generate", tenantId } = params
  const systemPrompt = buildSystemPrompt({ contentType, fieldName, locale, tone, mode })

  const result = await safeGenerateContent(systemPrompt, prompt, { maxTokens, tenantId, action: "generate" })

  return {
    content: result.text,
    usage: result.usage
  }
}

export interface SummarizeParams {
  text: string
  maxLength?: number
  locale?: string
  tenantId?: string
}

/**
 * Summarize existing content
 */
export async function summarizeContent(
  params: SummarizeParams
): Promise<GenerateContentResult> {
  const { text, maxLength = 200, locale = "en", tenantId } = params
  const prompt = `You are a content summarizer. Summarize the given text concisely in ${maxLength} characters or less. Output in locale: ${locale}. Return only the summary, no extra commentary.`

  const result = await safeGenerateContent("", `${prompt}\n\nText to summarize:\n${text}`, { maxTokens: Math.max(maxLength, 500), tenantId, action: "summarize" })

  return {
    content: result.text,
    usage: result.usage
  }
}

export interface TranslateParams {
  text: string
  targetLocale: string
  sourceLocale?: string
  tenantId?: string
}

/**
 * Translate content to a target locale
 */
export async function translateContent(
  params: TranslateParams
): Promise<GenerateContentResult> {
  const { text, targetLocale, sourceLocale = "auto", tenantId } = params
  const prompt = `You are a professional translator. Translate the given text${sourceLocale !== "auto" ? ` from ${sourceLocale}` : ""} to ${targetLocale}. Preserve formatting (Markdown, HTML). Return only the translation, no extra commentary.`

  const result = await safeGenerateContent("", `${prompt}\n\nText to translate:\n${text}`, { tenantId, action: "translate" })

  return {
    content: result.text,
    usage: result.usage
  }
}

function buildSystemPrompt(opts: {
  contentType?: string
  fieldName?: string
  locale?: string
  tone?: string
  mode?: "generate" | "correct"
}): string {
  if (opts.mode === "correct") {
    const toneText = opts.tone ? ` in a ${opts.tone} tone` : ""
    return `You are a professional editor. Correct and polish the user's content${toneText}. Fix any grammar issues, spelling mistakes, typos, or punctuation errors. Rewrite it to be more clear, engaging, and professional while keeping its original meaning. If the text contains HTML tags or Markdown formatting, preserve that structure exactly. Return only the corrected/polished text with no extra commentary, explanations, or quotes.`
  }

  const parts = [
    "You are an AI content writing assistant for a headless CMS.",
    `Write in a ${opts.tone || "professional"} tone.`,
  ]

  if (opts.contentType) {
    parts.push(`The content type is "${opts.contentType}".`)
  }
  if (opts.fieldName) {
    parts.push(`You are generating content for the "${opts.fieldName}" field.`)
  }
  if (opts.locale && opts.locale !== "en") {
    parts.push(`Write in locale: ${opts.locale}.`)
  }

  parts.push("Return only the generated content. No extra commentary or labels. Do not include markdown blocks like ```json unless explicitly asked.")

  return parts.join(" ")
}
