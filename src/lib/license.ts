/**
 * Enterprise License System
 * 
 * Handles license key generation (admin), validation, caching,
 * and enterprise mode activation for self-hosted instances.
 */

import fs from "fs"
import path from "path"
import crypto from "crypto"
import { db } from "./database"

const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL || ""

// RSA key paths (for offline validation)
const PUBLIC_KEY_PATH = path.join(process.cwd(), "keys", "license-public.pem")
const PRIVATE_KEY_PATH = path.join(process.cwd(), "keys", "license-private.pem")

export interface LicensePayload {
  sub: string       // customer ID
  name: string      // customer name
  email?: string
  org?: string
  type: "enterprise" | "partner" | "trial"
  features: string[]
  iat: number       // issued at (unix)
  exp: number       // expires at (unix)
  jti: string       // unique key ID (for revocation)
}

export interface LicenseResult {
  valid: boolean
  customerName?: string
  customerEmail?: string
  organization?: string
  type?: string
  features?: string[]
  expiresAt?: Date
  issuedAt?: Date
  daysRemaining?: number
  status?: "active" | "expired" | "revoked" | "invalid"
  error?: string
}

// ─── LICENSE KEY GENERATION (Admin only) ─────────────────────────────

/**
 * Generate an RSA-signed license key
 * Call this from an admin API endpoint
 */
export function generateLicenseKey(payload: Omit<LicensePayload, "iat" | "jti">): string {
  const fullPayload: LicensePayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    jti: crypto.randomUUID(),
  }

  const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, "utf-8")
  const payloadStr = JSON.stringify(fullPayload)
  const signature = crypto.sign("sha256", Buffer.from(payloadStr), privateKey)

  // Format: SACMS-{base64(payload)}.{base64(signature)}
  const encodedPayload = Buffer.from(payloadStr).toString("base64url")
  const encodedSig = signature.toString("base64url")

  return `SACMS-${encodedPayload}.${encodedSig}`
}

// ─── LICENSE VALIDATION ─────────────────────────────────────────────

/**
 * Parse and verify a license key (offline — RSA signature)
 */
export function parseLicenseKey(licenseKey: string): { payload: LicensePayload | null; error?: string } {
  try {
    // Format: SACMS-{payload}.{signature}
    if (!licenseKey.startsWith("SACMS-")) {
      return { payload: null, error: "Invalid license key format" }
    }

    const keyData = licenseKey.slice(6) // Remove "SACMS-"
    const dotIndex = keyData.lastIndexOf(".")
    if (dotIndex === -1) {
      return { payload: null, error: "Invalid license key format: missing signature" }
    }

    const encodedPayload = keyData.slice(0, dotIndex)
    const encodedSig = keyData.slice(dotIndex + 1)

    const payloadStr = Buffer.from(encodedPayload, "base64url").toString("utf-8")
    const signature = Buffer.from(encodedSig, "base64url")

    // Verify RSA signature
    const publicKey = fs.readFileSync(PUBLIC_KEY_PATH, "utf-8")
    const isValid = crypto.verify("sha256", Buffer.from(payloadStr), publicKey, signature)

    if (!isValid) {
      return { payload: null, error: "Invalid license key signature" }
    }

    const payload: LicensePayload = JSON.parse(payloadStr)
    return { payload }
  } catch (err) {
    return { payload: null, error: `Failed to parse license key: ${(err as Error).message}` }
  }
}

/**
 * Check if a license is expired
 */
export function isLicenseExpired(payload: LicensePayload): boolean {
  return Date.now() > payload.exp * 1000
}

// ─── DATABASE OPERATIONS ────────────────────────────────────────────

/**
 * Fetch license from DB by key
 */
export async function getLicenseFromDb(licenseKey: string) {
  return db.enterpriseLicense.findUnique({
    where: { licenseKey },
  })
}

/**
 * Update validation timestamp
 */
export async function recordValidation(licenseKey: string) {
  await db.enterpriseLicense.update({
    where: { licenseKey },
    data: {
      lastValidatedAt: new Date(),
      validatedCount: { increment: 1 },
    },
  })
}

// ─── CACHE MANAGEMENT ───────────────────────────────────────────────

/**
 * Upsert the local license cache (per tenant)
 */
export async function upsertLicenseCache(result: LicenseResult, tenantId: string, licenseKey: string) {
  if (!result.valid || !result.expiresAt || !result.issuedAt) return

  await db.licenseCache.upsert({
    where: { id: tenantId },
    update: {
      licenseKey,
      customerName: result.customerName || "",
      customerEmail: result.customerEmail,
      type: result.type || "",
      features: result.features || [],
      issuedAt: result.issuedAt,
      expiresAt: result.expiresAt,
      lastValidatedAt: new Date(),
      status: result.status || "active",
    },
    create: {
      id: tenantId,
      licenseKey,
      customerName: result.customerName || "",
      customerEmail: result.customerEmail,
      type: result.type || "",
      features: result.features || [],
      issuedAt: result.issuedAt,
      expiresAt: result.expiresAt,
      lastValidatedAt: new Date(),
      status: result.status || "active",
    },
  })
}

/**
 * Get cached license info
 */
export async function getCachedLicense(tenantId: string): Promise<LicenseResult | null> {
  try {
    const cached = await db.licenseCache.findUnique({
      where: { id: tenantId },
    })
    if (!cached) return null

    return {
      valid: cached.status === "active" && cached.expiresAt > new Date(),
      customerName: cached.customerName,
      customerEmail: cached.customerEmail ?? undefined,
      type: cached.type,
      features: cached.features as string[],
      expiresAt: cached.expiresAt,
      issuedAt: cached.issuedAt,
      daysRemaining: Math.max(0, Math.floor((cached.expiresAt.getTime() - Date.now()) / 86400000)),
      status: cached.expiresAt < new Date() ? "expired" : "active",
    }
  } catch {
    return null
  }
}

// ─── MAIN VALIDATION FLOW ───────────────────────────────────────────

/**
 * Full license validation pipeline:
 * 1. Check local cache (still valid within 24h window)
 * 2. Online validation via license server
 * 3. Fallback to offline RSA verification
 */
export async function validateLicense(tenantId: string, providedKey?: string): Promise<LicenseResult> {
  let key = providedKey
  if (!key) {
    const cached = await db.licenseCache.findUnique({ where: { id: tenantId }, select: { licenseKey: true } })
    key = cached?.licenseKey || ""
    if (!key && tenantId !== "sacms-global") {
      const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { licenseKey: true } })
      key = tenant?.licenseKey || ""
    }
  }
  
  if (!key) {
    return { valid: false, status: "invalid", error: "No license key configured" }
  }

  // Step 1: Check cache
  const cached = await getCachedLicense(tenantId)
  if (cached?.valid && cached.status === "active") {
    return cached
  }

  // Step 2: Parse & verify offline (RSA signature)
  const { payload, error } = parseLicenseKey(key)
  if (!payload) {
    return { valid: false, status: "invalid", error: error || "Invalid license key" }
  }

  // Step 3: Check expiry
  if (isLicenseExpired(payload)) {
    return {
      valid: false,
      customerName: payload.name,
      type: payload.type,
      features: payload.features,
      expiresAt: new Date(payload.exp * 1000),
      issuedAt: new Date(payload.iat * 1000),
      daysRemaining: 0,
      status: "expired",
      error: "License key has expired",
    }
  }

  // Step 4: Online validation (optional — try license server)
  if (LICENSE_SERVER_URL) {
    try {
      const res = await fetch(`${LICENSE_SERVER_URL}/api/enterprise/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: key }),
        signal: AbortSignal.timeout(5000),
      })

      if (res.ok) {
        const data = await res.json()
        // Check if server says revoked
        if (data.status === "revoked") {
          return { valid: false, status: "revoked", error: "License has been revoked" }
        }

        const result: LicenseResult = {
          valid: data.valid !== false,
          customerName: data.customerName || payload.name,
          customerEmail: data.customerEmail || payload.email,
          organization: data.organization,
          type: data.type || payload.type,
          features: data.features || payload.features,
          expiresAt: new Date(data.expiresAt),
          issuedAt: new Date(data.issuedAt),
          daysRemaining: Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 86400000)),
          status: "active",
        }
        await upsertLicenseCache(result, tenantId, key)
        return result
      }
    } catch {
      // License server unreachable — fall through to offline validation
    }
  }

  // Step 5: Offline validation result
  const result: LicenseResult = {
    valid: true,
    customerName: payload.name,
    customerEmail: payload.email,
    organization: payload.org,
    type: payload.type,
    features: payload.features,
    expiresAt: new Date(payload.exp * 1000),
    issuedAt: new Date(payload.iat * 1000),
    daysRemaining: Math.max(0, Math.floor((payload.exp * 1000 - Date.now()) / 86400000)),
    status: "active",
  }

  await upsertLicenseCache(result, tenantId, key)
  return result
}

// ─── ENTERPRISE MODE CHECK ──────────────────────────────────────────

/**
 * Quick check: is this instance in enterprise mode?
 * Lightweight — reads cache + DB
 */
export async function isEnterpriseTenant(tenantId: string): Promise<boolean> {
  const cached = await getCachedLicense(tenantId)
  if (cached?.valid && cached.type === "enterprise") return true

  const result = await validateLicense(tenantId)
  return result.valid && result.type === "enterprise"
}

/**
 * Get all current license status (for UI)
 */
export async function getLicenseStatus(tenantId: string): Promise<LicenseResult> {
  const cached = await getCachedLicense(tenantId)
  if (cached) return cached

  return validateLicense(tenantId)
}
