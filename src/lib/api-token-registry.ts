/**
 * Shared "primary API key" logic for a tenant's REST/GraphQL credential.
 *
 * A tenant can hold several user-managed API keys (`read-only` / `full-access`),
 * created and deleted from Developer & API → API Keys. The oldest one is the
 * "primary" key the MCP server's `get_or_create_api_key` tool reports, so an
 * agent never mints duplicates. Internal tokens are excluded everywhere here:
 * the hosting deploy token (`service`), Sandbox preview tokens, and MCP tokens. (A sibling
 * `update_api_key_permissions` tool existed briefly but was removed — see
 * api/mcp/[[...transport]]/route.ts — since rotating/reconfiguring a
 * tenant's live production credential has no legitimate MCP use case.)
 */
import { db } from "@/lib/database"
import { randomBytes, createHash } from "crypto"

export const DEFAULT_API_KEY_NAME = "Default API Key"

const VALID_PERMISSIONS = ["read", "write", "delete"] as const
export type ApiKeyPermission = (typeof VALID_PERMISSIONS)[number]

export function sanitizePermissions(input: unknown): ApiKeyPermission[] {
  if (!Array.isArray(input)) return []
  const set = new Set(
    input.filter((p): p is ApiKeyPermission => VALID_PERMISSIONS.includes(p as ApiKeyPermission))
  )
  return Array.from(set)
}

export function generateApiKeyToken(): string {
  return `cf_${randomBytes(32).toString("hex")}`
}

export const USER_API_KEY_TYPES = ["read-only", "full-access"]

/** Prisma filter for the API keys a workspace admin manages by hand. */
export function userApiKeyWhere(tenantId: string) {
  // Sandbox preview tokens created before they got their own type are read-only rows named "Template preview …".
  return { tenantId, type: { in: USER_API_KEY_TYPES }, NOT: { name: { startsWith: "Template preview " } } }
}

export async function findPrimaryApiToken(tenantId: string) {
  return db.apiToken.findFirst({
    where: userApiKeyWhere(tenantId),
    orderBy: { createdAt: "asc" },
  })
}

export async function getOrCreatePrimaryApiToken(tenantId: string, createdBy?: string | null) {
  const existing = await findPrimaryApiToken(tenantId)
  if (existing) {
    return { apiToken: existing, plainToken: null as string | null, created: false }
  }

  const plainToken = generateApiKeyToken()
  const hashedToken = createHash("sha256").update(plainToken).digest("hex")

  // Default expiry: 90 days from now
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 90)

  const apiToken = await db.apiToken.create({
    data: {
      tenantId,
      name: DEFAULT_API_KEY_NAME,
      description: "Auto-provisioned default API key.",
      token: hashedToken,
      type: "full-access",
      permissions: ["read", "write"],
      createdBy: createdBy || null,
      expiresAt,
    },
  })

  return { apiToken, plainToken, created: true }
}

export async function updateApiTokenPermissions(
  tenantId: string,
  tokenId: string,
  permissions: unknown
): Promise<{ error: string } | { apiToken: Awaited<ReturnType<typeof db.apiToken.update>> }> {
  const token = await db.apiToken.findFirst({ where: { id: tokenId, ...userApiKeyWhere(tenantId) } })
  if (!token) return { error: "API key not found" }

  const perms = sanitizePermissions(permissions)
  if (perms.length === 0) return { error: "Select at least one permission" }

  const apiToken = await db.apiToken.update({
    where: { id: tokenId },
    data: {
      permissions: perms,
      type: perms.includes("write") || perms.includes("delete") ? "full-access" : "read-only",
    },
  })

  return { apiToken }
}
