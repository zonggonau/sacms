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
}

export interface UserPlanConfig {
  plan_slug: string
  max_workspaces: number
}

export const USER_PLAN_LIMITS: Record<string, UserPlanConfig> = {
  // === Canonical plan names (from planpacket spec) ===
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
  custom: {
    plan_slug: "custom",
    max_workspaces: 9999, // Overridable via CustomPlanOverride
  },

  // === Backward-compat aliases (legacy plan names → canonical) ===
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
  business: {   // legacy → enterprise
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
    max_content_types: 3,
    max_content_entries: 500,
    max_team_members: 1,
    max_api_calls: 1000,
    max_storage: 100, // MB
    max_locales: 1,
    audit_log_retention: 0,
    support_level: "Community",
  },
  starter: {
    plan_slug: "starter",
    max_content_types: 5,
    max_content_entries: 5000,
    max_team_members: 3,
    max_api_calls: 10000,
    max_storage: 1024, // 1GB
    max_locales: 2,
    audit_log_retention: 7,
    support_level: "Email Support",
  },
  pro: {
    plan_slug: "pro",
    max_content_types: 10,
    max_content_entries: 10000,
    max_team_members: 10,
    max_api_calls: 100000,
    max_storage: 5120, // 5GB
    max_locales: 5,
    audit_log_retention: 30,
    support_level: "Priority Support",
  },
  enterprise: {
    plan_slug: "enterprise",
    max_content_types: 20,
    max_content_entries: 20000,
    max_team_members: 20,
    max_api_calls: 1000000,
    max_storage: 10240, // 10GB
    max_locales: 20,
    audit_log_retention: 365,
    support_level: "24/7 Dedicated Support",
  },
  custom: {
    plan_slug: "custom",
    max_content_types: 9999,
    max_content_entries: 9999999,
    max_team_members: 9999,
    max_api_calls: 99999999,
    max_storage: 102400,
    max_locales: 99,
    audit_log_retention: 9999,
    support_level: "Custom Support",
  },
}
