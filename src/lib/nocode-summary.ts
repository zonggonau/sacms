import { z } from "zod"

/**
 * Server-side client for the read-only SaCMS nocode summary
 * (`GET /api/platform/ringkasan` on the nocode app — nocode ADR-016).
 *
 * SaCMS only DISPLAYS these numbers. Every action on nocode data (suspend a user,
 * cancel a build, kill switch, impersonation) stays in the nocode admin, because
 * it depends on Better Auth, v0, Vercel and the credit ledger that live there.
 * This module therefore only reads, and the UI links out for anything else.
 *
 * Must only run on the server: NOCODE_SUMMARY_KEY never reaches the browser.
 */

const planSchema = z.object({
  name: z.string(),
  users: z.number(),
  revenueIdr: z.number(),
  costIdr: z.number(),
  marginIdr: z.number(),
})

export const nocodeSummarySchema = z.object({
  generatedAt: z.string(),
  users: z.object({ total: z.number(), newLast7Days: z.number() }),
  projects: z.object({ total: z.number(), newLast7Days: z.number() }),
  builds: z.object({
    finishedToday: z.number(),
    failedToday: z.number(),
    successRatePercent: z.number().nullable(),
    runningNow: z.number(),
  }),
  creditsUsedThisMonth: z.number(),
  finance30Days: z.object({
    revenueIdr: z.number(),
    aiCostIdr: z.number(),
    marginIdr: z.number(),
    newLiveWebsites: z.number(),
    unreconciledEvents: z.number(),
    plans: z.array(planSchema),
  }),
  system: z.object({
    killSwitch: z.boolean(),
    maintenance: z.boolean(),
    signupEnabled: z.boolean(),
  }),
  attention: z.array(z.object({ message: z.string(), path: z.string() })),
})

export type NocodeSummary = z.infer<typeof nocodeSummarySchema>

export type NocodeSummaryFailure = "not_configured" | "unauthorized" | "unreachable" | "invalid_response"

export type NocodeSummaryResult =
  | { ok: true; summary: NocodeSummary; adminBaseUrl: string }
  | { ok: false; reason: NocodeSummaryFailure; message: string; adminBaseUrl: string }

const REQUEST_TIMEOUT_MS = 8_000

/** Base URL of the nocode app. Production default is the apex; locally the dev runner puts nocode on :3001. */
export function getNocodeBaseUrl(): string {
  const configured = process.env.NOCODE_BASE_URL?.trim()
  if (configured) return configured.replace(/\/+$/, "")
  return process.env.NODE_ENV === "production" ? "https://sacms.cloud" : "http://localhost:3001"
}

export async function fetchNocodeSummary(): Promise<NocodeSummaryResult> {
  const adminBaseUrl = getNocodeBaseUrl()
  const key = process.env.NOCODE_SUMMARY_KEY?.trim()

  if (!key) {
    return {
      ok: false,
      reason: "not_configured",
      message: "NOCODE_SUMMARY_KEY belum diisi. Isi dengan nilai yang sama seperti PLATFORM_SUMMARY_KEY di nocode.",
      adminBaseUrl,
    }
  }

  let response: Response
  try {
    response = await fetch(`${adminBaseUrl}/api/platform/ringkasan`, {
      headers: { authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    return {
      ok: false,
      reason: "unreachable",
      message: `SaCMS nocode tidak bisa dihubungi di ${adminBaseUrl}.`,
      adminBaseUrl,
    }
  }

  if (response.status === 401) {
    return {
      ok: false,
      reason: "unauthorized",
      message: "Kunci ditolak nocode. Pastikan NOCODE_SUMMARY_KEY sama dengan PLATFORM_SUMMARY_KEY di nocode.",
      adminBaseUrl,
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: "unreachable",
      message: `SaCMS nocode gagal menyusun ringkasan (status ${response.status}).`,
      adminBaseUrl,
    }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = null
  }

  const parsed = nocodeSummarySchema.safeParse(body)
  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid_response",
      message: "Bentuk ringkasan dari nocode tidak dikenali — kemungkinan versi kedua aplikasi tidak sama.",
      adminBaseUrl,
    }
  }

  return { ok: true, summary: parsed.data, adminBaseUrl }
}
