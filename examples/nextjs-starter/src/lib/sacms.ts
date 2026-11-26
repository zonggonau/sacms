import { SaCMS } from "@sacms/sdk"
import { readEnv, type SacmsEnv } from "@/lib/env"

// Server-only client. Import it from Server Components, Route Handlers and
// Server Actions. It must not be imported from a "use client" file, because
// the read token would reach the browser.
export type SacmsSetup =
  | { ok: true; client: SaCMS; env: SacmsEnv }
  | { ok: false; missing: string[] }

let cached: SacmsSetup | undefined

export function getSacms(): SacmsSetup {
  if (cached) return cached

  const result = readEnv()
  if (!result.ok) return (cached = { ok: false, missing: result.missing })

  const { env } = result
  const client = new SaCMS({
    baseUrl: env.baseUrl,
    tenant: env.tenant,
    token: env.token,
    locale: env.locale,
    timeoutMs: 10_000,
  })
  return (cached = { ok: true, client, env })
}
