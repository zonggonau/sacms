/**
 * Security smoke test — run against a deployed staging URL to confirm the
 * P0/P1 fixes are live. Read-only / non-destructive: it probes the holes and
 * asserts they're closed.
 *
 *   BASE_URL=https://staging.sacms.cloud bun scripts/qa-security-smoke.ts
 *
 * Exit code 0 = all checks passed, 1 = at least one regression.
 */

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "")

type Check = { name: string; run: () => Promise<{ pass: boolean; detail: string }> }

const checks: Check[] = [
  {
    name: "P0-2  image proxy blocks SSRF to cloud metadata",
    async run() {
      const r = await fetch(`${BASE}/api/media/transform?url=${encodeURIComponent("http://169.254.169.254/latest/meta-data/")}`)
      return { pass: r.status === 400, detail: `HTTP ${r.status} (want 400)` }
    },
  },
  {
    name: "P0-3  media/serve rejects a traversal key",
    async run() {
      const r = await fetch(`${BASE}/api/media/serve?key=${encodeURIComponent("upload/x/../../../../etc/passwd")}`, { redirect: "manual" })
      // 401 (no session) or 400 (bad key) — never 200 with a file body
      const body = await r.text().catch(() => "")
      const leaked = body.includes("root:") || body.includes("BEGIN")
      return { pass: !leaked && r.status !== 200, detail: `HTTP ${r.status}, leaked=${leaked}` }
    },
  },
  {
    name: "P0-5  license/activate requires auth",
    async run() {
      const r = await fetch(`${BASE}/api/tenant/any/license/activate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ licenseKey: "x" }),
      })
      return { pass: r.status === 401 || r.status === 403, detail: `HTTP ${r.status} (want 401/403)` }
    },
  },
  {
    name: "P0-6  Vercel webhook rejects an unsigned POST",
    async run() {
      const r = await fetch(`${BASE}/api/webhooks/vercel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "deployment.succeeded", payload: { deployment: { id: "d", url: "x" } } }),
      })
      return { pass: r.status === 401, detail: `HTTP ${r.status} (want 401)` }
    },
  },
  {
    name: "P0-9  auth/verify-test is gone",
    async run() {
      const r = await fetch(`${BASE}/api/auth/verify-test?token=x`, { redirect: "manual" })
      return { pass: r.status === 404, detail: `HTTP ${r.status} (want 404)` }
    },
  },
  {
    name: "P1  host-header injection — verify link stays on the platform host",
    async run() {
      const r = await fetch(`${BASE}/api/auth/verify?token=bogus`, {
        redirect: "manual",
        headers: { "x-forwarded-host": "evil.example.com" },
      })
      const loc = r.headers.get("location") || ""
      const onEvil = loc.includes("evil.example.com")
      return { pass: !onEvil, detail: `redirect -> ${loc || "(none)"}` }
    },
  },
  {
    name: "P1  public content API rejects a bogus token (no plaintext bypass)",
    async run() {
      const r = await fetch(`${BASE}/api/public/any/content/posts`, {
        headers: { authorization: "Bearer definitely-not-a-real-token" },
      })
      return { pass: r.status === 401, detail: `HTTP ${r.status} (want 401)` }
    },
  },
  {
    name: "P1  single-type API ignores ?token= in the URL",
    async run() {
      const r = await fetch(`${BASE}/api/public/any/single/hero?token=whatever`)
      return { pass: r.status === 401, detail: `HTTP ${r.status} (want 401 — query token not accepted)` }
    },
  },
  {
    name: "P1  debug route is 404 in production",
    async run() {
      const r = await fetch(`${BASE}/api/debug`)
      return { pass: r.status === 404, detail: `HTTP ${r.status} (want 404 in prod)` }
    },
  },
  {
    name: "health endpoint responds",
    async run() {
      const r = await fetch(`${BASE}/api/health`)
      return { pass: r.ok, detail: `HTTP ${r.status}` }
    },
  },
]

async function main() {
  console.log(`\n🔒 Security smoke test — ${BASE}\n`)
  let failed = 0
  for (const c of checks) {
    try {
      const { pass, detail } = await c.run()
      console.log(`${pass ? "✅" : "❌"}  ${c.name}\n     ${detail}`)
      if (!pass) failed++
    } catch (e) {
      console.log(`⚠️  ${c.name}\n     ERROR: ${(e as Error).message}`)
      failed++
    }
  }
  console.log(`\n${failed === 0 ? "✅ ALL PASSED" : `❌ ${failed} FAILED`}\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main()
