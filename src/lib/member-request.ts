import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { verifyMemberAccessToken } from "@/lib/member-auth"
import { authCorsHeaders } from "@/lib/member-auth-cors"

/**
 * Resolve a member Bearer token and confirm it was issued for the tenant in the
 * URL. Returns per-tenant CORS headers plus the verified payload, or a ready
 * error `Response`.
 *
 * Use in the hand-rolled member endpoints (auth/me, change-password, users/me)
 * that bypass guardMemberAuth — closes the missing `payload.tenantId === tenant`
 * check and replaces `Access-Control-Allow-Origin: *`.
 */
export async function resolveMemberRequest(
  request: Request,
  tenantParam: string,
): Promise<
  | { ok: true; cors: Record<string, string>; tenant: { id: string; slug: string }; payload: NonNullable<ReturnType<typeof verifyMemberAccessToken>> }
  | { ok: false; response: Response }
> {
  const tenant = await db.tenant.findFirst({
    where: { OR: [{ slug: tenantParam }, { id: tenantParam }] },
    select: { id: true, slug: true, status: true, customDomain: true, allowedAuthOrigins: true },
  })

  const cors = authCorsHeaders(
    request,
    tenant ? { slug: tenant.slug, customDomain: tenant.customDomain, allowedAuthOrigins: tenant.allowedAuthOrigins } : null,
  )

  if (!tenant || tenant.status !== "active") {
    return { ok: false, response: NextResponse.json({ error: "Tenant not found" }, { status: 404, headers: cors }) }
  }

  const authHeader = request.headers.get("authorization") ?? ""
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, response: NextResponse.json({ error: "Missing or invalid Bearer token" }, { status: 401, headers: cors }) }
  }

  const payload = verifyMemberAccessToken(authHeader.slice(7).trim())
  if (!payload) {
    return { ok: false, response: NextResponse.json({ error: "Invalid or expired access token" }, { status: 401, headers: cors }) }
  }
  if (payload.tenantId !== tenant.id) {
    return { ok: false, response: NextResponse.json({ error: "Token does not belong to this workspace" }, { status: 403, headers: cors }) }
  }

  return { ok: true, cors, tenant: { id: tenant.id, slug: tenant.slug }, payload }
}
