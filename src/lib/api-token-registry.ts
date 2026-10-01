/**
 * Shared "primary API key" logic for a tenant's REST/GraphQL credential.
 *
 * A tenant may have at most one primary ApiToken (any `type` other than
 * "mcp" — MCP tokens are a separate credential managed from the MCP page).
 * Both the dashboard's Developer & API → API Keys page and the MCP server's
 * `get_or_create_api_key`/`update_api_key_permissions` tools key off this
 * same query so they agree on what "the" key is, instead of each minting
 * their own.
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

export async function findPrimaryApiToken(tenantId: string) {
  return db.apiToken.findFirst({
    where: { tenantId, type: { not: "mcp" } },
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

  const apiToken = await db.apiToken.create({
    data: {
      tenantId,
      name: DEFAULT_API_KEY_NAME,
      description: "Auto-provisioned default API key.",
      token: hashedToken,
      type: "full-access",
      permissions: ["read", "write"],
      createdBy: createdBy || null,
    },
  })

  return { apiToken, plainToken, created: true }
}

export async function updateApiTokenPermissions(
  tenantId: string,
  tokenId: string,
  permissions: unknown
): Promise<{ error: string } | { apiToken: Awaited<ReturnType<typeof db.apiToken.update>> }> {
  const token = await db.apiToken.findFirst({ where: { id: tokenId, tenantId } })
  if (!token) return { error: "API key not found" }
  if (token.type === "mcp") return { error: "MCP tokens are managed from the MCP page, not here" }

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

/**
 * Rotates the secret of the tenant's primary API key in place — same row,
 * same id/name/permissions, new `token` value. This is the only way to
 * change the key's value: a tenant may have at most one, so "I want a
 * different key" means regenerate, never create a second row.
 */
export async function regenerateApiToken(
  tenantId: string,
  tokenId: string
): Promise<{ error: string } | { apiToken: Awaited<ReturnType<typeof db.apiToken.update>>; plainToken: string }> {
  const token = await db.apiToken.findFirst({ where: { id: tokenId, tenantId } })
  if (!token) return { error: "API key not found" }
  if (token.type === "mcp") return { error: "MCP tokens are regenerated from the MCP page, not here" }

  const plainToken = generateApiKeyToken()
  const hashedToken = createHash("sha256").update(plainToken).digest("hex")

  const apiToken = await db.apiToken.update({
    where: { id: tokenId },
    data: { token: hashedToken },
  })

  return { apiToken, plainToken }
}
