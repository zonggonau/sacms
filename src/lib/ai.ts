import OpenAI from "openai"

// Lazy client — only instantiated when API key is available
let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured")
    }
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _client
}

export interface GenerateContentParams {
  prompt: string
  contentType?: string
  fieldName?: string
  locale?: string
  maxTokens?: number
  tone?: "formal" | "casual" | "professional" | "creative" | "technical"
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
 * Generate content using OpenAI
 */
export async function generateContent(
  params: GenerateContentParams
): Promise<GenerateContentResult> {
  const {
    prompt,
    contentType,
    fieldName,
    locale = "en",
    maxTokens = 1024,
    tone = "professional",
  } = params

  const systemPrompt = buildSystemPrompt({ contentType, fieldName, locale, tone })

  const response = await getClient().chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.7,
  })

  const content = response.choices[0]?.message?.content || ""

  return {
    content,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    },
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

  const response = await getClient().chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a content summarizer. Summarize the given text concisely in ${maxLength} characters or less. Output in locale: ${locale}. Return only the summary, no extra commentary.`,
      },
      { role: "user", content: text },
    ],
    max_tokens: 256,
    temperature: 0.3,
  })

  const content = response.choices[0]?.message?.content || ""

  return {
    content,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    },
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

  const response = await getClient().chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a professional translator. Translate the given text${sourceLocale !== "auto" ? ` from ${sourceLocale}` : ""} to ${targetLocale}. Preserve formatting (Markdown, HTML). Return only the translation, no extra commentary.`,
      },
      { role: "user", content: text },
    ],
    max_tokens: 2048,
    temperature: 0.3,
  })

  const content = response.choices[0]?.message?.content || ""

  return {
    content,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    },
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
