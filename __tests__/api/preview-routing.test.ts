import { NextRequest } from "next/server"
import { afterEach, expect, it, vi } from "vitest"
import { GET } from "@/app/api/public/caddy-ask/route"
import { previewCredential, verifyPublicPreview } from "@/lib/infrastructure/preview-access"

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }))
vi.mock("@/lib/database", () => ({ db: { mcpPreviewSession: { findFirst } } }))

const id = "0123456789abcdef"
const ask = (host: string) => GET(new NextRequest("http://localhost/api/public/caddy-ask?domain=" + host))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.clearAllMocks()
})

it("only authorizes TLS for a routable live session, including during startup", async () => {
  findFirst.mockResolvedValueOnce({ id }).mockResolvedValueOnce(null)
  expect((await ask(id + ".preview.sacms.cloud")).status).toBe(200)
  expect(findFirst.mock.calls[0][0].where).toMatchObject({
    id, status: { in: ["starting", "ready", "editing"] }, expiresAt: { gt: expect.any(Date) }, upstream: { not: null },
  })
  expect((await ask(id + ".preview.sacms.cloud")).status).toBe(403)
  expect((await ask("unknown.preview.sacms.cloud")).status).toBe(403)
  expect(findFirst).toHaveBeenCalledTimes(2)
})

it("requires the preview proxy's proof even if the public hostname responds", async () => {
  vi.useFakeTimers()
  vi.stubEnv("NEXTAUTH_SECRET", "testing-only")
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal("fetch", fetch)
  const failure = expect(verifyPublicPreview(id)).rejects.toThrow("HTTP 204")
  await vi.runAllTimersAsync()
  await failure
  fetch.mockResolvedValue(new Response(null, { status: 204, headers: { "x-sacms-preview-proof": previewCredential(id, "proof") } }))
  await verifyPublicPreview(id)
  expect(fetch).toHaveBeenLastCalledWith("https://" + id + ".preview.sacms.cloud/.well-known/sacms-preview-health", expect.objectContaining({
    method: "HEAD", redirect: "manual", headers: { "x-sacms-preview-probe": previewCredential(id, "probe") },
  }))
})
