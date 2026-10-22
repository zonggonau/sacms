import { isMockAllowed, requireCredentialOutsideMock } from "./dev-mode"

/**
 * Biznet Gio NEO Lite API client.
 *
 * Base URL, auth header, and every endpoint below were confirmed against
 * the LIVE API with a real key (read-only calls only — GET /neolites/products,
 * /oss, /accounts, /{id}/vm-details) and cross-checked against the official
 * BiznetGIO/biznetgio-cli source (no public OpenAPI spec exists for this API).
 *
 * `pay_invoice_with_cc: true` on createVm is what makes provisioning
 * immediate instead of sitting as an unpaid invoice in Biznet Gio's own
 * portal — it charges whatever payment method is on file with SaCMS's own
 * Biznet Gio account the instant it's called. Every caller of createVm must
 * be downstream of a real, already-confirmed SaCMS sale (see
 * src/lib/billing/vps-fulfillment.ts) — never call it speculatively.
 */

const BASE_URL = "https://api.portal.biznetgio.com/v1"

export interface BiznetProductBilling {
  label: string
  cycle: "m" | "a" | "b" | "t"
  price: string
}

export interface BiznetProduct {
  product_id: string
  name: string
  description: string
  category_id: string
  category_name: string
  options: { type: string; cores: string; memory: string }
  billing: BiznetProductBilling[]
}

export interface BiznetOsImage {
  node: string
  vmid: number
  name: string
  maxmem: number
  maxcpu: number
}

export interface BiznetKeypair {
  keypair_id: string
  name: string
  private_key?: string
}

export interface BiznetCreateVmInput {
  product_id: string
  cycle: "m" | "a" | "b" | "t"
  select_os: string
  keypair_id: string
  ssh_and_console_user: string
  console_password: string
  vm_name?: string
  description?: string
  pay_invoice_with_cc: boolean
}

export interface BiznetAccount {
  account_id: string
  status: string
  product_id: string
  product_name: string
  billingcycle: string
  extra_details?: {
    address?: string
    gateway?: string
    osname?: string
    region_label?: string
    [key: string]: unknown
  }
}

function getApiKey(): string | null {
  return process.env.BIZNETGIO_API_KEY?.trim() || null
}

async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  opts: { body?: unknown; query?: Record<string, string> } = {}
): Promise<T> {
  const apiKey = getApiKey()
  if (!apiKey) {
    if (!isMockAllowed("biznetgio", false)) {
      requireCredentialOutsideMock("biznetgio", "BIZNETGIO_API_KEY")
    }
    throw new Error(
      "[biznetgio] BIZNETGIO_API_KEY not set — this call has no mock fallback of its own; " +
      "see createKeypair()/createVm() for the mocked VPS-provisioning path used in dev/test."
    )
  }
  const url = new URL(`${BASE_URL}${path}`)
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "x-token": apiKey,
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })

  const json = await res.json().catch(() => null)
  if (!res.ok || json?.success === false) {
    const message = json?.message || json?.error || `Biznet Gio API error (HTTP ${res.status})`
    throw new Error(`[biznetgio] ${method} ${path} failed: ${message}`)
  }
  return (json?.data ?? json) as T
}

export function getProducts(): Promise<BiznetProduct[]> {
  return apiRequest<BiznetProduct[]>("GET", "/neolites/products")
}

export function getProductOss(productId: string): Promise<BiznetOsImage[]> {
  return apiRequest<BiznetOsImage[]>("GET", `/neolites/products/${productId}/oss`)
}

/**
 * Creates a real SSH keypair via Biznet Gio — free (no charge), but still
 * mocked in dev/test when no BIZNETGIO_API_KEY is configured, same
 * dev/test-only fallback rule as every other paid/external integration in
 * this codebase (see src/lib/dev-mode.ts) so local development never
 * requires a live key just to exercise the VPS purchase flow.
 */
export async function createKeypair(name: string): Promise<BiznetKeypair> {
  const hasCredential = Boolean(getApiKey())
  if (!hasCredential) {
    if (!isMockAllowed("biznetgio", hasCredential)) {
      requireCredentialOutsideMock("biznetgio", "BIZNETGIO_API_KEY")
    }
    console.warn("[biznetgio] BIZNETGIO_API_KEY not set — simulating keypair creation (dev/test only).")
    return { keypair_id: `mock_keypair_${Date.now()}`, name, private_key: "-----BEGIN MOCK PRIVATE KEY-----" }
  }
  return apiRequest<BiznetKeypair>("POST", "/neolites/keypairs/", { body: { name } })
}

/**
 * Creates (and, via pay_invoice_with_cc, immediately pays for) a real VM —
 * this is the one call in this whole client that spends real money the
 * instant it succeeds. Every caller MUST be downstream of an already-
 * confirmed SaCMS sale (see src/lib/billing/vps-fulfillment.ts) — never
 * call this speculatively or from a dry-run path. Mocked in dev/test like
 * every other paid integration when no credential is configured.
 */
export async function createVm(input: BiznetCreateVmInput): Promise<{ account_id: string }> {
  const hasCredential = Boolean(getApiKey())
  if (!hasCredential) {
    if (!isMockAllowed("biznetgio", hasCredential)) {
      requireCredentialOutsideMock("biznetgio", "BIZNETGIO_API_KEY")
    }
    console.warn("[biznetgio] BIZNETGIO_API_KEY not set — simulating VM creation (dev/test only).")
    return { account_id: `mock_account_${Date.now()}` }
  }
  return apiRequest<{ account_id: string }>("POST", "/neolites", { body: input })
}

export function getAccountDetails(accountId: string): Promise<BiznetAccount> {
  return apiRequest<BiznetAccount>("GET", `/neolites/accounts/${accountId}`)
}

export function getVmDetails(accountId: string): Promise<Record<string, unknown> | null> {
  return apiRequest<Record<string, unknown> | null>("GET", `/neolites/accounts/${accountId}/vm-details`)
}

/** Not wired into any purchase flow in v1 — kept for a future self-service cancel/terminate feature. */
export function deleteVm(accountId: string): Promise<unknown> {
  return apiRequest("DELETE", `/neolites/${accountId}`)
}
