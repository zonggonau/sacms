/**
 * Contabo Compute API client — used by the "Server VPS" section of
 * /admin/monitoring to monitor and control the VPS that runs SaCMS's own
 * production instance (not a customer-facing feature; that bring-your-own-VPS
 * system was removed entirely, see db/manual-migrations/README.md #0002).
 *
 * Official reference: https://api.contabo.com (OpenAPI spec). Endpoints used
 * here are deliberately limited to what that spec documents clearly —
 * notably, Contabo's API has no invoices/billing endpoint and no live
 * CPU/RAM/disk utilization metric (only configured specs), so this client
 * doesn't pretend otherwise.
 */
import { randomUUID } from "crypto"

export interface ContaboInstanceIpConfig {
  v4: {
    ip: string
    gateway: string
    netmaskCidr: number
  }
  v6?: {
    ip: string
    gateway: string
    netmaskCidr: number
  }
}

export interface ContaboInstance {
  tenantId: string
  customerId: string
  name: string
  displayName: string
  instanceId: number
  dataCenter: string
  region: string
  regionName: string
  productId: string
  productType?: string
  productName?: string
  ipConfig: ContaboInstanceIpConfig
  macAddress?: string
  ramMb: number
  cpuCores: number
  osType: string
  diskMb: number
  createdDate: string
  cancelDate?: string | null
  status: "running" | "stopped" | "installing" | "error" | string
  vHostId?: number
  defaultUser?: string
}

export interface ContaboAvailableUpgrade {
  productId: string
  name: string
  description?: string
  additionalPrice?: { price: number; currency: string }
  offerId?: string
}

type ContaboResult<T> = { success: true; data: T } | { success: false; error: string }

let cachedToken: { accessToken: string; expiresAt: number } | null = null

function requireEnv() {
  const authUrl = process.env.CONTABO_AUTH_URL || "https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token"
  const apiUrl = process.env.CONTABO_API_URL || "https://api.contabo.com/v1/compute/instances"
  const clientId = process.env.CONTABO_CLIENT_ID
  const clientSecret = process.env.CONTABO_CLIENT_SECRET
  const username = process.env.CONTABO_API_USER
  const password = process.env.CONTABO_API_PASSWORD

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error(
      "Kredensial Contabo API belum lengkap (CONTABO_CLIENT_ID, CONTABO_CLIENT_SECRET, CONTABO_API_USER, CONTABO_API_PASSWORD)."
    )
  }
  return { authUrl, apiUrl, clientId, clientSecret, username, password }
}

async function getContaboAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 60 * 1000) {
    return cachedToken.accessToken
  }

  const { authUrl, clientId, clientSecret, username, password } = requireEnv()

  const params = new URLSearchParams()
  params.append("client_id", clientId)
  params.append("client_secret", clientSecret)
  params.append("username", username)
  params.append("password", password)
  params.append("grant_type", "password")

  const res = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    cache: "no-store",
  })

  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(`Gagal otentikasi ke Contabo OAuth2 (${res.status}): ${errorBody}`)
  }

  const data = await res.json()
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in || 300) * 1000,
  }
  return cachedToken.accessToken
}

async function contaboFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getContaboAccessToken()
  return fetch(`https://api.contabo.com${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-request-id": randomUUID(),
      "x-trace-id": randomUUID().slice(0, 8),
      ...init.headers,
    },
    cache: "no-store",
  })
}

/** GET /v1/compute/instances — all VPS instances on this Contabo account. */
export async function getContaboInstances(): Promise<ContaboResult<ContaboInstance[]>> {
  try {
    const res = await contaboFetch("/v1/compute/instances")
    if (!res.ok) {
      const errorText = await res.text()
      console.error(`[Contabo API Error] ${res.status}: ${errorText}`)
      return { success: false, error: `Contabo API error (${res.status})` }
    }
    const json = await res.json()
    return { success: true, data: (json.data || []) as ContaboInstance[] }
  } catch (err: any) {
    console.error("[getContaboInstances Error]:", err)
    return { success: false, error: err.message || "Gagal mengambil data instance dari Contabo." }
  }
}

/** GET /v1/compute/instances/{instanceId} — single instance detail. */
export async function getContaboInstance(instanceId: number): Promise<ContaboResult<ContaboInstance>> {
  try {
    const res = await contaboFetch(`/v1/compute/instances/${instanceId}`)
    if (!res.ok) {
      const errorText = await res.text()
      return { success: false, error: `Contabo API error (${res.status}): ${errorText}` }
    }
    const json = await res.json()
    const instance = (json.data || [])[0]
    if (!instance) return { success: false, error: "Instance tidak ditemukan" }
    return { success: true, data: instance as ContaboInstance }
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal mengambil detail instance." }
  }
}

/** GET /v1/compute/instances/{instanceId}/products/available — informational only (pricing/plan list). */
export async function getContaboAvailableUpgrades(instanceId: number): Promise<ContaboResult<ContaboAvailableUpgrade[]>> {
  try {
    const res = await contaboFetch(`/v1/compute/instances/${instanceId}/products/available`)
    if (!res.ok) {
      const errorText = await res.text()
      return { success: false, error: `Contabo API error (${res.status}): ${errorText}` }
    }
    const json = await res.json()
    return { success: true, data: (json.data || []) as ContaboAvailableUpgrade[] }
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal mengambil daftar upgrade." }
  }
}

export type ContaboInstanceAction = "start" | "restart" | "shutdown"

/**
 * POST /v1/compute/instances/{instanceId}/actions/{action} — power control.
 * Deliberately exposes only start/restart/shutdown (graceful ACPI). "stop"
 * (hard power-off, documented by Contabo as risking data loss), "rescue",
 * "resetPassword", reinstall, and "cancel" are NOT exposed here — this is an
 * ops convenience panel for a live production server, not a full account
 * management console.
 */
export async function runContaboInstanceAction(
  instanceId: number,
  action: ContaboInstanceAction
): Promise<ContaboResult<{ status: string }>> {
  try {
    const res = await contaboFetch(`/v1/compute/instances/${instanceId}/actions/${action}`, {
      method: "POST",
      body: JSON.stringify({}),
    })
    if (!res.ok) {
      const errorText = await res.text()
      return { success: false, error: `Contabo API error (${res.status}): ${errorText}` }
    }
    const json = await res.json().catch(() => ({}))
    return { success: true, data: { status: json?.data?.[0]?.status || "requested" } }
  } catch (err: any) {
    return { success: false, error: err.message || `Gagal menjalankan aksi ${action}.` }
  }
}

/**
 * POST /v1/compute/instances/{instanceId}/upgrade — enables the Automated
 * Backup add-on. This is the only storage-adjacent add-on Contabo's public
 * API documents (resizing RAM/disk/CPU requires an `offerId`-based flow that
 * isn't clearly/safely specified in the public spec, so it's intentionally
 * not wired up here — see the Infrastruktur page's "Upgrade Plan" card,
 * which links out to the Contabo panel instead of calling an unverified
 * endpoint that would move real money).
 */
export async function enableContaboBackupAddon(instanceId: number): Promise<ContaboResult<{ status: string }>> {
  try {
    const res = await contaboFetch(`/v1/compute/instances/${instanceId}/upgrade`, {
      method: "POST",
      body: JSON.stringify({ backup: {} }),
    })
    if (!res.ok) {
      const errorText = await res.text()
      return { success: false, error: `Contabo API error (${res.status}): ${errorText}` }
    }
    return { success: true, data: { status: "requested" } }
  } catch (err: any) {
    return { success: false, error: err.message || "Gagal mengaktifkan add-on backup." }
  }
}
