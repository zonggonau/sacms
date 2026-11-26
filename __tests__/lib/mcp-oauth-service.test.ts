import { beforeEach, describe, expect, it, vi } from "vitest"
import { createHash } from "crypto"

const { db } = vi.hoisted(() => ({
  db: {
    oAuthClient: { create: vi.fn(), findUnique: vi.fn() },
    oAuthCode: { create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
    oAuthToken: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    apiToken: { create: vi.fn(), deleteMany: vi.fn() },
    tenantMember: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}))
vi.mock("@/lib/database", () => ({ db }))

import {
  createAuthorizationCode,
  dropConnectionsForAccessToken,
  exchangeAuthorizationCode,
  refreshConnection,
  registerClient,
} from "@/lib/mcp/oauth/service"

const sha = (v: string) => createHash("sha256").update(v).digest("hex")
const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
const redirect = "https://chatgpt.com/connector_platform_oauth_redirect"
const client = { clientId: "mcpc_client", name: "ChatGPT", redirectUris: [redirect] }

function storedCode(over: Record<string, unknown> = {}) {
  return {
    id: "code-row", code: sha("the-code"), clientId: "mcpc_client", tenantId: "tenant-1", userId: "user-1",
    redirectUri: redirect, codeChallenge: challenge, codeChallengeMethod: "S256",
    expiresAt: new Date(Date.now() + 60_000), ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.oAuthClient.findUnique.mockResolvedValue(client)
  db.oAuthClient.create.mockImplementation(async ({ data }: any) => ({ ...data, name: data.name }))
  db.oAuthCode.deleteMany.mockResolvedValue({ count: 1 })
  db.oAuthCode.findUnique.mockResolvedValue(storedCode())
  db.apiToken.create.mockImplementation(async ({ data }: any) => ({ id: `api-${Math.random().toString(36).slice(2, 8)}`, ...data }))
  db.tenantMember.findFirst.mockResolvedValue({ id: "m1" })
  db.user.findUnique.mockResolvedValue({ role: "user" })
  db.oAuthToken.create.mockResolvedValue({})
})

describe("registerClient (RFC 7591)", () => {
  it("creates a public client with a readable mcpc_ id and returns it", async () => {
    const res = await registerClient({ clientName: "Claude.ai", redirectUris: ["https://claude.ai/api/mcp/auth_callback"] })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.client_id).toMatch(/^mcpc_[0-9a-f]{32}$/)
    expect(res.value.token_endpoint_auth_method).toBe("none")
    expect(db.oAuthClient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: "Claude.ai", clientSecret: null }),
    })
  })

  it("refuses a plain-http, non-loopback redirect", async () => {
    const res = await registerClient({ clientName: "x", redirectUris: ["http://example.com/cb"] })
    expect(res).toMatchObject({ ok: false, error: "invalid_redirect_uri" })
    expect(db.oAuthClient.create).not.toHaveBeenCalled()
  })

  it("refuses an empty or oversized redirect list", async () => {
    expect(await registerClient({ redirectUris: [] })).toMatchObject({ ok: false })
    expect(await registerClient({ redirectUris: Array(11).fill(redirect) })).toMatchObject({ ok: false })
  })
})

describe("authorization code exchange", () => {
  it("issues an access token that is a 1-hour mcp token, plus a hashed refresh token", async () => {
    const res = await exchangeAuthorizationCode({ code: "the-code", clientId: "mcpc_client", redirectUri: redirect, codeVerifier: verifier })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.access_token).toMatch(/^mcp_[0-9a-f]{48}$/)
    expect(res.value.refresh_token).toMatch(/^mcpr_/)
    expect(res.value.expires_in).toBe(3600)

    const access = db.apiToken.create.mock.calls[0][0].data
    expect(access.type).toBe("mcp")
    expect(access.token).toBe(sha(res.value.access_token))
    expect(access.expiresAt.getTime() - Date.now()).toBeGreaterThan(59 * 60_000)
    expect(access.permissions).toContain("mcp")

    const refresh = db.oAuthToken.create.mock.calls[0][0].data
    expect(refresh.refreshTokenHash).toBe(sha(res.value.refresh_token))
    expect(refresh.refreshTokenHash).not.toBe(res.value.refresh_token)
  })

  it("consumes the code before checking it, so a replay finds nothing", async () => {
    db.oAuthCode.deleteMany.mockResolvedValueOnce({ count: 0 })
    const res = await exchangeAuthorizationCode({ code: "the-code", clientId: "mcpc_client", redirectUri: redirect, codeVerifier: verifier })
    expect(res).toMatchObject({ ok: false, error: "invalid_grant" })
    expect(db.apiToken.create).not.toHaveBeenCalled()
  })

  it("refuses an unknown code", async () => {
    db.oAuthCode.findUnique.mockResolvedValueOnce(null)
    expect(await exchangeAuthorizationCode({ code: "nope", clientId: "mcpc_client", redirectUri: redirect, codeVerifier: verifier }))
      .toMatchObject({ ok: false, error: "invalid_grant" })
  })

  it("refuses an expired code", async () => {
    db.oAuthCode.findUnique.mockResolvedValueOnce(storedCode({ expiresAt: new Date(Date.now() - 1000) }))
    expect(await exchangeAuthorizationCode({ code: "the-code", clientId: "mcpc_client", redirectUri: redirect, codeVerifier: verifier }))
      .toMatchObject({ ok: false, description: expect.stringMatching(/expired/) })
  })

  it("refuses the wrong PKCE verifier", async () => {
    const wrong = `${verifier.slice(0, 42)}Z`
    expect(await exchangeAuthorizationCode({ code: "the-code", clientId: "mcpc_client", redirectUri: redirect, codeVerifier: wrong }))
      .toMatchObject({ ok: false, error: "invalid_grant" })
    expect(db.apiToken.create).not.toHaveBeenCalled()
  })

  it("refuses a different redirect_uri than the one authorized", async () => {
    expect(await exchangeAuthorizationCode({ code: "the-code", clientId: "mcpc_client", redirectUri: "https://evil.example/cb", codeVerifier: verifier }))
      .toMatchObject({ ok: false, description: expect.stringMatching(/redirect_uri/) })
  })

  it("refuses a code issued to another client", async () => {
    expect(await exchangeAuthorizationCode({ code: "the-code", clientId: "mcpc_other", redirectUri: redirect, codeVerifier: verifier }))
      .toMatchObject({ ok: false, description: expect.stringMatching(/another client/) })
  })

  it("refuses when the approving user no longer manages the workspace", async () => {
    db.tenantMember.findFirst.mockResolvedValueOnce(null)
    db.user.findUnique.mockResolvedValueOnce({ role: "user" })
    expect(await exchangeAuthorizationCode({ code: "the-code", clientId: "mcpc_client", redirectUri: redirect, codeVerifier: verifier }))
      .toMatchObject({ ok: false, error: "access_denied" })
  })
})

describe("authorization code creation", () => {
  it("stores only the hash of the code and records the approving user", async () => {
    const code = await createAuthorizationCode({ clientId: "mcpc_client", userId: "user-1", tenantId: "tenant-1", redirectUri: redirect, codeChallenge: challenge })
    const row = db.oAuthCode.create.mock.calls[0][0].data
    expect(code).toMatch(/^mcpa_/)
    expect(row.code).toBe(sha(code))
    expect(row.userId).toBe("user-1")
    expect(row.codeChallengeMethod).toBe("S256")
  })
})

describe("refresh token rotation", () => {
  const refreshRow = (over: Record<string, unknown> = {}) => ({
    id: "conn-1", refreshTokenHash: sha("old-refresh"), clientId: "mcpc_client", tenantId: "tenant-1",
    userId: "user-1", accessTokenId: "api-old", expiresAt: new Date(Date.now() + 86_400_000), ...over,
  })

  it("rotates: swaps the refresh hash atomically and removes the old access token", async () => {
    db.oAuthToken.findFirst.mockResolvedValue(refreshRow())
    db.oAuthToken.updateMany.mockResolvedValue({ count: 1 })
    const res = await refreshConnection({ refreshToken: "old-refresh", clientId: "mcpc_client" })
    expect(res.ok).toBe(true)
    expect(db.oAuthToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "conn-1", refreshTokenHash: sha("old-refresh") },
    }))
    expect(db.apiToken.deleteMany).toHaveBeenCalledWith({ where: { id: "api-old", type: "mcp" } })
  })

  it("treats a lost swap as reuse: the connection is revoked and the request fails", async () => {
    db.oAuthToken.findFirst.mockResolvedValue(refreshRow())
    db.oAuthToken.updateMany.mockResolvedValue({ count: 0 })
    const res = await refreshConnection({ refreshToken: "old-refresh", clientId: "mcpc_client" })
    expect(res).toMatchObject({ ok: false, error: "invalid_grant", description: expect.stringMatching(/already used/) })
    expect(db.oAuthToken.deleteMany).toHaveBeenCalledWith({ where: { id: "conn-1" } })
  })

  it("refuses an unknown refresh token", async () => {
    db.oAuthToken.findFirst.mockResolvedValue(null)
    expect(await refreshConnection({ refreshToken: "nope", clientId: "mcpc_client" })).toMatchObject({ ok: false, error: "invalid_grant" })
  })

  it("refuses a refresh token presented by a different client", async () => {
    db.oAuthToken.findFirst.mockResolvedValue(refreshRow({ clientId: "mcpc_other" }))
    expect(await refreshConnection({ refreshToken: "old-refresh", clientId: "mcpc_client" })).toMatchObject({ ok: false })
    expect(db.oAuthToken.updateMany).not.toHaveBeenCalled()
  })

  it("revokes an expired connection instead of renewing it", async () => {
    db.oAuthToken.findFirst.mockResolvedValue(refreshRow({ expiresAt: new Date(Date.now() - 1000) }))
    expect(await refreshConnection({ refreshToken: "old-refresh", clientId: "mcpc_client" })).toMatchObject({ ok: false })
    expect(db.oAuthToken.deleteMany).toHaveBeenCalledWith({ where: { id: "conn-1" } })
    expect(db.oAuthToken.updateMany).not.toHaveBeenCalled()
  })
})

describe("revocation hook", () => {
  it("drops the connection whose access token a user deletes or rotates", async () => {
    await dropConnectionsForAccessToken("api-123")
    expect(db.oAuthToken.deleteMany).toHaveBeenCalledWith({ where: { accessTokenId: "api-123" } })
  })
})
