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
