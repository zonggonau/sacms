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
import { createGateway } from "@ai-sdk/gateway"
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

// Canonical model slug mapping for Vercel AI Gateway (verified working endpoints)
const GATEWAY_MODEL_MAP: Record<string, string> = {
  // 🔵 Google Gemini (google/gemini-2.5-flash is active & fast on Vercel AI Gateway)
  "gemini-2.5-flash": "google/gemini-2.5-flash",
  "gemini-2.5-pro": "google/gemini-2.5-flash",
  "gemini-2.0-flash": "google/gemini-2.5-flash",
  "gemini-1.5-flash": "google/gemini-2.5-flash",
  "gemini-1.5-flash-latest": "google/gemini-2.5-flash",
  "gemini-1.5-pro": "google/gemini-2.5-flash",
  "gemini-1.5-pro-latest": "google/gemini-2.5-flash",

  // 🟤 Anthropic Claude (anthropic/claude-3-haiku is active on Vercel AI Gateway)
  "claude-3-7-sonnet": "anthropic/claude-3-haiku",
  "claude-3-5-sonnet": "anthropic/claude-3-haiku",
  "claude-3-5-haiku": "anthropic/claude-3-haiku",
  "claude-3-opus": "anthropic/claude-3-haiku",
  "claude-sonnet-4": "anthropic/claude-3-haiku",

  // 🟢 OpenAI
  "gpt-4o": "openai/gpt-4o",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "o3-mini": "openai/gpt-4o",
  "o1": "openai/gpt-4o",
  "gpt-4-turbo": "openai/gpt-4o",

  // 🟣 DeepSeek
  "deepseek-chat": "deepseek/deepseek-v3.1",
  "deepseek-reasoner": "deepseek/deepseek-r1",

  // ⚡ Groq / Meta Llama
  "llama-3.3-70b": "meta/llama-3.3-70b",
  "llama-3.1-8b": "meta/llama-3.3-70b",
  "mixtral-8x7b": "meta/llama-3.3-70b",

  // 🟠 Mistral AI
  "codestral": "mistral/codestral",
  "mistral-large": "mistral/codestral",

  // ⬛ xAI (Grok)
  "grok-2": "openai/gpt-4o",
  "grok-2-vision": "openai/gpt-4o",

  // 🌐 OpenRouter / Alibaba
  "openrouter-auto": "openai/gpt-4o-mini",
  "openrouter-qwen-72b": "openai/gpt-4o-mini",
  "qwen-2.5-72b": "openai/gpt-4o-mini",
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
    "https://ai-gateway.vercel.sh/v4/ai"

  if (gatewayKey) {
    // Use the native @ai-sdk/gateway provider, not a hand-rolled
    // createOpenAI({baseURL: gatewayBaseUrl}) pointed at the /v1
    // OpenAI-compat shim. The compat shim can't forward provider-specific
    // providerOptions (they're only ever read as `providerOptions.openai`),
    // and its translation to Vertex (used for Gemini) mis-pairs multi-step
    // tool-call/response turns — Vertex then rejects the next turn with
    // "number of function response parts...". The native gateway provider
    // talks the real Gateway protocol and routes providerOptions to the
    // actual resolved provider (e.g. `providerOptions.google`).
    const gatewayProvider = createGateway({
      baseURL: gatewayBaseUrl,
      apiKey: gatewayKey,
    })
    const gatewayModelId =
      GATEWAY_MODEL_MAP[modelId] ||
      GATEWAY_MODEL_MAP[config.providerModelId] ||
      (config.provider === "google"
        ? "google/gemini-2.5-flash"
        : config.provider === "anthropic"
        ? "anthropic/claude-3-haiku"
        : config.provider === "openai"
        ? "openai/gpt-4o"
        : "openai/gpt-4o-mini")
    return gatewayProvider(gatewayModelId) as LanguageModel
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
