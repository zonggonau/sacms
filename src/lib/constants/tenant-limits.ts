export interface PlanConfig {
  plan_slug: string
  max_content_types: number
  max_content_entries: number
  max_team_members: number
  max_api_calls: number
  max_storage: number // in MB
  max_locales: number
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
    description: "Top-up 300 AI credits untuk Next.js frontend builds.",
    features: [
      "300 AI Credits",
      "Iterasi Desain AI Cepat",
      "Deploy 1-Klik Vercel",
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
      "Iterasi Desain AI Cepat",
      "Deploy 1-Klik Vercel",
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
      "Iterasi Desain AI Cepat",
      "Deploy 1-Klik Vercel",
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
      "Iterasi Desain AI Cepat",
      "Deploy 1-Klik Vercel",
      "Digunakan di Semua Workspace"
    ]
  }
]

export const USER_PLAN_LIMITS: Record<string, UserPlanConfig> = {
  // === Canonical plan names ===
  free: {
    plan_slug: "free",
    max_workspaces: 1,
  },
  starter: {
    plan_slug: "starter",
    max_workspaces: 3,
  },
  pro: {
    plan_slug: "pro",
    max_workspaces: 10,
  },
  enterprise: {
    plan_slug: "enterprise",
    max_workspaces: 20,
  },
  "enterprise-vps": {
    plan_slug: "enterprise-vps",
    max_workspaces: 25,
  },
  "vps-s": {
    plan_slug: "vps-s",
    max_workspaces: 25,
  },
  "vps-m": {
    plan_slug: "vps-m",
    max_workspaces: 35,
  },
  "vps-l": {
    plan_slug: "vps-l",
    max_workspaces: 50,
  },
  "enterprise-vds": {
    plan_slug: "enterprise-vds",
    max_workspaces: 50,
  },
  "vds-s": {
    plan_slug: "vds-s",
    max_workspaces: 50,
  },
  "vds-m": {
    plan_slug: "vds-m",
    max_workspaces: 75,
  },
  "vds-l": {
    plan_slug: "vds-l",
    max_workspaces: 100,
  },
  custom: {
    plan_slug: "custom",
    max_workspaces: 9999, // Overridable via CustomPlanOverride
  },

  // === Backward-compat aliases ===
  standard: {   // legacy → starter
    plan_slug: "starter",
    max_workspaces: 3,
  },
  standar: {    // Indonesian alias → starter
    plan_slug: "starter",
    max_workspaces: 3,
  },
  professional: { // legacy → pro
    plan_slug: "pro",
    max_workspaces: 10,
  },
  profesional: {  // Indonesian alias → pro
    plan_slug: "pro",
    max_workspaces: 10,
  },
  business: {     // Indonesian alias → enterprise
    plan_slug: "enterprise",
    max_workspaces: 20,
  },
  bisnis: {     // Indonesian alias → enterprise
    plan_slug: "enterprise",
    max_workspaces: 20,
  },
  unlimited: {  // legacy → custom
    plan_slug: "custom",
    max_workspaces: 9999,
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
    max_locales: 1,
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
    max_locales: 2,
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
    max_locales: 5,
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
    max_storage: 10240, // 10GB
    max_locales: 20,
    audit_log_retention: 365,
    support_level: "24/7 Dedicated Support",
    max_ai_tokens: 2000000,
    max_custom_domains: 50,
  },
  "enterprise-vps": {
    plan_slug: "enterprise-vps",
    max_content_types: 999999,
    max_content_entries: 500000,
    max_team_members: 50,
    max_api_calls: 10000000,
    max_storage: 76800, // 75GB NVMe Dedicated
    max_locales: 50,
    audit_log_retention: 365,
    support_level: "24/7 Dedicated SLA & Support",
    max_ai_tokens: 5000000,
    max_custom_domains: 100,
  },
  "vps-s": {
    plan_slug: "vps-s",
    max_content_types: 999999,
    max_content_entries: 500000,
    max_team_members: 50,
    max_api_calls: 10000000,
    max_storage: 76800, // 75GB NVMe Dedicated
    max_locales: 50,
    audit_log_retention: 365,
    support_level: "24/7 Dedicated SLA & Support",
    max_ai_tokens: 5000000,
    max_custom_domains: 100,
  },
  "vps-m": {
    plan_slug: "vps-m",
    max_content_types: 999999,
    max_content_entries: 1000000,
    max_team_members: 75,
    max_api_calls: 25000000,
    max_storage: 153600, // 150GB NVMe Dedicated
    max_locales: 75,
    audit_log_retention: 365,
    support_level: "24/7 Dedicated SLA & Support",
    max_ai_tokens: 10000000,
    max_custom_domains: 35,
  },
  "vps-l": {
    plan_slug: "vps-l",
    max_content_types: 999999,
    max_content_entries: 2000000,
    max_team_members: 100,
    max_api_calls: 50000000,
    max_storage: 307200, // 300GB NVMe Dedicated
    max_locales: 100,
    audit_log_retention: 365,
    support_level: "24/7 Dedicated SLA & Support",
    max_ai_tokens: 15000000,
    max_custom_domains: 50,
  },
  "enterprise-vds": {
    plan_slug: "enterprise-vds",
    max_content_types: 999999,
    max_content_entries: 2000000,
    max_team_members: 100,
    max_api_calls: 50000000,
    max_storage: 184320, // 180GB NVMe Dedicated
    max_locales: 100,
    audit_log_retention: 730,
    support_level: "Dedicated DevOps Engineer & 99.99% SLA",
    max_ai_tokens: 20000000,
    max_custom_domains: 50,
  },
  "vds-s": {
    plan_slug: "vds-s",
    max_content_types: 999999,
    max_content_entries: 3000000,
    max_team_members: 150,
    max_api_calls: 75000000,
    max_storage: 184320, // 180GB NVMe Dedicated
    max_locales: 150,
    audit_log_retention: 730,
    support_level: "Dedicated DevOps Engineer & 99.99% SLA",
    max_ai_tokens: 25000000,
    max_custom_domains: 60,
  },
  "vds-m": {
    plan_slug: "vds-m",
    max_content_types: 999999,
    max_content_entries: 5000000,
    max_team_members: 200,
    max_api_calls: 100000000,
    max_storage: 245760, // 240GB NVMe Dedicated
    max_locales: 200,
    audit_log_retention: 730,
    support_level: "Dedicated DevOps Engineer & 99.99% SLA",
    max_ai_tokens: 50000000,
    max_custom_domains: 80,
  },
  "vds-l": {
    plan_slug: "vds-l",
    max_content_types: 999999,
    max_content_entries: 10000000,
    max_team_members: 500,
    max_api_calls: 200000000,
    max_storage: 368640, // 360GB NVMe Dedicated
    max_locales: 500,
    audit_log_retention: 730,
    support_level: "Dedicated DevOps Engineer & 99.99% SLA",
    max_ai_tokens: 100000000,
    max_custom_domains: 100,
  },
  custom: {
    plan_slug: "custom",
    max_content_types: 999999,
    max_content_entries: 9999999,
    max_team_members: 9999,
    max_api_calls: 99999999,
    max_storage: 102400,
    max_locales: 99,
    audit_log_retention: 9999,
    support_level: "Custom Support",
    max_ai_tokens: 99999999,
    max_custom_domains: 9999,
  },
}
