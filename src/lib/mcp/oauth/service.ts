// OAuth 2.1 persistence for the per-workspace MCP server.
//
// A "connection" is one authorized client (ChatGPT, Grok, Claude.ai, …) for one
// workspace. It has one row in oauth_tokens (the refresh token, hashed) and one
// current access token, which is an ordinary `mcp` api_tokens row. Because the
// access token is a normal MCP token, the MCP route checks it exactly like the
// manual tokens on /developer/mcp, and deleting it there disconnects the client.

import { db } from "@/lib/database"
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTH_CODE_TTL_SECONDS,
  REFRESH_TOKEN_TTL_DAYS,
  isAllowedRedirectUri,
  randomSecret,
  sha256Hex,
  tokenResponse,
  verifyPkce,
} from "./protocol"

/** Same permission set the manual MCP tokens on /developer/mcp get. */
export const MCP_TOKEN_PERMISSIONS = ["read", "write", "delete", "schema", "webhooks", "mcp"]

export type OAuthResult<T> = { ok: true; value: T } | { ok: false; error: string; description: string }

function fail(error: string, description: string): { ok: false; error: string; description: string } {
  return { ok: false, error, description }
}

// ─── Dynamic client registration (RFC 7591) ─────────────────────────────────

export async function registerClient(input: { clientName?: unknown; redirectUris?: unknown }): Promise<OAuthResult<{
  client_id: string
  client_name: string
  redirect_uris: string[]
  token_endpoint_auth_method: "none"
  grant_types: string[]
  response_types: string[]
}>> {
  const name = typeof input.clientName === "string" && input.clientName.trim() ? input.clientName.trim().slice(0, 100) : "MCP client"
  if (!Array.isArray(input.redirectUris) || input.redirectUris.length === 0 || input.redirectUris.length > 10) {
    return fail("invalid_redirect_uri", "redirect_uris must list between 1 and 10 URIs.")
  }
  const redirectUris = input.redirectUris as unknown[]
  if (!redirectUris.every((u): u is string => typeof u === "string" && isAllowedRedirectUri(u))) {
    return fail("invalid_redirect_uri", "Each redirect URI must be https, or http on localhost, with no fragment.")
  }
  const clientId = randomSecret("mcpc_", 16)
  const client = await db.oAuthClient.create({
    data: { clientId, name, redirectUris: redirectUris as string[], clientSecret: null },
  })
  return {
    ok: true,
    value: {
      client_id: client.clientId,
      client_name: client.name,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
  }
}

export async function findClient(clientId: string) {
  if (!clientId) return null
  return db.oAuthClient.findUnique({ where: { clientId } })
}

// ─── Authorization codes ────────────────────────────────────────────────────

/** Issues a single-use code for a user who approved this client for one workspace. */
export async function createAuthorizationCode(input: {
  clientId: string
  userId: string
  tenantId: string
  redirectUri: string
  codeChallenge: string
}): Promise<string> {
  const code = randomSecret("mcpa_", 24)
  await db.oAuthCode.create({
    data: {
      code: sha256Hex(code),
      clientId: input.clientId,
      tenantId: input.tenantId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: "S256",
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000),
    },
  })
  return code
}

/** Exchanges an authorization code for tokens. The code is consumed even when a check fails. */
export async function exchangeAuthorizationCode(input: {
  code: string
  clientId: string
  redirectUri: string
  codeVerifier: string
}): Promise<OAuthResult<ReturnType<typeof tokenResponse>>> {
  const row = await db.oAuthCode.findUnique({ where: { code: sha256Hex(input.code) } })
  if (!row) return fail("invalid_grant", "The authorization code is unknown or was already used.")

  // Single use: delete first, then check. A replayed code finds nothing here.
  const consumed = await db.oAuthCode.deleteMany({ where: { id: row.id } })
  if (consumed.count !== 1) return fail("invalid_grant", "The authorization code was already used.")

  if (row.expiresAt.getTime() <= Date.now()) return fail("invalid_grant", "The authorization code has expired.")
  if (row.clientId !== input.clientId) return fail("invalid_grant", "The authorization code was issued to another client.")
  if (row.redirectUri !== input.redirectUri) return fail("invalid_grant", "redirect_uri does not match the authorization request.")
  if (!row.codeChallenge || !verifyPkce(input.codeVerifier, row.codeChallenge)) {
    return fail("invalid_grant", "PKCE code_verifier does not match the code_challenge.")
  }

  // The approval is only good while the approving user still manages this workspace.
  const allowed = await canManageWorkspace(row.userId, row.tenantId)
  if (!allowed) return fail("access_denied", "The approving user no longer manages this workspace.")

  const client = await findClient(input.clientId)
  const connection = await createConnection({
    clientId: input.clientId,
    clientName: client?.name ?? "MCP client",
    userId: row.userId,
    tenantId: row.tenantId,
  })
  return { ok: true, value: connection }
}

// ─── Connections: access token + refresh token ──────────────────────────────

async function mintAccessToken(input: { tenantId: string; userId: string; clientName: string }) {
  const token = randomSecret("mcp_", 24)
  const row = await db.apiToken.create({
    data: {
      tenantId: input.tenantId,
      name: `OAuth · ${input.clientName}`.slice(0, 100),
      description: "Connected through OAuth (ChatGPT, Grok, Claude.ai, or another MCP client)",
      token: sha256Hex(token),
      type: "mcp",
      permissions: MCP_TOKEN_PERMISSIONS,
      createdBy: input.userId,
      expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000),
    },
  })
  return { token, id: row.id }
}

async function createConnection(input: { clientId: string; clientName: string; userId: string; tenantId: string }) {
  const access = await mintAccessToken({ tenantId: input.tenantId, userId: input.userId, clientName: input.clientName })
  const refresh = randomSecret("mcpr_", 32)
  await db.oAuthToken.create({
    data: {
      refreshTokenHash: sha256Hex(refresh),
      clientId: input.clientId,
      tenantId: input.tenantId,
      userId: input.userId,
      accessTokenId: access.id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  })
  return tokenResponse(access.token, refresh)
}

/**
 * Rotates a refresh token. The new refresh token replaces the old one with a
 * compare-and-swap, so presenting an already-rotated token is detected as reuse:
 * the whole connection is then revoked, since the old token may have leaked.
 */
export async function refreshConnection(input: { refreshToken: string; clientId: string }): Promise<OAuthResult<ReturnType<typeof tokenResponse>>> {
  const presentedHash = sha256Hex(input.refreshToken)
  const row = await db.oAuthToken.findFirst({ where: { refreshTokenHash: presentedHash } })
  if (!row || row.clientId !== input.clientId) {
    return fail("invalid_grant", "The refresh token is invalid.")
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    await revokeConnection(row.id, row.accessTokenId)
    return fail("invalid_grant", "The refresh token has expired.")
  }

  if (!(await canManageWorkspace(row.userId, row.tenantId))) {
    await revokeConnection(row.id, row.accessTokenId)
    return fail("access_denied", "The user no longer manages this workspace.")
  }

  const client = await findClient(input.clientId)
  const access = await mintAccessToken({ tenantId: row.tenantId, userId: row.userId, clientName: client?.name ?? "MCP client" })
  const refresh = randomSecret("mcpr_", 32)
  const swapped = await db.oAuthToken.updateMany({
    where: { id: row.id, refreshTokenHash: presentedHash },
    data: {
      refreshTokenHash: sha256Hex(refresh),
      accessTokenId: access.id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  })
  if (swapped.count !== 1) {
    // Someone else already rotated this token: treat it as reuse.
    await db.apiToken.deleteMany({ where: { id: access.id } })
    await revokeConnection(row.id, row.accessTokenId)
    return fail("invalid_grant", "The refresh token was already used. The connection has been revoked.")
  }

  if (row.accessTokenId) await db.apiToken.deleteMany({ where: { id: row.accessTokenId, type: "mcp" } })
  return { ok: true, value: tokenResponse(access.token, refresh) }
}

/** Removes a connection and its current access token. Used on reuse, expiry, or user revocation. */
export async function revokeConnection(connectionId: string, accessTokenId: string | null) {
  await db.oAuthToken.deleteMany({ where: { id: connectionId } })
  if (accessTokenId) await db.apiToken.deleteMany({ where: { id: accessTokenId, type: "mcp" } })
}

/**
 * Called by the MCP token actions when a user deletes or rotates a token. A
 * connection whose access token is removed here must not come back through its
 * refresh token, so its row goes too.
 */
export async function dropConnectionsForAccessToken(accessTokenId: string) {
  await db.oAuthToken.deleteMany({ where: { accessTokenId } })
}

// ─── Authorization rules ────────────────────────────────────────────────────

/** Owners and admins of a workspace may connect it; super admins follow the same rule as the dashboard. */
export async function canManageWorkspace(userId: string, tenantId: string): Promise<boolean> {
  const member = await db.tenantMember.findFirst({
    where: { tenantId, userId, role: { in: ["owner", "admin"] } },
    select: { id: true },
  })
  if (member) return true
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } })
  return user?.role === "super_admin"
}
