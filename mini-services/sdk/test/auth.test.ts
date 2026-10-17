import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { SaCMS } from "../src/client"

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

describe("SaCMS auth client", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function client() {
    return new SaCMS({ baseUrl: "https://app.test", tenant: "acme", token: "svc_token" })
  }

  it("login() posts email/password to the login endpoint using the service token", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        message: "Login berhasil",
        user: { id: "m1", email: "a@b.com", name: null, avatar: null, role: "authenticated", status: "active", metadata: null, createdAt: "now" },
        accessToken: "mem_access",
        refreshToken: "mem_refresh",
        expiresIn: 900,
        tokenType: "Bearer",
      }),
    )

    const result = await client().auth.login("a@b.com", "secret")

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://app.test/api/public/acme/auth/login")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual({ email: "a@b.com", password: "secret" })
    expect(init.headers.Authorization).toBe("Bearer svc_token")
    expect(result.accessToken).toBe("mem_access")
  })

  it("register() posts the registration payload", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Account created.", requiresEmailVerification: true }, 202))
    const result = await client().auth.register({ email: "a@b.com", password: "secret123", name: "A" })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://app.test/api/public/acme/auth/register")
    expect(JSON.parse(init.body)).toEqual({ email: "a@b.com", password: "secret123", name: "A" })
    expect("requiresEmailVerification" in result).toBe(true)
  })

  it("me() overrides the Authorization header with the member's own access token, not the service token", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: { id: "m1" } }))
    await client().auth.me("member_access_token")

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://app.test/api/public/acme/auth/me")
    expect(init.headers.Authorization).toBe("Bearer member_access_token")
  })

  it("updateMe() sends a PATCH with the member token", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "ok", user: { id: "m1" } }))
    await client().auth.updateMe("member_access_token", { name: "New Name" })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe("PATCH")
    expect(init.headers.Authorization).toBe("Bearer member_access_token")
    expect(JSON.parse(init.body)).toEqual({ name: "New Name" })
  })

  it("changePassword() requires the member token, not the service token", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "ok" }))
    await client().auth.changePassword("member_access_token", {
      currentPassword: "old",
      password: "newpass1",
      passwordConfirmation: "newpass1",
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://app.test/api/public/acme/auth/change-password")
    expect(init.headers.Authorization).toBe("Bearer member_access_token")
  })

  it("refresh() posts the refresh token with no auth override", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: "Token refreshed successfully", accessToken: "a2", refreshToken: "r2", expiresIn: 900, tokenType: "Bearer" }),
    )
    await client().auth.refresh("old_refresh")

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://app.test/api/public/acme/auth/refresh")
    expect(JSON.parse(init.body)).toEqual({ refreshToken: "old_refresh" })
  })

  it("logout() posts an empty body when no refresh token is given", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Logout berhasil." }))
    await client().auth.logout()

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({})
  })

  it("forgotPassword() and resetPassword() hit their respective endpoints", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "ok" }))
    await client().auth.forgotPassword("a@b.com")
    expect(fetchMock.mock.calls[0][0]).toBe("https://app.test/api/public/acme/auth/forgot-password")

    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "ok" }))
    await client().auth.resetPassword({ code: "abc", password: "newpass1", passwordConfirmation: "newpass1" })
    expect(fetchMock.mock.calls[1][0]).toBe("https://app.test/api/public/acme/auth/reset-password")
  })

  it("confirmEmail() hits the email-confirmation endpoint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "ok" }))
    await client().auth.confirmEmail("code123")

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://app.test/api/public/acme/auth/email-confirmation")
    expect(JSON.parse(init.body)).toEqual({ code: "code123" })
  })
})
