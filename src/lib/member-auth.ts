import crypto from "crypto"
import bcrypt from "bcrypt"
import { db, getTenantDb } from "@/lib/database"

const SALT_ROUNDS = 12
const ACCESS_TOKEN_TTL_SECONDS = 60 * 15 // 15 minutes
const REFRESH_TOKEN_TTL_DAYS = 7 // 7 days

export interface MemberJwtPayload {
  sub: string // member ID
  email: string
  tenantId: string
  tenantSlug: string
  role: string
  iat: number
  exp: number
}

/**
 * Hash end-user / member password with bcrypt (12 rounds)
 */
export async function hashMemberPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Compare plaintext password with hashed password
 */
export async function verifyMemberPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false
  return bcrypt.compare(password, hash)
}

/**
 * Generate a cryptographically secure random refresh token string
 */
export function generateRefreshTokenString(): string {
  return crypto.randomBytes(32).toString("hex")
}

/**
 * Base64URL encoding helper
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

/**
 * Base64URL decoding helper
 */
function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, "+").replace(/_/g, "/")
  while (str.length % 4) {
    str += "="
  }
  return Buffer.from(str, "base64").toString("utf8")
}

/**
 * Sign JWT Access Token with HMAC-SHA256
 */
export function signMemberAccessToken(
  payload: Omit<MemberJwtPayload, "iat" | "exp">,
  secret = process.env.NEXTAUTH_SECRET || "sacms-member-jwt-secret-key"
): { token: string; expiresIn: number } {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + ACCESS_TOKEN_TTL_SECONDS

  const fullPayload: MemberJwtPayload = {
    ...payload,
    iat: now,
    exp,
  }

  const header = { alg: "HS256", typ: "JWT" }
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload))

  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")

  return {
    token: `${encodedHeader}.${encodedPayload}.${signature}`,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  }
}

/**
 * Verify JWT Access Token and decode payload
 */
export function verifyMemberAccessToken(
  token: string,
  secret = process.env.NEXTAUTH_SECRET || "sacms-member-jwt-secret-key"
): MemberJwtPayload | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null

    const [encodedHeader, encodedPayload, signature] = parts
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")

    if (signature !== expectedSignature) return null

    const payloadJson = base64UrlDecode(encodedPayload)
    const payload = JSON.parse(payloadJson) as MemberJwtPayload

    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) {
      return null // Expired
    }

    return payload
  } catch {
    return null
  }
}

/**
 * Extract and authenticate member from Request Authorization header
 */
export async function getMemberFromRequest(
  request: Request,
  tenantIdOrSlug: string
) {
  const authHeader = request.headers.get("authorization") || ""
  if (!authHeader.startsWith("Bearer ")) {
    return null
  }

  const token = authHeader.substring(7).trim()
  const payload = verifyMemberAccessToken(token)
  if (!payload) {
    return null
  }

  // Load tenant DB
  const tenantDb = (await getTenantDb(tenantIdOrSlug)) as any
  const member = await tenantDb.member.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      role: true,
      status: true,
      metadata: true,
      tenantId: true,
      createdAt: true,
      lastLoginAt: true,
    },
  })

  if (!member || member.status !== "active") {
    return null
  }

  return member
}

export { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_DAYS }
