import OpenAI from "openai"

// Menggunakan DeepSeek Chat model (DeepSeek-V3) sebagai default
const MODELS_TO_TRY = [
  "deepseek-chat", // Main DeepSeek V3 model
  "deepseek-reasoner" // Fallback to reasoning model if needed
]

// Lazy client
let _openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY is not configured")
    }
    // DeepSeek API is OpenAI compatible
    _openai = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: apiKey
    })
  }
  return _openai
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export interface AIConfig {
  maxTokens?: number
  temperature?: number
  responseFormat?: "text" | "json_object"
}

/**
 * Executes a generative AI request with automatic model fallback and basic retry logic.
 */
export async function safeGenerateContent(
  systemPrompt: string,
  userPrompt: string,
  config: AIConfig | number = {}
): Promise<{ text: string; model: string; usage: any }> {
  const finalConfig: AIConfig = typeof config === 'number' ? { maxTokens: config } : config
  let lastError: any = null
  
  for (const modelName of MODELS_TO_TRY) {
    let attempts = 0
    const maxAttempts = 3
    
    while (attempts < maxAttempts) {
      try {
        console.log(`[AI] Attempting with model: ${modelName} (Attempt ${attempts + 1}/${maxAttempts})`)
        
        const openai = getOpenAI()
        
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
        if (systemPrompt) {
          messages.push({ role: "system", content: systemPrompt })
        }
        messages.push({ role: "user", content: userPrompt })

        const completion = await openai.chat.completions.create({
          model: modelName,
          messages,
          max_tokens: finalConfig.maxTokens || 4000,
          temperature: finalConfig.temperature ?? 0.7,
          response_format: finalConfig.responseFormat ? { type: finalConfig.responseFormat } : undefined,
        })
        
        const text = completion.choices[0]?.message?.content
        
        if (text) {
          return { 
            text, 
            model: modelName,
            usage: {
              promptTokens: completion.usage?.prompt_tokens ?? 0,
              completionTokens: completion.usage?.completion_tokens ?? 0,
              totalTokens: completion.usage?.total_tokens ?? 0,
            }
          }
        }
      } catch (error: any) {
        lastError = error
        attempts++
        
        const status = error.status || (error.message?.includes("429") ? 429 : error.message?.includes("503") ? 503 : 500)
        console.warn(`[AI] Model ${modelName} failed (Status: ${status}):`, error.message)
        
        if (status === 429 || status === 503) {
          // Exponential backoff: 2s, 4s, 8s...
          const waitTime = Math.pow(2, attempts) * 1000
          console.log(`[AI] Rate limited or server error. Retrying in ${waitTime}ms...`)
          await sleep(waitTime)
          continue // Try again with same model
        }
        
        // For other errors (like 400/404), break and try next model
        break
      }
    }
  }

  throw lastError || new Error("All AI models failed to respond")
}

export interface GenerateContentParams {
  prompt: string
  contentType?: string
  fieldName?: string
  locale?: string
  maxTokens?: number
  tone?: "formal" | "casual" | "professional" | "creative" | "technical"
  mode?: "generate" | "correct"
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
 * Generate content using DeepSeek with fallback
 */
export async function generateContent(
  params: GenerateContentParams
): Promise<GenerateContentResult> {
  const { prompt, contentType, fieldName, locale = "en", tone = "professional", maxTokens, mode = "generate" } = params
  const systemPrompt = buildSystemPrompt({ contentType, fieldName, locale, tone, mode })
  
  const result = await safeGenerateContent(systemPrompt, prompt, maxTokens)
  
  return {
    content: result.text,
    usage: result.usage
  }
}

export interface SummarizeParams {
  text: string
  maxLength?: number
  locale?: string
}

/**
 * Summarize existing content
 */
export async function summarizeContent(
  params: SummarizeParams
): Promise<GenerateContentResult> {
  const { text, maxLength = 200, locale = "en" } = params
  const prompt = `You are a content summarizer. Summarize the given text concisely in ${maxLength} characters or less. Output in locale: ${locale}. Return only the summary, no extra commentary.`
  
  const result = await safeGenerateContent("", `${prompt}\n\nText to summarize:\n${text}`, Math.max(maxLength, 500))
  
  return {
    content: result.text,
    usage: result.usage
  }
}

export interface TranslateParams {
  text: string
  targetLocale: string
  sourceLocale?: string
}

/**
 * Translate content to a target locale
 */
export async function translateContent(
  params: TranslateParams
): Promise<GenerateContentResult> {
  const { text, targetLocale, sourceLocale = "auto" } = params
  const prompt = `You are a professional translator. Translate the given text${sourceLocale !== "auto" ? ` from ${sourceLocale}` : ""} to ${targetLocale}. Preserve formatting (Markdown, HTML). Return only the translation, no extra commentary.`
  
  const result = await safeGenerateContent("", `${prompt}\n\nText to translate:\n${text}`)
  
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
