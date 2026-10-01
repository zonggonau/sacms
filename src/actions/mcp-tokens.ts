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
