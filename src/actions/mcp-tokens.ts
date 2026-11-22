"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { randomBytes, createHash } from "crypto"
import { getTenantAccess } from "@/lib/tenant-access"
import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import { GLOBAL_MCP_SCOPES, resolveGlobalMcpScopes } from "@/lib/mcp-global-scopes"

function generateMcpToken(): string {
  return `mcp_${randomBytes(24).toString("hex")}`
}

function generateGlobalSchemaMcpToken(): string {
  return `mcpglobal_${randomBytes(24).toString("hex")}`
}

/**
 * A tenant may have at most one MCP token — separate from, and not
 * interchangeable with, the REST/GraphQL API key managed from
 * src/lib/api-token-registry.ts (see api/mcp/[[...transport]]/route.ts's
 * resolveToken(), which now only accepts type "mcp" rows).
 */
async function findMcpToken(tenantId: string) {
  return db.apiToken.findFirst({
    where: { tenantId, type: "mcp" },
    orderBy: { createdAt: "asc" },
  })
}

const createMcpTokenSchema = z.object({
  name: z.string().trim().min(1, "Nama token wajib diisi").max(100),
  description: z.string().trim().max(500).optional(),
})

export async function getMcpTokensAction(tenantSlug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden or Tenant not found" }

    const tokens = await db.apiToken.findMany({
      where: {
        tenantId: access.tenantId,
        OR: [
          { type: "mcp" },
          { name: { contains: "MCP", mode: "insensitive" } },
          { description: { contains: "MCP", mode: "insensitive" } }
        ]
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        tenantId: true,
        name: true,
        description: true,
        type: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        token: true,
      },
    })

    return {
      tokens: tokens.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        type: t.type,
        createdAt: t.createdAt.toISOString(),
        lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
        expiresAt: t.expiresAt ? t.expiresAt.toISOString() : null,
        isExpired: t.expiresAt ? t.expiresAt < new Date() : false,
      }))
    }
  } catch (error) {
    console.error("Error fetching MCP tokens:", error)
    return { error: "Internal server error" }
  }
}

export async function createMcpTokenAction(
  tenantSlug: string,
  data: z.infer<typeof createMcpTokenSchema>
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden or Tenant not found" }

    if (access.role !== "admin" && access.role !== "owner" && session.user.role !== "super_admin") {
      return { error: "Hanya Admin dan Owner yang dapat membuat token MCP" }
    }

    // Only one MCP token is allowed per tenant — create once, then use
    // regenerateMcpTokenAction to rotate its secret instead of minting
    // another one.
    const existing = await findMcpToken(access.tenantId)
    if (existing) {
      return { error: "Workspace ini sudah memiliki token MCP aktif. Generate ulang token yang ada, atau hapus dulu sebelum membuat yang baru." }
    }

    const parsed = createMcpTokenSchema.safeParse(data)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Validasi gagal" }
    }

    const { name, description } = parsed.data
    const token = generateMcpToken()
    const hashedToken = createHash("sha256").update(token).digest("hex")
    // Default expiry: 90 days from now
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 90)

    const mcpToken = await db.apiToken.create({
      data: {
        tenantId: access.tenantId,
        name: name.trim(),
        description: description?.trim() || "MCP Server Integration Token",
        token: hashedToken,
        type: "mcp",
        permissions: ["read", "write", "delete", "schema", "webhooks", "mcp"],
        createdBy: session.user.id,
        expiresAt,
      },
    })

    revalidatePath(`/dashboard/${tenantSlug}/developer/mcp`)

    return {
      success: true,
      plainToken: token,
      token: {
        id: mcpToken.id,
        name: mcpToken.name,
        description: mcpToken.description,
        type: mcpToken.type,
        createdAt: mcpToken.createdAt.toISOString(),
        lastUsedAt: null,
        expiresAt: mcpToken.expiresAt ? mcpToken.expiresAt.toISOString() : null,
      }
    }
  } catch (error) {
    console.error("Error creating MCP token:", error)
    return { error: "Internal server error" }
  }
}

export async function regenerateMcpTokenAction(tenantSlug: string, tokenId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden or Tenant not found" }

    if (access.role !== "admin" && access.role !== "owner" && session.user.role !== "super_admin") {
      return { error: "Hanya Admin dan Owner yang dapat generate ulang token MCP" }
    }

    const token = await db.apiToken.findFirst({
      where: { id: tokenId, tenantId: access.tenantId, type: "mcp" },
    })
    if (!token) return { error: "Token MCP tidak ditemukan" }

    const plainToken = generateMcpToken()
    const hashedToken = createHash("sha256").update(plainToken).digest("hex")

    const updated = await db.apiToken.update({
      where: { id: tokenId },
      data: { token: hashedToken },
    })

    revalidatePath(`/dashboard/${tenantSlug}/developer/mcp`)

    return {
      success: true,
      plainToken,
      token: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        type: updated.type,
        createdAt: updated.createdAt.toISOString(),
        lastUsedAt: updated.lastUsedAt ? updated.lastUsedAt.toISOString() : null,
      }
    }
  } catch (error) {
    console.error("Error regenerating MCP token:", error)
    return { error: "Internal server error" }
  }
}

export async function deleteMcpTokenAction(tenantSlug: string, tokenId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden or Tenant not found" }

    if (access.role !== "admin" && access.role !== "owner" && session.user.role !== "super_admin") {
      return { error: "Hanya Admin dan Owner yang dapat menghapus token MCP" }
    }

    const token = await db.apiToken.findFirst({
      where: {
        id: tokenId,
        tenantId: access.tenantId,
      },
    })

    if (!token) return { error: "Token MCP tidak ditemukan" }

    await db.apiToken.delete({
      where: { id: tokenId },
    })

    revalidatePath(`/dashboard/${tenantSlug}/developer/mcp`)

    return { success: true }
  } catch (error) {
    console.error("Error deleting MCP token:", error)
    return { error: "Internal server error" }
  }
}

// ─── Platform "Schema Template" MCP tokens ─────────────────────────────────
// A completely separate token type/server (src/app/api/mcp/global-schema)
// from the regular per-workspace "mcp" token above — authenticates against
// the Website/Schema Template catalog, which has no tenant owner at all
// (see prisma/schema.prisma), so these tokens are stored with tenantId: null.
// Gated directly on the platform super_admin role instead of tenant
// membership. Several may exist, each with its own scopes (see
// src/lib/mcp-global-scopes.ts) and optional expiry — e.g. a read-only
// token for one agent and a full one for another.

const createGlobalMcpTokenSchema = z.object({
  name: z.string().trim().min(1, "Nama token wajib diisi").max(100),
  description: z.string().trim().max(500).optional(),
  scopes: z.array(z.enum(GLOBAL_MCP_SCOPES)).min(1, "Pilih minimal satu cakupan"),
  expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
})

function serializeGlobalMcpToken(token: { id: string; name: string; description: string | null; createdAt: Date; lastUsedAt: Date | null; expiresAt: Date | null; permissions: unknown }) {
  return {
    id: token.id,
    name: token.name,
    description: token.description,
    scopes: resolveGlobalMcpScopes(token.permissions),
    createdAt: token.createdAt.toISOString(),
    lastUsedAt: token.lastUsedAt ? token.lastUsedAt.toISOString() : null,
    expiresAt: token.expiresAt ? token.expiresAt.toISOString() : null,
  }
}

async function requirePlatformSuperAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { session: null, error: "Unauthorized" as const }
  if (session.user.role !== "super_admin") return { session: null, error: "Hanya Super Admin yang dapat mengelola token ini" as const }
  return { session, error: null }
}

export async function getGlobalSchemaMcpTokensAction() {
  const { error } = await requirePlatformSuperAdmin()
  if (error) return { error }

  try {
    const tokens = await db.apiToken.findMany({
      where: { tenantId: null, type: "mcp-global-schema" },
      orderBy: { createdAt: "asc" },
    })
    return { tokens: tokens.map(serializeGlobalMcpToken) }
  } catch (error) {
    console.error("Error fetching Schema Template MCP tokens:", error)
    return { error: "Internal server error" }
  }
}

export async function createGlobalSchemaMcpTokenAction(
  data: z.infer<typeof createGlobalMcpTokenSchema>,
) {
  const { session, error } = await requirePlatformSuperAdmin()
  if (error) return { error }

  try {
    const parsed = createGlobalMcpTokenSchema.safeParse(data)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Validasi gagal" }
    }

    const { name, description, scopes, expiresInDays } = parsed.data
    const token = generateGlobalSchemaMcpToken()
    const hashedToken = createHash("sha256").update(token).digest("hex")

    const mcpToken = await db.apiToken.create({
      data: {
        tenantId: null,
        name: name.trim(),
        description: description?.trim() || "SaCMS Schema Template MCP Token",
        token: hashedToken,
        type: "mcp-global-schema",
        permissions: resolveGlobalMcpScopes(scopes),
        expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null,
        createdBy: session!.user.id,
      },
    })

    revalidatePath("/admin/developer/mcp")

    return {
      success: true,
      plainToken: token,
      token: serializeGlobalMcpToken(mcpToken),
    }
  } catch (error) {
    console.error("Error creating Schema Template MCP token:", error)
    return { error: "Internal server error" }
  }
}

export async function regenerateGlobalSchemaMcpTokenAction(tokenId: string) {
  const { error } = await requirePlatformSuperAdmin()
  if (error) return { error }

  try {
    const token = await db.apiToken.findFirst({
      where: { id: tokenId, tenantId: null, type: "mcp-global-schema" },
    })
    if (!token) return { error: "Token Schema Template MCP tidak ditemukan" }

    const plainToken = generateGlobalSchemaMcpToken()
    const hashedToken = createHash("sha256").update(plainToken).digest("hex")

    const updated = await db.apiToken.update({
      where: { id: tokenId },
      data: { token: hashedToken },
    })

    revalidatePath("/admin/developer/mcp")

    return {
      success: true,
      plainToken,
      token: serializeGlobalMcpToken(updated),
    }
  } catch (error) {
    console.error("Error regenerating Schema Template MCP token:", error)
    return { error: "Internal server error" }
  }
}

export async function deleteGlobalSchemaMcpTokenAction(tokenId: string) {
  const { error } = await requirePlatformSuperAdmin()
  if (error) return { error }

  try {
    const token = await db.apiToken.findFirst({
      where: { id: tokenId, tenantId: null, type: "mcp-global-schema" },
    })
    if (!token) return { error: "Token Schema Template MCP tidak ditemukan" }

    await db.apiToken.delete({ where: { id: tokenId } })

    revalidatePath("/admin/developer/mcp")

    return { success: true }
  } catch (error) {
    console.error("Error deleting Schema Template MCP token:", error)
    return { error: "Internal server error" }
  }
}
