import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))
vi.mock("@/lib/mcp/oauth/service", () => ({
  findClient: vi.fn(async () => ({ clientId: "mcpc_client", name: "ChatGPT", redirectUris: ["https://chatgpt.com/connector_platform_oauth_redirect"] })),
  createAuthorizationCode: vi.fn(async () => "code-1"),
}))

import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { createAuthorizationCode } from "@/lib/mcp/oauth/service"
import { POST as grant } from "@/app/api/oauth/grant/route"
import { parseMcpResource, mcpResource, protectedResourceMetadata } from "@/lib/mcp/oauth/protocol"
import { workspaceScopeError } from "@/lib/mcp/workspace-scope"
import { GET as wellKnown } from "@/app/api/oauth/well-known/[...path]/route"

const ORIGIN = "https://sacms.cloud"
const REDIRECT = "https://chatgpt.com/connector_platform_oauth_redirect"
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

const grantReq = (body: Record<string, unknown>) => new Request(`${ORIGIN}/api/oauth/grant`, {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
})
const grantBody = (over: Record<string, unknown> = {}) => ({
  client_id: "mcpc_client", redirect_uri: REDIRECT, state: "xyz", code_challenge: CHALLENGE,
  code_challenge_method: "S256", resource: `${ORIGIN}/api/mcp/w/acme`, tenant_slug: "acme", decision: "approve", ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXTAUTH_URL = ORIGIN
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-1", role: "user" } } as any)
  vi.mocked(getTenantAccess).mockResolvedValue({ tenantId: "tenant-acme", role: "owner", tenant: { id: "tenant-acme", slug: "acme" } } as any)
})

describe("per-workspace resource helpers", () => {
  it("builds the shared and the per-workspace resource URLs", () => {
    expect(mcpResource(ORIGIN)).toBe(`${ORIGIN}/api/mcp`)
    expect(mcpResource(ORIGIN, "acme")).toBe(`${ORIGIN}/api/mcp/w/acme`)
  })

  it("parses both forms and rejects anything else", () => {
    expect(parseMcpResource(ORIGIN, `${ORIGIN}/api/mcp`)).toEqual({ workspaceSlug: null })
    expect(parseMcpResource(ORIGIN, `${ORIGIN}/api/mcp/w/acme`)).toEqual({ workspaceSlug: "acme" })
    expect(parseMcpResource(ORIGIN, `${ORIGIN}/api/mcp/w/`)).toBeNull()
    expect(parseMcpResource(ORIGIN, `${ORIGIN}/api/mcp/w/acme/extra`)).toBeNull()
    expect(parseMcpResource(ORIGIN, `https://evil.example/api/mcp/w/acme`)).toBeNull()
  })

  it("protected-resource metadata names the workspace endpoint when scoped", () => {
    expect(protectedResourceMetadata(ORIGIN, "acme").resource).toBe(`${ORIGIN}/api/mcp/w/acme`)
    expect(protectedResourceMetadata(ORIGIN).resource).toBe(`${ORIGIN}/api/mcp`)
  })
})

describe("workspace scope on the MCP endpoint", () => {
  const tokenFor = (slug: string, id: string) => ({ tenantId: id, tenantSlug: slug })

  it("refuses a token from another workspace", () => {
    expect(workspaceScopeError(tokenFor("beta", "tenant-beta"), "acme")).toMatch(/belongs to workspace "beta"/)
  })

  it("accepts the workspace by slug or by id, since the dashboard uses either", () => {
    expect(workspaceScopeError(tokenFor("acme", "tenant-acme"), "acme")).toBeNull()
    expect(workspaceScopeError(tokenFor("acme", "tenant-acme"), "tenant-acme")).toBeNull()
    expect(workspaceScopeError(tokenFor("beta", "tenant-beta"), "tenant-acme")).not.toBeNull()
  })

  it("the shared endpoint has no scope", () => {
    expect(workspaceScopeError(tokenFor("beta", "tenant-beta"), undefined)).toBeNull()
  })
})

describe("consent for a per-workspace resource", () => {
  it("refuses a body that names a different workspace than the URL", async () => {
    const res = await grant(grantReq(grantBody({ tenant_slug: "beta" })))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("acme") })
    expect(createAuthorizationCode).not.toHaveBeenCalled()
  })

  it("accepts the same workspace named by its id in the body", async () => {
    const res = await grant(grantReq(grantBody({ tenant_slug: "tenant-acme" })))
    expect(res.status).toBe(200)
  })

  it("approves for the URL's workspace and never looks up any other", async () => {
    const res = await grant(grantReq(grantBody()))
    expect(res.status).toBe(200)
    expect(getTenantAccess).toHaveBeenCalledWith(expect.anything(), "acme")
    expect(createAuthorizationCode).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-acme" }))
  })

  it("rejects a resource that names neither endpoint", async () => {
    const res = await grant(grantReq(grantBody({ resource: "https://evil.example/api/mcp/w/acme" })))
    expect(res.status).toBe(400)
  })
})

describe("well-known metadata for a workspace endpoint", () => {
  const get = (path: string) => wellKnown(new Request(`${ORIGIN}/.well-known/${path}`), {
    params: Promise.resolve({ path: path.split("/") }),
  } as never)

  it("serves metadata for /api/mcp/w/<slug>", async () => {
    const res = await get("oauth-protected-resource/api/mcp/w/acme")
    expect(res.status).toBe(200)
    expect((await res.json()).resource).toBe(`${ORIGIN}/api/mcp/w/acme`)
  })

  it("404s for an unknown resource path", async () => {
    expect((await get("oauth-protected-resource/api/other")).status).toBe(404)
  })
})
