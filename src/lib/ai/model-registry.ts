/**
 * AI Model Registry — Multi-Provider Model Configuration for SaCMS AI Website Builder
 *
 * Provides a unified registry of AI models across multiple providers (Google, Anthropic,
 * OpenAI, DeepSeek, Groq, Mistral, xAI, OpenRouter) using the Vercel AI SDK interface.
 * Each model entry maps a user-facing id to its provider-specific constructor, credit cost,
 * and metadata.
 *
 * All models flow through the standard Vercel AI SDK `streamText`/`generateText` agent loop.
 */

export type AiProviderId =
  | "google"
  | "anthropic"
  | "openai"
  | "deepseek"
  | "groq"
  | "mistral"
  | "xai"
  | "openrouter"
  | "sacms"

export interface AiModelConfig {
  /** Unique model id used in the UI and API */
  id: string
  /** Human-readable display name */
  name: string
  /** Short badge text (e.g. "Fast", "Recommended") */
  badge: string
  /** User-facing description of the model's strengths */
  description: string
  /** Credit cost per generation */
  credits: number
  /** Credit cost per iteration (follow-up) */
  iterationCredits: number
  /** Whether this is the recommended default */
  isPopular?: boolean
  /** Provider identifier for grouping in UI */
  provider: AiProviderId
  /** Provider icon emoji */
  providerIcon: string
  /** The AI SDK model constructor string (e.g. "gpt-4o") */
  providerModelId: string
  /** Maximum output tokens for this model */
  maxTokens: number
  /** Requires upgraded plan? */
  requiresUpgrade?: boolean
}

/**
 * The canonical model registry. Grouped by provider for the cascading UI picker.
 */
export const AI_MODEL_REGISTRY: AiModelConfig[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // 🔵 GOOGLE GEMINI
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    badge: "Blazing Fast ★",
    description: "Generasi terbaru Google — kecepatan kilat & penalaran cerdas untuk antarmuka web.",
    credits: 10,
    iterationCredits: 3,
    isPopular: true,
    provider: "google",
    providerIcon: "🔵",
    providerModelId: "gemini-2.5-flash-preview-05-20",
    maxTokens: 65536,
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    badge: "High Reasoning",
    description: "Penalaran tingkat lanjut Google untuk database multi-relasi & logika kompleks.",
    credits: 30,
    iterationCredits: 7,
    provider: "google",
    providerIcon: "🔵",
    providerModelId: "gemini-2.5-pro-preview-06-05",
    maxTokens: 65536,
    requiresUpgrade: true,
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    badge: "Multimodal Fast",
    description: "Performa seimbang dan stabil untuk berbagai jenis website perusahaan modern.",
    credits: 10,
    iterationCredits: 3,
    provider: "google",
    providerIcon: "🔵",
    providerModelId: "gemini-2.0-flash",
    maxTokens: 32768,
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    badge: "Deep Context 2M",
    description: "Context window 2M token — ideal untuk memproses skema data sangat besar.",
    credits: 20,
    iterationCredits: 5,
    provider: "google",
    providerIcon: "🔵",
    providerModelId: "gemini-1.5-pro-latest",
    maxTokens: 32768,
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    badge: "Super Hemat",
    description: "Pilihan paling hemat credit untuk landing page sederhana & prototipe cepat.",
    credits: 8,
    iterationCredits: 2,
    provider: "google",
    providerIcon: "🔵",
    providerModelId: "gemini-1.5-flash-latest",
    maxTokens: 16384,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 🟤 CLAUDE (ANTHROPIC)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "claude-3-7-sonnet",
    name: "Claude 3.7 Sonnet",
    badge: "Hybrid Reasoning ★",
    description: "Model Anthropic paling mutakhir dengan penalaran coding hybrid terdepan di industri.",
    credits: 35,
    iterationCredits: 8,
    isPopular: true,
    provider: "anthropic",
    providerIcon: "🟤",
    providerModelId: "claude-3-7-sonnet-20250219",
    maxTokens: 16384,
    requiresUpgrade: true,
  },
  {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    badge: "Best Coder",
    description: "Standar emas AI untuk web development Next.js, TypeScript & Tailwind CSS.",
    credits: 25,
    iterationCredits: 5,
    provider: "anthropic",
    providerIcon: "🟤",
    providerModelId: "claude-3-5-sonnet-20241022",
    maxTokens: 16384,
  },
  {
    id: "claude-3-5-haiku",
    name: "Claude 3.5 Haiku",
    badge: "Fast & Precise",
    description: "Kecepatan tinggi dan hemat untuk perubahan dan iterasi desain cepat.",
    credits: 8,
    iterationCredits: 2,
    provider: "anthropic",
    providerIcon: "🟤",
    providerModelId: "claude-3-5-haiku-20241022",
    maxTokens: 8192,
  },
  {
    id: "claude-3-opus",
    name: "Claude 3 Opus",
    badge: "Deep Wisdom",
    description: "Pemahaman bahasa dan arsitektur komprehensif untuk proyek skala enterprise.",
    credits: 45,
    iterationCredits: 10,
    provider: "anthropic",
    providerIcon: "🟤",
    providerModelId: "claude-3-opus-20240229",
    maxTokens: 32768,
    requiresUpgrade: true,
  },
  {
    id: "claude-sonnet-4",
    name: "Claude Sonnet 4",
    badge: "Next-Gen Preview",
    description: "Pratinjau generasi Sonnet berikutnya dengan kapabilitas arsitektural mutakhir.",
    credits: 30,
    iterationCredits: 7,
    provider: "anthropic",
    providerIcon: "🟤",
    providerModelId: "claude-sonnet-4-20250514",
    maxTokens: 16384,
    requiresUpgrade: true,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 🟢 OPENAI
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "gpt-4o",
    name: "GPT-4o",
    badge: "Flagship ★",
    description: "Model andalan OpenAI serbaguna — kecepatan tinggi dan pemahaman UI hebat.",
    credits: 25,
    iterationCredits: 5,
    isPopular: true,
    provider: "openai",
    providerIcon: "🟢",
    providerModelId: "gpt-4o",
    maxTokens: 16384,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    badge: "Fast & Light",
    description: "Model cepat dan ekonomis untuk pembuatan prototipe antarmuka awal.",
    credits: 10,
    iterationCredits: 3,
    provider: "openai",
    providerIcon: "🟢",
    providerModelId: "gpt-4o-mini",
    maxTokens: 16384,
  },
  {
    id: "o3-mini",
    name: "o3-mini",
    badge: "STEM Reasoning",
    description: "Model penalaran tinggi berlatensi rendah untuk kalkulasi dan logika data rumit.",
    credits: 35,
    iterationCredits: 8,
    provider: "openai",
    providerIcon: "🟢",
    providerModelId: "o3-mini",
    maxTokens: 65536,
    requiresUpgrade: true,
  },
  {
    id: "o1",
    name: "o1",
    badge: "Full Reasoning",
    description: "Model reasoning penuh OpenAI — berpikir mendalam sebelum menghasilkan kode.",
    credits: 50,
    iterationCredits: 12,
    provider: "openai",
    providerIcon: "🟢",
    providerModelId: "o1",
    maxTokens: 65536,
    requiresUpgrade: true,
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    badge: "Reliable Workhorse",
    description: "Klasik performa tinggi dengan output instruksi yang konsisten.",
    credits: 25,
    iterationCredits: 5,
    provider: "openai",
    providerIcon: "🟢",
    providerModelId: "gpt-4-turbo",
    maxTokens: 16384,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 🟣 DEEPSEEK
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "deepseek-chat",
    name: "DeepSeek V3",
    badge: "Ultra Hemat ★",
    description: "Model flagship DeepSeek V3 — performa setara frontier dengan biaya sangat hemat.",
    credits: 8,
    iterationCredits: 2,
    isPopular: true,
    provider: "deepseek",
    providerIcon: "🟣",
    providerModelId: "deepseek-chat",
    maxTokens: 16384,
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek R1",
    badge: "Deep Reasoning ★",
    description: "Model reasoning open-weights nomor satu di dunia dengan rantai pemikiran (CoT) mendalam.",
    credits: 15,
    iterationCredits: 4,
    provider: "deepseek",
    providerIcon: "🟣",
    providerModelId: "deepseek-reasoner",
    maxTokens: 32768,
    requiresUpgrade: true,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // ⚡ GROQ (ULTRA-FAST LPU)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "groq-llama-3.3-70b",
    name: "Llama 3.3 70B",
    badge: "300+ t/s Speed ★",
    description: "Kecepatan generasi secepat kilat di Groq LPU dengan kecerdasan Meta Llama 3.3 70B.",
    credits: 10,
    iterationCredits: 3,
    isPopular: true,
    provider: "groq",
    providerIcon: "⚡",
    providerModelId: "llama-3.3-70b-versatile",
    maxTokens: 16384,
  },
  {
    id: "groq-llama-3.1-8b",
    name: "Llama 3.1 8B",
    badge: "Zero-Wait Latency",
    description: "Inferensi instan dengan latency mendekati nol untuk live preview real-time.",
    credits: 5,
    iterationCredits: 1,
    provider: "groq",
    providerIcon: "⚡",
    providerModelId: "llama-3.1-8b-instant",
    maxTokens: 8192,
  },
  {
    id: "groq-mixtral-8x7b",
    name: "Mixtral 8x7B",
    badge: "MoE Efficiency",
    description: "Arsitektur Mixture of Experts di Groq LPU untuk respons cepat dan beragam.",
    credits: 8,
    iterationCredits: 2,
    provider: "groq",
    providerIcon: "⚡",
    providerModelId: "mixtral-8x7b-32768",
    maxTokens: 16384,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 🟠 MISTRAL AI
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "codestral-latest",
    name: "Codestral 2501",
    badge: "Code Specialist ★",
    description: "Model spesialis pemrograman dari Mistral AI — unggul dalam Next.js, React, dan TypeScript.",
    credits: 15,
    iterationCredits: 4,
    provider: "mistral",
    providerIcon: "🟠",
    providerModelId: "codestral-latest",
    maxTokens: 32768,
  },
  {
    id: "mistral-large-latest",
    name: "Mistral Large 2",
    badge: "Frontier Logic",
    description: "Model flagship Mistral AI dengan penalaran multibahasa dan arsitektur kelas enterprise.",
    credits: 22,
    iterationCredits: 5,
    provider: "mistral",
    providerIcon: "🟠",
    providerModelId: "mistral-large-latest",
    maxTokens: 32768,
    requiresUpgrade: true,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // ⬛ xAI (GROK)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "grok-2",
    name: "Grok 2",
    badge: "Frontier SOTA ★",
    description: "Model unggulan xAI dengan pemahaman mendalam tentang tren teknologi web modern.",
    credits: 20,
    iterationCredits: 5,
    provider: "xai",
    providerIcon: "⬛",
    providerModelId: "grok-2-1212",
    maxTokens: 16384,
    requiresUpgrade: true,
  },
  {
    id: "grok-2-vision",
    name: "Grok 2 Vision",
    badge: "Multimodal UI",
    description: "Mampu memproses gambar referensi dan sketsa UI untuk menghasilkan kode web.",
    credits: 25,
    iterationCredits: 6,
    provider: "xai",
    providerIcon: "⬛",
    providerModelId: "grok-2-vision-1212",
    maxTokens: 16384,
    requiresUpgrade: true,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // 🌐 OPENROUTER
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: "openrouter-auto",
    name: "OpenRouter Auto Best",
    badge: "Smart SOTA Router ★",
    description: "Otomatis merutekan prompt ke model AI terbaik yang tersedia dengan harga paling optimal.",
    credits: 15,
    iterationCredits: 4,
    provider: "openrouter",
    providerIcon: "🌐",
    providerModelId: "openrouter/auto",
    maxTokens: 16384,
  },
  {
    id: "openrouter-qwen-72b",
    name: "Qwen 2.5 72B",
    badge: "Top Open Weights",
    description: "Model open-source terkuat dari Alibaba Cloud — luar biasa presisi dalam sintaks Next.js.",
    credits: 12,
    iterationCredits: 3,
    provider: "openrouter",
    providerIcon: "🌐",
    providerModelId: "qwen/qwen-2.5-72b-instruct",
    maxTokens: 32768,
  },
]

/**
 * Get the default model config (first popular one, or first overall)
 */
export function getDefaultModel(): AiModelConfig {
  return AI_MODEL_REGISTRY.find((m) => m.isPopular) || AI_MODEL_REGISTRY[0]
}

/**
 * Find a model config by its id
 */
export function getModelConfig(modelId: string): AiModelConfig | undefined {
  return AI_MODEL_REGISTRY.find((m) => m.id === modelId)
}

/**
 * Get all available models grouped by provider for the UI picker
 */
export function getModelsGroupedByProvider(): Record<string, AiModelConfig[]> {
  const groups: Record<string, AiModelConfig[]> = {}
  for (const model of AI_MODEL_REGISTRY) {
    if (!groups[model.provider]) groups[model.provider] = []
    groups[model.provider].push(model)
  }
  return groups
}

/**
 * Get the provider display name
 */
export function getProviderDisplayName(provider: string): string {
  switch (provider) {
    case "openai": return "OpenAI"
    case "anthropic": return "Claude (Anthropic)"
    case "google": return "Google Gemini"
    case "deepseek": return "DeepSeek AI"
    case "groq": return "Groq LPU"
    case "mistral": return "Mistral AI"
    case "xai": return "xAI Grok"
    case "openrouter": return "OpenRouter"
    case "sacms": return "SaCMS"
    default: return provider
  }
}
