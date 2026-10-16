/**
 * Biznet Gio NEO Lite (VPS) API client.
 *
 * Staff-only — see src/app/api/admin/biznet-gio/*. BIZNETGEO_TOKEN is
 * SaCMS's own Biznet Gio account credential; every VM created through this
 * client is billed to SaCMS's own account, not a customer's. This backs
 * the "dibantu Tim SaCMS" assisted-setup pathway on
 * /dashboard/infrastructure — never expose it to a customer-facing route.
 *
 * Response shapes are NOT documented in Biznet Gio's own OpenAPI spec
 * (https://api.portal.biznetgio.com/v1/openapi.json declares every 200
 * response as an empty object) — confirmed instead with live read-only
 * calls (products/oss/keypairs/accounts/vm-details, 2026-10-16). Every
 * endpoint wraps its payload as `{ success, code, data }`; `request()`
 * below unwraps `data` so every method here returns the real payload
 * directly, not the envelope. The create-VM response itself was NOT
 * verified this way (it spends real money) — treat whatever it returns
 * as opaque until confirmed against a real call.
 */

const BASE_URL = "https://api.portal.biznetgio.com/v1"

export class BiznetGioError extends Error {
  constructor(message: string, public status?: number, public body?: unknown) {
    super(message)
    this.name = "BiznetGioError"
  }
}

function getToken(): string {
  const token = process.env.BIZNETGEO_TOKEN
  if (!token) throw new BiznetGioError("BIZNETGEO_TOKEN is not configured")
  return token
}

async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "x-token": getToken(),
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  })

  const text = await res.text()
  let parsed: unknown = text
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    // Non-JSON response — return raw text.
  }

  if (!res.ok) {
    throw new BiznetGioError(`Biznet Gio API error (${res.status})`, res.status, parsed)
  }

  // Every confirmed endpoint wraps its real payload as { success, code,
  // data } — including business-logic failures returned with HTTP 200
  // (success: false). Unwrap so callers get the actual payload, and treat
  // success: false as a real error instead of a silently empty result.
  if (parsed && typeof parsed === "object" && "success" in (parsed as Record<string, unknown>)) {
    const envelope = parsed as { success: boolean; code?: number; data?: unknown; message?: string }
    if (!envelope.success) {
      throw new BiznetGioError(envelope.message || "Biznet Gio API returned success: false", envelope.code, parsed)
    }
    return envelope.data as T
  }

  return parsed as T
}

export const biznetGio = {
  listProducts: () => request("GET", "/neolites/products"),
  getProduct: (productId: number | string) => request("GET", `/neolites/products/${productId}`),
  listProductOs: (productId: number | string) => request("GET", `/neolites/products/${productId}/oss`),
  checkIpAvailability: (productId: number | string) => request("GET", `/neolites/products/${productId}/ip-availability`),
  listKeypairs: () => request("GET", "/neolites/keypairs/"),

  /** Creates a real VM and bills SaCMS's own Biznet Gio account. */
  createVm: (payload: {
    product_id: number
    cycle: "m" | "a" | "q" | "s" | "b" | "t" | "p4" | "p5"
    select_os: string
    keypair_id: number
    vm_name?: string
    description?: string
    ssh_and_console_user: string
    console_password: string
    promocode?: string
    pay_invoice_with_cc?: "yes" | "no"
  }) => request("POST", "/neolites", payload),

  listAccounts: (status?: string[]) => {
    const qs = status?.length ? `?${status.map((s) => `status=${encodeURIComponent(s)}`).join("&")}` : ""
    return request("GET", `/neolites/accounts${qs}`)
  },
  getAccount: (accountId: number | string) => request("GET", `/neolites/accounts/${accountId}`),
  getVmDetails: (accountId: number | string) => request("GET", `/neolites/accounts/${accountId}/vm-details`),
  deleteVm: (accountId: number | string) => request("DELETE", `/neolites/${accountId}`),
}
