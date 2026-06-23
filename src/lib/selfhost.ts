/**
 * Self-Hosted Mode Configuration
 * 
 * When SELFHOST_MODE=true, SaCMS runs as a single-tenant self-hosted CMS.
 * Landing page, SaaS billing, and admin panel are disabled.
 * Only /dashboard/* routes and public APIs are active.
 */

// ─── SELF-HOSTED MODE CHECK ─────────────────────────────────────────

/**
 * Check if this instance is running in self-hosted mode.
 * Reads SELFHOST_MODE environment variable.
 */
export function isSelfHosted(): boolean {
  return process.env.SELFHOST_MODE === "true"
}

// ─── ROUTE CONFIGURATION ────────────────────────────────────────────

/**
 * Routes that are ALLOWED in self-hosted mode.
 * Everything not matching these patterns will be blocked/redirected.
 */
export const SELFHOST_ALLOWED_PREFIXES = [
  "/dashboard",           // Full CMS dashboard
  "/login",               // Auth
  "/register",            // Auth (first-user setup)
  "/forgot-password",     // Auth
  "/reset-password",      // Auth
  "/api/auth",            // NextAuth endpoints
  "/api/tenant",          // Tenant/workspace management
  "/api/tenants",         // Tenant listing
  "/api/public",          // Public content API (for frontend consumers)
  "/api/enterprise",      // License management
  "/api/cron",            // Scheduled tasks
  "/api/health",          // Health check
  "/api/media",           // Media upload/download
  "/api/categories",      // Categories
  "/api/statuses",        // Statuses
  "/api/templates",       // Templates
  "/api/admin/seed-tenant", // Tenant seeding (setup wizard)
  "/api/admin/ai",        // AI features
  "/api/docs",            // API documentation
  "/api-docs",            // Swagger UI
  "/docs",                // Documentation pages
  "/_next",               // Next.js internals
  "/favicon.ico",         // Static assets
  "/logo",                // Logo assets
] as const

/**
 * Routes explicitly BLOCKED in self-hosted mode.
 * These are SaaS-specific features not needed for self-hosted.
 */
export const SELFHOST_BLOCKED_PREFIXES = [
  "/api/billing",         // SaaS billing/payment
  "/api/admin/enterprise/licenses", // License management (SaaS admin only)
  "/admin",               // Super admin panel (SaaS)
] as const

/**
 * Features disabled in self-hosted mode
 */
export const SELFHOST_DISABLED_FEATURES = [
  "saas_billing",         // Midtrans/Stripe payment processing
  "saas_admin_panel",     // Super admin panel
  "landing_page",         // Marketing landing page
  "plan_enforcement",     // Plan limits (everything is unlimited)
  "subscription_gate",    // Subscription expiry checks
] as const

export type SelfHostDisabledFeature = (typeof SELFHOST_DISABLED_FEATURES)[number]

// ─── FEATURE CHECKS ─────────────────────────────────────────────────

/**
 * Check if a specific feature is disabled in self-hosted mode
 */
export function isFeatureDisabled(feature: SelfHostDisabledFeature): boolean {
  if (!isSelfHosted()) return false
  return SELFHOST_DISABLED_FEATURES.includes(feature)
}

/**
 * Check if a route path is allowed in self-hosted mode
 */
export function isRouteAllowed(pathname: string): boolean {
  if (!isSelfHosted()) return true

  // Static files always allowed
  if (pathname.startsWith("/_next/") || pathname.includes(".")) return true

  // Check if explicitly blocked
  for (const blocked of SELFHOST_BLOCKED_PREFIXES) {
    if (pathname.startsWith(blocked)) return false
  }

  // Check if in allowed list
  for (const allowed of SELFHOST_ALLOWED_PREFIXES) {
    if (pathname.startsWith(allowed)) return true
  }

  // Root path — will be redirected to /dashboard
  if (pathname === "/") return true

  // Everything else is blocked
  return false
}

/**
 * Get the self-hosted configuration summary (for UI/debugging)
 */
export function getSelfHostConfig() {
  return {
    enabled: isSelfHosted(),
    allowedPrefixes: [...SELFHOST_ALLOWED_PREFIXES],
    blockedPrefixes: [...SELFHOST_BLOCKED_PREFIXES],
    disabledFeatures: [...SELFHOST_DISABLED_FEATURES],
  }
}
