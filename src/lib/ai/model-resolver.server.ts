/**
 * Server-Side AI Model Resolver for SaCMS AI Website Builder & Content Engine
 *
 * Resolves a model config id into a Vercel AI SDK LanguageModel instance.
 * Dynamically resolves API keys from Super Admin database settings first,
 * with graceful fallback to server environment variables.
 *
 * This file is strictly SERVER-ONLY.
 */

import { openai, createOpenAI } from "@ai-sdk/openai"
import { google, createGoogleGenerativeAI } from "@ai-sdk/google"
import type { LanguageModel } from "ai"
import { getPlatformSettings } from "@/lib/settings"
import { getModelConfig, AI_MODEL_REGISTRY } from "./model-registry"

// Anthropic provider helper with createAnthropic support
let anthropicModule: any = null
async function getAnthropicModule() {
  if (anthropicModule) return anthropicModule
  try {
    anthropicModule = await import("@ai-sdk/anthropic")
    return anthropicModule
  } catch {
    return null
  }
}

// Canonical model slug mapping for Vercel AI Gateway
const GATEWAY_MODEL_MAP: Record<string, string> = {
  // 🔵 Google Gemini
  "gemini-2.5-flash": "google/gemini-2.5-flash",
  "gemini-2.5-pro": "google/gemini-2.5-pro",
  "gemini-2.0-flash": "google/gemini-2.0-flash",
  "gemini-1.5-pro": "google/gemini-2.5-pro",

  // 🟤 Anthropic Claude
  "claude-3-7-sonnet": "anthropic/claude-sonnet-4",
  "claude-3-5-sonnet": "anthropic/claude-sonnet-4",
  "claude-3-5-haiku": "anthropic/claude-3-haiku",
  "claude-3-opus": "anthropic/claude-opus-4",

  // 🟢 OpenAI
  "gpt-4o": "openai/gpt-4o",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "o3-mini": "openai/o3-mini",
  "o1": "openai/o1",
  "gpt-4-turbo": "openai/gpt-4-turbo",

  // 🟣 DeepSeek
  "deepseek-chat": "deepseek/deepseek-v3.1",
  "deepseek-reasoner": "deepseek/deepseek-r1",

  // ⚡ Groq / Meta Llama
  "llama-3.3-70b": "meta/llama-3.3-70b",
  "llama-3.1-8b": "meta/llama-3.1-8b",
  "mixtral-8x7b": "meta/llama-3.3-70b",

  // 🟠 Mistral AI
  "codestral": "mistral/codestral",
  "mistral-large": "mistral/mistral-large-3",

  // ⬛ xAI (Grok)
  "grok-2": "spacexai/grok-4.1-fast-non-reasoning",
  "grok-2-vision": "spacexai/grok-4.1-fast-non-reasoning",

  // 🌐 OpenRouter / Alibaba
  "openrouter-auto": "openai/gpt-4o-mini",
  "qwen-2.5-72b": "alibaba/qwen-3-32b",
}

/**
 * Resolve a model config id into an AI SDK LanguageModel instance.
 * Dynamically resolves API keys from Super Admin database settings first,
 * with graceful fallback to server environment variables.
 */
export async function resolveModel(modelId: string): Promise<LanguageModel> {
  const config = getModelConfig(modelId)
  if (!config) {
    throw new Error(`Unknown AI model: "${modelId}". Available: ${AI_MODEL_REGISTRY.map((m) => m.id).join(", ")}`)
  }

  // Fetch live platform settings (cached in Redis, backed by PostgreSQL db.setting)
  const settings = await getPlatformSettings().catch(() => null)

  // 1. Unified Vercel AI Gateway (1 API Key access to all models)
  const gatewayKey =
    settings?.aiGatewayApiKey ||
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_AI_API_KEY
  const gatewayBaseUrl =
    settings?.aiGatewayBaseUrl ||
    process.env.AI_GATEWAY_BASE_URL ||
    "https://ai-gateway.vercel.sh/v1"

  if (gatewayKey) {
    const gateway = createOpenAI({
      baseURL: gatewayBaseUrl,
      apiKey: gatewayKey,
    })
    const gatewayModelId =
      GATEWAY_MODEL_MAP[modelId] ||
      (config.provider === "openai"
        ? (config.providerModelId.startsWith("openai/") ? config.providerModelId : `openai/${config.providerModelId}`)
        : `${config.provider}/${config.providerModelId}`)
    return gateway(gatewayModelId) as LanguageModel
  }

  // 2. Direct Provider Fallbacks
  switch (config.provider) {
    case "google": {
      const apiKey =
        settings?.geminiApiKey ||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
        process.env.GEMINI_API_KEY
      if (!apiKey) {
        throw new Error(
          "Google Gemini API Key belum dikonfigurasi. Atur di Super Admin Settings (/admin/settings) atau env GOOGLE_GENERATIVE_AI_API_KEY."
        )
      }
      const customGoogle = createGoogleGenerativeAI({ apiKey })
      return customGoogle(config.providerModelId) as LanguageModel
    }

    case "anthropic": {
      const apiKey = settings?.anthropicApiKey || process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        throw new Error(
          "Anthropic Claude API Key belum dikonfigurasi. Atur di Super Admin Settings (/admin/settings) atau env ANTHROPIC_API_KEY."
        )
      }
      const mod = await getAnthropicModule()
      if (!mod) {
        throw new Error("Package @ai-sdk/anthropic tidak tersedia. Jalankan: bun add @ai-sdk/anthropic")
      }
      const customAnthropic = mod.createAnthropic ? mod.createAnthropic({ apiKey }) : mod.anthropic
      return customAnthropic(config.providerModelId) as LanguageModel
    }

    case "openai": {
      const apiKey = settings?.openaiApiKey || process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error(
          "OpenAI API Key belum dikonfigurasi. Atur di Super Admin Settings (/admin/settings) atau env OPENAI_API_KEY."
        )
      }
      const customOpenAI = createOpenAI({ apiKey })
      return customOpenAI(config.providerModelId) as LanguageModel
    }

    case "deepseek": {
      const apiKey =
        settings?.deepseekApiKey ||
        settings?.platformAiApiKey ||
        process.env.DEEPSEEK_API_KEY
      if (!apiKey) {
        throw new Error(
          "DeepSeek API Key belum dikonfigurasi. Atur di Super Admin Settings (/admin/settings) atau env DEEPSEEK_API_KEY."
        )
      }
      const deepseekClient = createOpenAI({
        baseURL: "https://api.deepseek.com",
        apiKey,
      })
      return deepseekClient(config.providerModelId) as LanguageModel
    }

    case "groq": {
      const apiKey = settings?.groqApiKey || process.env.GROQ_API_KEY
      if (!apiKey) {
        throw new Error(
          "Groq API Key belum dikonfigurasi. Atur di Super Admin Settings (/admin/settings) atau env GROQ_API_KEY."
        )
      }
      const groqClient = createOpenAI({
        baseURL: "https://api.groq.com/openai/v1",
        apiKey,
      })
      return groqClient(config.providerModelId) as LanguageModel
    }

    case "mistral": {
      const apiKey = settings?.mistralApiKey || process.env.MISTRAL_API_KEY
      if (!apiKey) {
        throw new Error(
          "Mistral AI API Key belum dikonfigurasi. Atur di Super Admin Settings (/admin/settings) atau env MISTRAL_API_KEY."
        )
      }
      const mistralClient = createOpenAI({
        baseURL: "https://api.mistral.ai/v1",
        apiKey,
      })
      return mistralClient(config.providerModelId) as LanguageModel
    }

    case "xai": {
      const apiKey = settings?.xaiApiKey || process.env.XAI_API_KEY
      if (!apiKey) {
        throw new Error(
          "xAI (Grok) API Key belum dikonfigurasi. Atur di Super Admin Settings (/admin/settings) atau env XAI_API_KEY."
        )
      }
      const xaiClient = createOpenAI({
        baseURL: "https://api.x.ai/v1",
        apiKey,
      })
      return xaiClient(config.providerModelId) as LanguageModel
    }

    case "openrouter": {
      const apiKey = settings?.openrouterApiKey || process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        throw new Error(
          "OpenRouter API Key belum dikonfigurasi. Atur di Super Admin Settings (/admin/settings) atau env OPENROUTER_API_KEY."
        )
      }
      const openRouterClient = createOpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey,
      })
      return openRouterClient(config.providerModelId) as LanguageModel
    }

    default:
      throw new Error(`Unsupported provider: ${config.provider}`)
  }
}
