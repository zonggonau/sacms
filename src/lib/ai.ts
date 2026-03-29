import { GoogleGenerativeAI, GenerationConfig } from "@google/generative-ai"

// Model rotation list - prioritized by confirmed working aliases in your logs
const MODELS_TO_TRY = [
  "gemini-2.0-flash",      // Confirmed exists (Quota 429)
  "gemini-flash-latest",   // Confirmed exists (Worked, then 503)
  "gemini-1.5-flash",      // Fallback
  "gemini-1.5-flash-002",  // Stable version
  "gemini-1.5-pro",        // Pro version fallback
  "gemini-pro-latest"      // Pro alias
]

// Lazy client — only instantiated when API key is available
let _genAI: GoogleGenerativeAI | null = null

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY || "AIzaSyBV_5fCTAjQnkaDtZyJvG4U3IgLHXHBuLo"
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured")
    }
    _genAI = new GoogleGenerativeAI(apiKey)
  }
  return _genAI
}

/**
 * Executes a generative AI request with automatic model fallback and basic retry logic.
 */
export async function safeGenerateContent(
  systemPrompt: string,
  userPrompt: string,
  config: GenerationConfig = {}
): Promise<{ text: string; model: string; usage: any }> {
  let lastError: any = null
  
  for (const modelName of MODELS_TO_TRY) {
    try {
      console.log(`[AI] Attempting with model: ${modelName}`)
      
      const genAI = getGenAI()
      const model = genAI.getGenerativeModel({ 
        model: modelName, 
        generationConfig: config,
        systemInstruction: systemPrompt || undefined 
      })
      
      const result = await model.generateContent(userPrompt)
      const response = await result.response
      const text = response.text()
      
      if (text) {
        return { 
          text, 
          model: modelName,
          usage: {
            promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
            completionTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
            totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
          }
        }
      }
    } catch (error: any) {
      lastError = error
      console.warn(`[AI] Model ${modelName} failed:`, error.message)
      
      if ([404, 429, 503].includes(error.status) || error.message?.includes("429") || error.message?.includes("503") || error.message?.includes("404")) {
        continue
      }
      
      continue
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
}

export interface AISchema {
  contentTypes: any[]
  singleTypes: any[]
  components: any[]
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
 * Generate content using Google Gemini with fallback
 */
export async function generateContent(
  params: GenerateContentParams
): Promise<GenerateContentResult> {
  const { prompt, contentType, fieldName, locale = "en", tone = "professional" } = params
  const systemPrompt = buildSystemPrompt({ contentType, fieldName, locale, tone })
  
  const result = await safeGenerateContent(systemPrompt, prompt)
  
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
  
  const result = await safeGenerateContent("", `${prompt}\n\nText to summarize:\n${text}`)
  
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
}): string {
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

  parts.push("Return only the generated content. No extra commentary or labels.")

  return parts.join(" ")
}
