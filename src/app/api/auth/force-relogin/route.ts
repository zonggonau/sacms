import { NextRequest, NextResponse } from "next/server"

/**
 * Clears the NextAuth session cookie and sends the browser to /auth/login.
 *
 * NextAuth's JWT strategy never re-checks the DB after the initial sign-in —
 * `session.user.id` is whatever was baked into the token at login and stays
 * valid (cryptographically) even if that user row is later deleted, or a
 * local dev DB gets reset while a browser still holds an old signed cookie.
 * A page that uses `session.user.id` as a foreign key (e.g. auto-creating a
 * Tenant with that id as `ownerId`) then crashes with a raw FK violation
 * instead of asking for a fresh sign-in.
 *
 * A plain `redirect("/auth/login")` from a Server Component isn't enough to
 * fix that on its own: the stale cookie is still cryptographically valid, so
 * `/auth/login`'s own "already authenticated" check would immediately bounce
 * the browser right back — an infinite loop. Cookies can only be mutated
 * from a Server Action or Route Handler, not a plain Server Component, which
 * is why this lives here instead of inline in the page that detects it.
 */
export async function GET(request: NextRequest) {
  const redirectTo = request.nextUrl.searchParams.get("redirect_to") || "/"
  const response = NextResponse.redirect(
    new URL(`/auth/login?redirect_to=${encodeURIComponent(redirectTo)}`, request.url)
  )
  response.cookies.delete("next-auth.session-token")
  response.cookies.delete("__Secure-next-auth.session-token")
  return response
}
