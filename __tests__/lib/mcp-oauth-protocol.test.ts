import { describe, expect, it } from "vitest"
import {
  authorizationServerMetadata,
  isAllowedRedirectUri,
  isValidCodeChallenge,
  mcpResource,
  protectedResourceMetadata,
  publicOrigin,
  verifyPkce,
} from "@/lib/mcp/oauth/protocol"

describe("PKCE (RFC 7636, S256)", () => {
  // The example from RFC 7636 appendix B.
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
  const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

  it("accepts the RFC example pair", () => {
    expect(verifyPkce(verifier, challenge)).toBe(true)
  })

  it("rejects a different verifier for the same challenge", () => {
    expect(verifyPkce(verifier.replace("d", "e"), challenge)).toBe(false)
  })

  it("rejects a verifier outside the 43-128 character range", () => {
    expect(verifyPkce("short", challenge)).toBe(false)
    expect(verifyPkce("a".repeat(129), challenge)).toBe(false)
  })

  it("rejects a verifier with characters outside the unreserved set", () => {
    expect(verifyPkce(`${verifier.slice(0, 42)}+`, challenge)).toBe(false)
  })

  it("validates the shape of a S256 challenge", () => {
    expect(isValidCodeChallenge(challenge)).toBe(true)
    expect(isValidCodeChallenge("too-short")).toBe(false)
  })
})

describe("redirect URI rules", () => {
  it.each([
    "https://chatgpt.com/connector_platform_oauth_redirect",
    "https://claude.ai/api/mcp/auth_callback",
    "http://localhost:6274/oauth/callback",
    "http://127.0.0.1:3000/cb",
  ])("allows %s", (uri) => {
    expect(isAllowedRedirectUri(uri)).toBe(true)
  })

  it.each([
    "http://example.com/cb", // plain http on a public host
    "javascript:alert(1)",
    "https://example.com/cb#fragment", // fragments are not allowed
    "https://user:pw@example.com/cb",
    "not a url",
    "",
  ])("refuses %s", (uri) => {
    expect(isAllowedRedirectUri(uri)).toBe(false)
  })
})

describe("discovery documents", () => {
  const origin = "https://sacms.cloud"

  it("names the MCP endpoint as the protected resource and this origin as its authorization server", () => {
    const meta = protectedResourceMetadata(origin)
    expect(meta.resource).toBe(`${origin}/api/mcp`)
    expect(meta.resource).toBe(mcpResource(origin))
    expect(meta.authorization_servers).toEqual([origin])
    expect(meta.bearer_methods_supported).toEqual(["header"])
  })

  it("publishes the authorization, token, and registration endpoints with PKCE S256 only", () => {
    const as = authorizationServerMetadata(origin)
    expect(as.issuer).toBe(origin)
    expect(as.authorization_endpoint).toBe(`${origin}/oauth/authorize`)
    expect(as.token_endpoint).toBe(`${origin}/api/oauth/token`)
    expect(as.registration_endpoint).toBe(`${origin}/api/oauth/register`)
    expect(as.code_challenge_methods_supported).toEqual(["S256"])
    expect(as.response_types_supported).toEqual(["code"])
    expect(as.token_endpoint_auth_methods_supported).toEqual(["none"])
  })

  it("uses NEXTAUTH_URL as the public origin and ignores a trailing slash", () => {
    const previous = process.env.NEXTAUTH_URL
    process.env.NEXTAUTH_URL = "https://sacms.cloud/"
    try {
      expect(publicOrigin("http://127.0.0.1:3000")).toBe("https://sacms.cloud")
    } finally {
      if (previous === undefined) delete process.env.NEXTAUTH_URL
      else process.env.NEXTAUTH_URL = previous
    }
  })
})
