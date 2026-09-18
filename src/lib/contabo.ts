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
  name: string // e.g. "vmi3288954"
  displayName: string // e.g. "SACMS"
  instanceId: number // e.g. 203288954
  dataCenter: string // e.g. "European Union 2"
  region: string // e.g. "EU"
  regionName: string // e.g. "European Union"
  productId: string // e.g. "V95"
  productType?: string // e.g. "ssd"
  productName?: string // e.g. "Cloud VPS 20 SSD (no setup)"
  ipConfig: ContaboInstanceIpConfig
  macAddress?: string
  ramMb: number // e.g. 12288
  cpuCores: number // e.g. 6
  osType: string // e.g. "Linux"
  diskMb: number // e.g. 204800
  createdDate: string
  cancelDate?: string | null
  status: "running" | "stopped" | "installing" | "error" | string
  vHostId?: number
  defaultUser?: string
}

let cachedToken: {
  accessToken: string
  expiresAt: number
} | null = null

/**
 * Mendapatkan Access Token dari Contabo OAuth2 API dengan caching in-memory
 */
export async function getContaboAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 60 * 1000) {
    return cachedToken.accessToken
  }

  const authUrl =
    process.env.CONTABO_AUTH_URL ||
    "https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token"
  const clientId = process.env.CONTABO_CLIENT_ID
  const clientSecret = process.env.CONTABO_CLIENT_SECRET
  const username = process.env.CONTABO_API_USER
  const password = process.env.CONTABO_API_PASSWORD

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error(
      "Kredensial Contabo API belum lengkap di environment variable (CONTABO_CLIENT_ID, CONTABO_CLIENT_SECRET, CONTABO_API_USER, CONTABO_API_PASSWORD)."
    )
  }

  const params = new URLSearchParams()
  params.append("client_id", clientId)
  params.append("client_secret", clientSecret)
  params.append("username", username)
  params.append("password", password)
  params.append("grant_type", "password")

  const res = await fetch(authUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  })

  if (!res.ok) {
    const errorBody = await res.text()
    throw new Error(`Gagal otentikasi ke Contabo OAuth2 (${res.status}): ${errorBody}`)
  }

  const data = await res.json()
  const expiresIn = (data.expires_in || 300) * 1000 // default 5 menit

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + expiresIn,
  }

  return data.access_token
}

/**
 * Mengambil daftar Compute Instances dari Contabo API (GET /v1/compute/instances)
 */
export async function getContaboInstances(): Promise<{
  success: boolean
  data: ContaboInstance[]
  error?: string
}> {
  try {
    const token = await getContaboAccessToken()
    const apiUrl = process.env.CONTABO_API_URL || "https://api.contabo.com/v1/compute/instances"

    const requestId = randomUUID()
    const traceId = randomUUID().slice(0, 8)

    const res = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-request-id": requestId,
        "x-trace-id": traceId,
      },
      cache: "no-store",
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`[Contabo API Error] ${res.status}: ${errorText}`)
      return {
        success: false,
        data: [],
        error: `Contabo API error (${res.status}): ${errorText}`,
      }
    }

    const json = await res.json()
    const instances: ContaboInstance[] = json.data || []

    return {
      success: true,
      data: instances,
    }
  } catch (err: any) {
    console.error("[getContaboInstances Error]:", err)
    return {
      success: false,
      data: [],
      error: err.message || "Gagal mengambil data compute instances dari Contabo.",
    }
  }
}
