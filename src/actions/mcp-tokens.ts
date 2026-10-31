"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { randomBytes, createHash } from "crypto"
import { getTenantAccess } from "@/lib/tenant-access"
import { revalidatePath } from "next/cache"
import { z } from "zod/v4"

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

    const mcpToken = await db.apiToken.create({
      data: {
        tenantId: access.tenantId,
        name: name.trim(),
        description: description?.trim() || "MCP Server Integration Token",
        token: hashedToken,
        type: "mcp",
        permissions: ["read", "write", "delete", "schema", "webhooks", "mcp"],
        createdBy: session.user.id,
      },
    })

    revalidatePath(`/dashboard/${tenantSlug}/developer/api-keys`)

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

    revalidatePath(`/dashboard/${tenantSlug}/developer/api-keys`)

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

    revalidatePath(`/dashboard/${tenantSlug}/developer/api-keys`)

    return { success: true }
  } catch (error) {
    console.error("Error deleting MCP token:", error)
    return { error: "Internal server error" }
  }
}

// ─── SaCMS Global — Schema Template MCP token ──────────────────────────────
// A completely separate token type/server (src/app/api/mcp/global-schema)
// from the regular per-workspace "mcp" token above — only ever issuable
// from the SaCMS Global workspace itself (access.isGlobal), and only one
// active at a time, same single-token-per-scope pattern as findMcpToken.

async function findGlobalSchemaMcpToken(tenantId: string) {
  return db.apiToken.findFirst({
    where: { tenantId, type: "mcp-global-schema" },
    orderBy: { createdAt: "asc" },
  })
}

export async function getGlobalSchemaMcpTokenAction(tenantSlug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden or Tenant not found" }
    if (!access.isGlobal) return { error: "Hanya workspace SaCMS Global yang memiliki token ini" }

    const token = await findGlobalSchemaMcpToken(access.tenantId)
    if (!token) return { token: null }

    return {
      token: {
        id: token.id,
        name: token.name,
        description: token.description,
        createdAt: token.createdAt.toISOString(),
        lastUsedAt: token.lastUsedAt ? token.lastUsedAt.toISOString() : null,
      },
    }
  } catch (error) {
    console.error("Error fetching Global Schema Template MCP token:", error)
    return { error: "Internal server error" }
  }
}

export async function createGlobalSchemaMcpTokenAction(
  tenantSlug: string,
  data: z.infer<typeof createMcpTokenSchema>,
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden or Tenant not found" }
    if (!access.isGlobal) return { error: "Hanya workspace SaCMS Global yang dapat membuat token ini" }

    if (access.role !== "admin" && access.role !== "owner" && session.user.role !== "super_admin") {
      return { error: "Hanya Admin dan Owner yang dapat membuat token Schema Template MCP" }
    }

    const existing = await findGlobalSchemaMcpToken(access.tenantId)
    if (existing) {
      return { error: "Sudah ada token Schema Template MCP aktif. Generate ulang token yang ada, atau hapus dulu sebelum membuat yang baru." }
    }

    const parsed = createMcpTokenSchema.safeParse(data)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Validasi gagal" }
    }

    const { name, description } = parsed.data
    const token = generateGlobalSchemaMcpToken()
    const hashedToken = createHash("sha256").update(token).digest("hex")

    const mcpToken = await db.apiToken.create({
      data: {
        tenantId: access.tenantId,
        name: name.trim(),
        description: description?.trim() || "SaCMS Global Schema Template MCP Token",
        token: hashedToken,
        type: "mcp-global-schema",
        permissions: ["schema-template"],
        createdBy: session.user.id,
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
        createdAt: mcpToken.createdAt.toISOString(),
        lastUsedAt: null,
      },
    }
  } catch (error) {
    console.error("Error creating Global Schema Template MCP token:", error)
    return { error: "Internal server error" }
  }
}

export async function regenerateGlobalSchemaMcpTokenAction(tenantSlug: string, tokenId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden or Tenant not found" }
    if (!access.isGlobal) return { error: "Hanya workspace SaCMS Global yang memiliki token ini" }

    if (access.role !== "admin" && access.role !== "owner" && session.user.role !== "super_admin") {
      return { error: "Hanya Admin dan Owner yang dapat generate ulang token Schema Template MCP" }
    }

    const token = await db.apiToken.findFirst({
      where: { id: tokenId, tenantId: access.tenantId, type: "mcp-global-schema" },
    })
    if (!token) return { error: "Token Schema Template MCP tidak ditemukan" }

    const plainToken = generateGlobalSchemaMcpToken()
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
        createdAt: updated.createdAt.toISOString(),
        lastUsedAt: updated.lastUsedAt ? updated.lastUsedAt.toISOString() : null,
      },
    }
  } catch (error) {
    console.error("Error regenerating Global Schema Template MCP token:", error)
    return { error: "Internal server error" }
  }
}

export async function deleteGlobalSchemaMcpTokenAction(tenantSlug: string, tokenId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden or Tenant not found" }
    if (!access.isGlobal) return { error: "Hanya workspace SaCMS Global yang memiliki token ini" }

    if (access.role !== "admin" && access.role !== "owner" && session.user.role !== "super_admin") {
      return { error: "Hanya Admin dan Owner yang dapat menghapus token Schema Template MCP" }
    }

    const token = await db.apiToken.findFirst({
      where: { id: tokenId, tenantId: access.tenantId, type: "mcp-global-schema" },
    })
    if (!token) return { error: "Token Schema Template MCP tidak ditemukan" }

    await db.apiToken.delete({ where: { id: tokenId } })

    revalidatePath(`/dashboard/${tenantSlug}/developer/mcp`)

    return { success: true }
  } catch (error) {
    console.error("Error deleting Global Schema Template MCP token:", error)
    return { error: "Internal server error" }
  }
}
