/**
 * Route factories + a standard response envelope for the JSON API.
 *
 * Before this module, 132 routes called `getServerSession` inline, 54 then
 * called `getTenantAccess`, and the 401/403/500 bodies had 10+ different shapes.
 * These wrappers collapse the auth boilerplate to one line per route and give
 * every response the same envelope.
 *
 * Envelope
 * --------
 * Success is whatever the handler returns (usually `NextResponse.json(payload)`).
 * Failure is always:  `{ error: <human message>, code: <machine slug> }`
 * `error` stays a plain string for backwards compatibility with ~356 existing
 * client reads of `.error`; `code` is the new machine-readable discriminant.
 *
 * Usage
 * -----
 *   export const POST = withStaffAuth(async (req, ctx, { access, session }) => {
 *     const body = await readJson(req, MySchema)
 *     if (!body.ok) return body.response
 *     …
 *     return NextResponse.json({ data })
 *   }, { minRole: "editor", planResource: "content_entries" })
 */

import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import type { WorkspaceResource } from "@/lib/plan-enforcement"

/** Best-effort route path for logs, tolerant of a plain Request in tests. */
function routePath(request: NextRequest): string {
  try {
    return request.nextUrl?.pathname ?? new URL(request.url).pathname
  } catch {
    return "unknown"
  }
}

// ── Error envelope ───────────────────────────────────────────────────────

export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation"
  | "conflict"
  | "rate_limited"
  | "plan_limit"
  | "internal"

const DEFAULT_STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation: 400,
  conflict: 409,
  rate_limited: 429,
  // Historically plan-limit denials returned 403; keep that so existing clients
  // that branch on the status don't regress.
  plan_limit: 403,
  internal: 500,
}

const DEFAULT_MESSAGE: Record<ApiErrorCode, string> = {
  unauthorized: "You must be signed in to do that",
  forbidden: "You do not have permission to do that",
  not_found: "Not found",
  validation: "The request was invalid",
  conflict: "That conflicts with something that already exists",
  rate_limited: "Too many requests — slow down",
  plan_limit: "Your plan's limit for this has been reached",
  internal: "Something went wrong on our end",
}

interface ApiErrorOptions {
  message?: string
  status?: number
  /** Extra machine-readable context (field errors, limits). Never a stack. */
  details?: Record<string, unknown>
  headers?: HeadersInit
}

/** Build a standard error response. */
export function apiError(code: ApiErrorCode, opts: ApiErrorOptions = {}): NextResponse {
  const body: Record<string, unknown> = {
    error: opts.message ?? DEFAULT_MESSAGE[code],
    code,
  }
  if (opts.details) body.details = opts.details
  return NextResponse.json(body, { status: opts.status ?? DEFAULT_STATUS[code], headers: opts.headers })
}

/**
 * Log the real error and return a generic 500. Never leaks `error.message`,
 * Prisma constraint text, or a stack to the client.
 */
export function handleRouteError(error: unknown, context?: { route?: string; method?: string }): NextResponse {
  const tag = context?.route ? `[${context.method ?? "?"} ${context.route}]` : "[api]"
  console.error(`${tag} unhandled error:`, error)
  // Sentry (configured in sentry.*.config.ts) auto-captures uncaught errors;
  // report explicitly here so a caught-and-swallowed 500 is still visible.
  import("@sentry/nextjs")
    .then((Sentry) => Sentry.captureException(error, { tags: { route: context?.route ?? "unknown" } }))
    .catch(() => {})
  return apiError("internal")
}

// ── Body parsing ─────────────────────────────────────────────────────────

export type ParsedBody<T> = { ok: true; data: T } | { ok: false; response: NextResponse }

/** Parse + validate a JSON body against a Zod schema, or return a 400 response. */
export async function readJson<S extends z.ZodTypeAny>(
  request: NextRequest,
  schema: S,
): Promise<ParsedBody<z.infer<S>>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return { ok: false, response: apiError("validation", { message: "Request body must be valid JSON" }) }
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      response: apiError("validation", {
        message: "One or more fields are invalid",
        details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
      }),
    }
  }
  return { ok: true, data: parsed.data }
}

// ── Auth context ─────────────────────────────────────────────────────────

export interface StaffContext {
  session: Session
  access: NonNullable<Awaited<ReturnType<typeof getTenantAccess>>>
}

export interface AdminContext {
  session: Session
}

type RouteContext = { params: Promise<Record<string, string>> }

/** Staff role ordering for `minRole`. Higher index = more authority. */
const STAFF_ROLE_RANK = ["viewer", "contributor", "author", "editor", "admin", "owner"] as const
type StaffRole = (typeof STAFF_ROLE_RANK)[number]

function roleMeets(role: string, min: StaffRole): boolean {
  const have = STAFF_ROLE_RANK.indexOf(role as StaffRole)
  const need = STAFF_ROLE_RANK.indexOf(min)
  // Unknown roles (e.g. custom) are treated as meeting the bar only when no
  // minimum is required — callers that pass `minRole` opt into strictness.
  if (have === -1) return false
  return have >= need
}

interface StaffAuthOptions {
  /** Minimum staff role required (owner > admin > editor > author > contributor > viewer). */
  minRole?: StaffRole
  /** Enforce this plan resource's limit on POST/PUT/PATCH. */
  planResource?: WorkspaceResource
}

/**
 * Wrap a route handler for `/api/tenant/[tenant]/…`. Resolves the session and
 * the caller's tenant access, optionally checks a minimum role and a plan limit,
 * and routes any thrown error through `handleRouteError`.
 *
 * The `[tenant]` param is read from `context.params`.
 */
export function withStaffAuth(
  handler: (request: NextRequest, context: RouteContext, ctx: StaffContext) => Promise<Response> | Response,
  options: StaffAuthOptions = {},
) {
  return async (request: NextRequest, context: RouteContext): Promise<Response> => {
    const routeInfo = { route: routePath(request), method: request.method }
    try {
      const session = await getServerSession(authOptions)
      if (!session?.user) return apiError("unauthorized")

      const params = await context.params
      const tenantParam = params.tenant
      if (!tenantParam) return apiError("validation", { message: "Missing tenant in the route" })

      const access = await getTenantAccess(session, tenantParam)
      if (!access) return apiError("forbidden", { message: "You are not a member of this workspace" })

      if (options.minRole && !roleMeets(access.role, options.minRole)) {
        return apiError("forbidden", { message: `This action requires the ${options.minRole} role or higher` })
      }

      if (options.planResource && ["POST", "PUT", "PATCH"].includes(request.method)) {
        const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
        const enforcement = await enforcePlanLimit(access.tenantId, options.planResource, access.userId)
        if (!enforcement.allowed) {
          return apiError("plan_limit", {
            message: enforcement.message ?? DEFAULT_MESSAGE.plan_limit,
            details: { current: enforcement.current, max: enforcement.max, plan: enforcement.planSlug },
          })
        }
      }

      return await handler(request, context, { session, access })
    } catch (error) {
      return handleRouteError(error, routeInfo)
    }
  }
}

interface AdminAuthOptions {
  /**
   * Platform roles allowed in addition to `super_admin`. A few admin-portal
   * routes (billing reports, user management) also admit a plain `admin`.
   */
  allowRoles?: readonly string[]
}

/**
 * Wrap a route handler for `/api/admin/…`. Requires a `super_admin` session
 * (plus any role in `options.allowRoles`).
 */
export function withAdminAuth(
  handler: (request: NextRequest, context: RouteContext, ctx: AdminContext) => Promise<Response> | Response,
  options: AdminAuthOptions = {},
) {
  const allowed = new Set<string>(["super_admin", ...(options.allowRoles ?? [])])
  return async (request: NextRequest, context: RouteContext): Promise<Response> => {
    const routeInfo = { route: routePath(request), method: request.method }
    try {
      const session = await getServerSession(authOptions)
      if (!session?.user) return apiError("unauthorized")
      if (!allowed.has(session.user.role)) {
        return apiError("forbidden", {
          message: allowed.size > 1 ? "Admin access required" : "Super admin access required",
        })
      }
      return await handler(request, context, { session })
    } catch (error) {
      return handleRouteError(error, routeInfo)
    }
  }
}
