export interface PlanConfig {
  plan_slug: string
  max_content_types: number
  max_content_entries: number
  max_team_members: number
  max_api_calls: number
  max_storage: number // in MB
  audit_log_retention: number // in days
  support_level: string
  max_ai_tokens: number // 0 means AI is disabled
  max_custom_domains: number
}

export interface UserPlanConfig {
  plan_slug: string
  max_workspaces: number
  max_ai_credits?: number
  price_usd?: number
}

export interface AiCreditPack {
  id: string
  name: string
  credits: number
  price_usd: number
  price_idr: number
  badge?: string
  description: string
  features: string[]
}

export const AI_CREDIT_PACKS: AiCreditPack[] = [
  {
    id: "ai_pack_starter",
    name: "Starter Credits",
    credits: 300,
    price_usd: 9,
    price_idr: 149000,
    description: "Top-up 300 AI credits untuk AI Schema Builder & fitur AI di CMS.",
    features: [
      "300 AI Credits",
      "AI Schema Builder & Iterasi via Prompt",
      "Fitur AI di CMS Editor",
      "Digunakan di Semua Workspace"
    ]
  },
  {
    id: "ai_pack_pro",
    name: "Pro Credits",
    credits: 1500,
    price_usd: 29,
    price_idr: 449000,
    badge: "Most Popular",
    description: "Top-up 1.500 AI credits dengan antrean prioritas.",
    features: [
      "1.500 AI Credits",
      "AI Schema Builder & Iterasi via Prompt",
      "Fitur AI di CMS Editor",
      "Digunakan di Semua Workspace"
    ]
  },
  {
    id: "ai_pack_business",
    name: "Business Credits",
    credits: 5000,
    price_usd: 79,
    price_idr: 1199000,
    description: "Top-up 5.000 AI credits untuk tim produksi.",
    features: [
      "5.000 AI Credits",
      "AI Schema Builder & Iterasi via Prompt",
      "Fitur AI di CMS Editor",
      "Digunakan di Semua Workspace"
    ]
  },
  {
    id: "ai_pack_agency",
    name: "Agency Credits",
    credits: 15000,
    price_usd: 149,
    price_idr: 2299000,
    badge: "Best Value",
    description: "Top-up 15.000 AI credits untuk agensi dengan volume tinggi.",
    features: [
      "15.000 AI Credits",
      "AI Schema Builder & Iterasi via Prompt",
      "Fitur AI di CMS Editor",
      "Digunakan di Semua Workspace"
    ]
  }
]

// User-reported bug: max_ai_credits was never set for ANY plan here (not
// even "enterprise") — enforceUserAiCredits() only ever granted real
// credits through a purchased EnterpriseLicense's own aiCredits field, so
// every account without one (i.e. every Free/Starter/Pro/Business account,
// and even an "enterprise"-PLAN account with no actual License row) was
// stuck at 0 base credits regardless of plan. These are a free per-plan
// allowance on top of that License path (still unlimited/license-bound)
// and on top of any manually-purchased AiCreditPack top-up
// (User.aiCreditsExtra, added separately in getUserEffectiveMax).
export const USER_PLAN_LIMITS: Record<string, UserPlanConfig> = {
  // === Canonical plan names ===
  free: {
    plan_slug: "free",
    max_workspaces: 1,
    max_ai_credits: 10,
  },
  starter: {
    plan_slug: "starter",
    max_workspaces: 3,
    max_ai_credits: 25,
  },
  pro: {
    plan_slug: "pro",
    max_workspaces: 10,
    max_ai_credits: 100,
  },
  enterprise: {
    plan_slug: "enterprise",
    max_workspaces: 20,
    max_ai_credits: 300,
  },
  custom: {
    plan_slug: "custom",
    max_workspaces: 9999, // Overridable via CustomPlanOverride
    max_ai_credits: 300, // Same baseline as enterprise; fine-tune per account via CustomPlanOverride.
  },

  // === Backward-compat aliases ===
  standard: {   // legacy → starter
    plan_slug: "starter",
    max_workspaces: 3,
    max_ai_credits: 25,
  },
  standar: {    // Indonesian alias → starter
    plan_slug: "starter",
    max_workspaces: 3,
    max_ai_credits: 25,
  },
  professional: { // legacy → pro
    plan_slug: "pro",
    max_workspaces: 10,
    max_ai_credits: 100,
  },
  profesional: {  // Indonesian alias → pro
    plan_slug: "pro",
    max_workspaces: 10,
    max_ai_credits: 100,
  },
  business: {     // Indonesian alias → enterprise
    plan_slug: "enterprise",
    max_workspaces: 20,
    max_ai_credits: 300,
  },
  bisnis: {     // Indonesian alias → enterprise
    plan_slug: "enterprise",
    max_workspaces: 20,
    max_ai_credits: 300,
  },
  unlimited: {  // legacy → custom
    plan_slug: "custom",
    max_workspaces: 9999,
    max_ai_credits: 300,
  },
}

export const DEFAULT_LIMITS: Record<string, PlanConfig> = {
  free: {
    plan_slug: "free",
    max_content_types: 999999, // Unlimited schemas for all plans
    max_content_entries: 500,
    max_team_members: 1,
    max_api_calls: 1000,
    max_storage: 100, // MB
    audit_log_retention: 0,
    support_level: "Community",
    max_ai_tokens: 50000,
    max_custom_domains: 5,
  },
  starter: {
    plan_slug: "starter",
    max_content_types: 999999, // Unlimited schemas for all plans
    max_content_entries: 5000,
    max_team_members: 3,
    max_api_calls: 10000,
    max_storage: 1024, // 1GB
    audit_log_retention: 7,
    support_level: "Email Support",
    max_ai_tokens: 100000,
    max_custom_domains: 10,
  },
  pro: {
    plan_slug: "pro",
    max_content_types: 999999, // Unlimited schemas for all plans
    max_content_entries: 10000,
    max_team_members: 10,
    max_api_calls: 100000,
    max_storage: 5120, // 5GB
    audit_log_retention: 30,
    support_level: "Priority Support",
    max_ai_tokens: 500000,
    max_custom_domains: 25,
  },
  enterprise: {
    plan_slug: "enterprise",
    max_content_types: 999999, // Unlimited schemas for all plans
    max_content_entries: 20000,
    max_team_members: 20,
    max_api_calls: 1000000,
    max_storage: 51200, // 50GB
    audit_log_retention: 365,
    support_level: "24/7 Dedicated Support",
    max_ai_tokens: 2000000,
    max_custom_domains: 50,
  },
  custom: {
    plan_slug: "custom",
    max_content_types: 999999,
    max_content_entries: 9999999,
    max_team_members: 9999,
    max_api_calls: 99999999,
    max_storage: 102400,
    audit_log_retention: 9999,
    support_level: "Custom Support",
    max_ai_tokens: 99999999,
    max_custom_domains: 9999,
  },
}
