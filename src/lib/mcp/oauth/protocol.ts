// OAuth 2.1 protocol helpers for the per-workspace MCP server. Pure functions
// only: metadata documents, redirect-URI rules, PKCE, and secret generation.
// Database work lives in service.ts.
//
// Standards implemented:
//   RFC 9728  OAuth Protected Resource Metadata (what the MCP 401 points at)
//   RFC 8414  Authorization Server Metadata
//   RFC 7591  Dynamic Client Registration
//   RFC 7636  PKCE (S256 only)
//   RFC 8707  `resource` indicator (must name this MCP server if sent)

import { createHash, randomBytes, timingSafeEqual } from "crypto"

export const MCP_OAUTH_SCOPE = "mcp"
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60 // 1 hour; refreshed via refresh_token
export const REFRESH_TOKEN_TTL_DAYS = 30
export const AUTH_CODE_TTL_SECONDS = 10 * 60

/** Public origin of this deployment, without a trailing slash. */
export function publicOrigin(requestOrigin?: string): string {
  const configured = process.env.NEXTAUTH_URL?.trim()
  const origin = configured && /^https?:\/\//.test(configured) ? configured : requestOrigin || "http://localhost:3000"
  return origin.replace(/\/+$/, "")
}

/** The protected resource: the per-workspace MCP endpoint itself. */
export function mcpResource(origin: string): string {
  return `${origin}/api/mcp`
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: mcpResource(origin),
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: [MCP_OAUTH_SCOPE],
    resource_name: "SaCMS Workspace MCP",
  }
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [MCP_OAUTH_SCOPE],
  }
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

/**
 * A redirect URI may be https on any host (ChatGPT, Grok, and Claude.ai use
 * their own https callbacks), or http only for a loopback address (local
 * desktop tools). No fragments, no userinfo.
 */
export function isAllowedRedirectUri(uri: string): boolean {
  let url: URL
  try {
    url = new URL(uri)
  } catch {
    return false
  }
  if (url.hash || url.username || url.password) return false
  if (url.protocol === "https:") return true
  return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname)
}

const VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/

/** RFC 7636 S256: challenge = BASE64URL(SHA256(verifier)). Constant-time compare. */
export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  if (!VERIFIER_PATTERN.test(codeVerifier)) return false
  const computed = createHash("sha256").update(codeVerifier).digest("base64url")
  const a = Buffer.from(computed)
  const b = Buffer.from(codeChallenge)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function isValidCodeChallenge(challenge: string): boolean {
  // A S256 challenge is 43 base64url characters.
  return /^[A-Za-z0-9\-_]{43}$/.test(challenge)
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

/** Random opaque secret with a readable prefix, e.g. `mcpc_…`. */
export function randomSecret(prefix: string, bytes = 24): string {
  return `${prefix}${randomBytes(bytes).toString("hex")}`
}

/** Build a token response in the shape RFC 6749 section 5.1 requires. */
export function tokenResponse(accessToken: string, refreshToken: string) {
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: MCP_OAUTH_SCOPE,
  }
}

/** RFC 6749 section 5.2 error body. */
export function oauthError(error: string, description: string) {
  return { error, error_description: description }
}
