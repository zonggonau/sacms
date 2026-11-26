// Reads SaCMS settings from the environment. Nothing throws here: a missing
// value is reported back so the page can show a clear message instead of a
// blank screen or a crash during build.

export interface SacmsEnv {
  baseUrl: string
  tenant: string
  token: string | undefined
  locale: string
  webhookSecret: string | undefined
}

export type EnvResult =
  | { ok: true; env: SacmsEnv }
  | { ok: false; missing: string[] }

export function readEnv(source: NodeJS.ProcessEnv = process.env): EnvResult {
  const baseUrl = (source.SACMS_BASE_URL ?? "").replace(/\/+$/, "")
  const tenant = (source.SACMS_TENANT ?? "").trim()

  const missing: string[] = []
  if (!baseUrl) missing.push("SACMS_BASE_URL")
  if (!tenant) missing.push("SACMS_TENANT")
  if (missing.length > 0) return { ok: false, missing }

  return {
    ok: true,
    env: {
      baseUrl,
      tenant,
      token: source.SACMS_API_TOKEN?.trim() || undefined,
      locale: source.SACMS_DEFAULT_LOCALE?.trim() || "id",
      webhookSecret: source.SACMS_WEBHOOK_SECRET?.trim() || undefined,
    },
  }
}
