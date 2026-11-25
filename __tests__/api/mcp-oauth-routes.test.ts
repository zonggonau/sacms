import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ success: true })) }))

const { db } = vi.hoisted(() => ({
  db: {
    oAuthClient: { create: vi.fn(), findUnique: vi.fn() },
    oAuthCode: { create: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
    oAuthToken: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    apiToken: { create: vi.fn(), deleteMany: vi.fn() },
    tenantMember: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}))
vi.mock("@/lib/database", () => ({ db }))

import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { POST as grant } from "@/app/api/oauth/grant/route"
import { POST as token } from "@/app/api/oauth/token/route"
import { POST as register } from "@/app/api/oauth/register/route"
import { GET as wellKnown } from "@/app/api/oauth/well-known/[...path]/route"

const ORIGIN = "https://sacms.cloud"
const REDIRECT = "https://chatgpt.com/connector_platform_oauth_redirect"
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

const jsonReq = (body: unknown) => new Request(`${ORIGIN}/api/oauth/grant`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
})
const formReq = (params: Record<string, string>) => new Request(`${ORIGIN}/api/oauth/token`, {
  method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params).toString(),
})
const grantBody = (over: Record<string, unknown> = {}) => ({
  client_id: "mcpc_client", redirect_uri: REDIRECT, state: "xyz", code_challenge: CHALLENGE,
  code_challenge_method: "S256", resource: `${ORIGIN}/api/mcp`, tenant_slug: "acme", decision: "approve", ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXTAUTH_URL = ORIGIN
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-1", role: "user" } } as any)
  vi.mocked(getTenantAccess).mockResolvedValue({ tenantId: "tenant-1", role: "owner" } as any)
  db.oAuthClient.findUnique.mockResolvedValue({ clientId: "mcpc_client", name: "ChatGPT", redirectUris: [REDIRECT] })
  db.oAuthCode.create.mockResolvedValue({})
})

describe("POST /api/oauth/grant (consent)", () => {
  it("requires a signed-in user", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null)
    expect((await grant(jsonReq(grantBody()))).status).toBe(401)
  })

  it("never redirects to a URI the client did not register", async () => {
    const res = await grant(jsonReq(grantBody({ redirect_uri: "https://evil.example/cb" })))
    expect(res.status).toBe(400)
    expect(await res.json()).not.toHaveProperty("redirect")
  })

  it("refuses a resource that names another server", async () => {
    expect((await grant(jsonReq(grantBody({ resource: "https://other.example/mcp" })))).status).toBe(400)
  })

  it("returns an access_denied redirect when the user declines, keeping state", async () => {
    const body = await (await grant(jsonReq(grantBody({ decision: "deny" })))).json()
    const url = new URL(body.redirect)
    expect(url.origin + url.pathname).toBe(REDIRECT)
    expect(url.searchParams.get("error")).toBe("access_denied")
    expect(url.searchParams.get("state")).toBe("xyz")
    expect(db.oAuthCode.create).not.toHaveBeenCalled()
  })

  it("refuses approval from a plain member of the workspace", async () => {
    vi.mocked(getTenantAccess).mockResolvedValueOnce({ tenantId: "tenant-1", role: "member" } as any)
    expect((await grant(jsonReq(grantBody()))).status).toBe(403)
    expect(db.oAuthCode.create).not.toHaveBeenCalled()
  })

  it("issues a code bound to the chosen workspace and returns it with state", async () => {
    const body = await (await grant(jsonReq(grantBody()))).json()
    const url = new URL(body.redirect)
    expect(url.searchParams.get("code")).toMatch(/^mcpa_/)
    expect(url.searchParams.get("state")).toBe("xyz")
    expect(db.oAuthCode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "tenant-1", userId: "user-1", codeChallengeMethod: "S256", redirectUri: REDIRECT }),
    })
  })

  it("sends a PKCE-less request back to the client as invalid_request, not as a code", async () => {
    const body = await (await grant(jsonReq(grantBody({ code_challenge_method: "plain" })))).json()
    expect(new URL(body.redirect).searchParams.get("error")).toBe("invalid_request")
    expect(db.oAuthCode.create).not.toHaveBeenCalled()
  })
})

describe("POST /api/oauth/token", () => {
  it("rejects a missing field with invalid_request", async () => {
    const res = await token(formReq({ grant_type: "authorization_code", code: "x" }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "invalid_request" })
  })

  it("rejects an unsupported grant type", async () => {
    const res = await token(formReq({ grant_type: "password", client_id: "c" }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "unsupported_grant_type" })
  })

  it("never caches credentials", async () => {
    const res = await token(formReq({ grant_type: "refresh_token", refresh_token: "r", client_id: "c" }))
    expect(res.headers.get("Cache-Control")).toBe("no-store")
  })
})

describe("POST /api/oauth/register", () => {
  it("registers a public client and returns 201 with its id", async () => {
    db.oAuthClient.create.mockImplementation(async ({ data }: any) => data)
    const res = await register(new Request(`${ORIGIN}/api/oauth/register`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_name: "Grok", redirect_uris: [REDIRECT] }),
    }))
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ client_id: expect.stringMatching(/^mcpc_/), token_endpoint_auth_method: "none" })
  })

  it("rejects a redirect URI that is plain http on a public host", async () => {
    const res = await register(new Request(`${ORIGIN}/api/oauth/register`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redirect_uris: ["http://example.com/cb"] }),
    }))
    expect(res.status).toBe(400)
  })
})

describe("GET /.well-known/* (served through the rewrite)", () => {
  const get = (path: string[]) => wellKnown(new Request(`${ORIGIN}/.well-known/x`), { params: Promise.resolve({ path }) })

  it("serves protected-resource metadata with and without the resource suffix", async () => {
    for (const path of [["oauth-protected-resource"], ["oauth-protected-resource", "api", "mcp"]]) {
      const body = await (await get(path)).json()
      expect(body.resource).toBe(`${ORIGIN}/api/mcp`)
    }
  })

  it("serves authorization-server metadata and opens CORS for discovery", async () => {
    const res = await get(["oauth-authorization-server"])
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*")
    expect((await res.json()).token_endpoint).toBe(`${ORIGIN}/api/oauth/token`)
  })

  it("404s anything else", async () => {
    expect((await get(["something-else"])).status).toBe(404)
  })
})
