/**
 * Shared entry guard for the headless member-auth endpoints
 * (`/api/public/[tenant]/auth/*`).
 *
 * Every credential-touching endpoint funnels through ONE rate-limit bucket per
 * `(tenant, ip)` so an attacker cannot dodge the limit by rotating between
 * `login`, `local`, `register`, `forgot-password` and `reset-password`. A tighter
 * per-endpoint sub-bucket is layered on top for the noisier operations.
 */

import { db } from "@/lib/database"
import { rateLimit } from "@/lib/rate-limit"
import { getClientIp } from "@/lib/client-ip"
import { authCorsHeaders } from "@/lib/member-auth-cors"

export interface MemberAuthTenant {
  id: string
  slug: string
  status: string
  name: string | null
  brandName: string | null
  customEmailSender: string | null
  requireMemberEmailVerification: boolean
  memberEmailConfirmationRedirect: string | null
  memberPasswordResetRedirect: string | null
}

export interface MemberAuthContext {
  tenant: MemberAuthTenant
  ip: string
  /** CORS headers to attach to every response from this endpoint. */
  cors: Record<string, string>
}

type GuardOptions = {
  /** Per-endpoint identifier, e.g. "login" | "register" | "forgot". */
  endpoint: string
  /** Per-endpoint limit within `windowSeconds`. */
  limit: number
  windowSeconds: number
  /**
   * When true, a missing / inactive tenant resolves to `null` tenant instead of
   * an error result (used by endpoints that must not leak tenant existence).
   */
  allowUnknownTenant?: boolean
}

export type GuardResult =
  | { ok: true; ctx: MemberAuthContext }
  | { ok: true; ctx: { tenant: null; ip: string; cors: Record<string, string> } } // only when allowUnknownTenant
  | { ok: false; status: number; error: string; retryAfterSeconds?: number; cors: Record<string, string> }

// Shared cross-endpoint budget: 20 credential attempts per 5 min per (tenant, ip).
const SHARED_LIMIT = 20
const SHARED_WINDOW_SECONDS = 300

export async function guardMemberAuth(
  request: Request,
  tenantParam: string,
  opts: GuardOptions,
): Promise<GuardResult> {
  const ip = getClientIp(request)

  const tenant = await db.tenant.findFirst({
    where: { OR: [{ slug: tenantParam }, { id: tenantParam }] },
    select: {
      id: true, slug: true, status: true, customDomain: true, allowedAuthOrigins: true,
      name: true, brandName: true, customEmailSender: true,
      requireMemberEmailVerification: true,
      memberEmailConfirmationRedirect: true, memberPasswordResetRedirect: true,
    },
  })

  const cors = authCorsHeaders(
    request,
    tenant ? { slug: tenant.slug, customDomain: tenant.customDomain, allowedAuthOrigins: tenant.allowedAuthOrigins } : null,
  )

  const tenantKeyPart = tenant?.id ?? `unknown:${tenantParam}`

  // 1. Shared cross-endpoint bucket.
  const shared = await rateLimit(`member-auth:${tenantKeyPart}:${ip}`, {
    limit: SHARED_LIMIT,
    windowSeconds: SHARED_WINDOW_SECONDS,
  })
  if (!shared.success) {
    return {
      ok: false,
      status: 429,
      error: "Too many authentication attempts. Please try again later.",
      retryAfterSeconds: Math.ceil((shared.resetAt - Date.now()) / 1000),
      cors,
    }
  }

  // 2. Tighter per-endpoint bucket.
  const perEndpoint = await rateLimit(`member-auth:${opts.endpoint}:${tenantKeyPart}:${ip}`, {
    limit: opts.limit,
    windowSeconds: opts.windowSeconds,
  })
  if (!perEndpoint.success) {
    return {
      ok: false,
      status: 429,
      error: "Too many attempts for this action. Please wait a moment.",
      retryAfterSeconds: Math.ceil((perEndpoint.resetAt - Date.now()) / 1000),
      cors,
    }
  }

  if (!tenant || tenant.status !== "active") {
    if (opts.allowUnknownTenant) {
      return { ok: true, ctx: { tenant: null, ip, cors } }
    }
    return { ok: false, status: 404, error: "Tenant not found or inactive", cors }
  }

  return {
    ok: true,
    ctx: {
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        status: tenant.status,
        name: tenant.name,
        brandName: tenant.brandName,
        customEmailSender: tenant.customEmailSender,
        requireMemberEmailVerification: tenant.requireMemberEmailVerification,
        memberEmailConfirmationRedirect: tenant.memberEmailConfirmationRedirect,
        memberPasswordResetRedirect: tenant.memberPasswordResetRedirect,
      },
      ip,
      cors,
    },
  }
}
