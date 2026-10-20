"use server"

/**
 * Owner-level MCP token management — a separate, account-wide credential
 * from the per-workspace MCP token (src/actions/mcp-tokens.ts). At most one
 * per account, same "create once, regenerate to rotate" convention. See
 * prisma/schema.prisma's OwnerApiToken model for why this is its own table
 * rather than a nullable-tenantId ApiToken row.
 */
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { randomBytes, createHash } from "crypto"
import { revalidatePath } from "next/cache"
import { z } from "zod/v4"

function generateOwnerMcpToken(): string {
  // "owner_mcp_" prefix, visually distinct from a workspace's "mcp_"
  // token — this one can act on every workspace the account owns/admins,
  // not just one, so it should never be mistaken for the narrower kind.
  return `owner_mcp_${randomBytes(24).toString("hex")}`
}

async function findOwnerToken(userId: string) {
  return db.ownerApiToken.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } })
}

const createOwnerTokenSchema = z.object({
  name: z.string().trim().min(1, "Nama token wajib diisi").max(100),
  description: z.string().trim().max(500).optional(),
})

export async function getOwnerMcpTokenAction() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const token = await findOwnerToken(session.user.id)
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
    console.error("Error fetching owner MCP token:", error)
    return { error: "Internal server error" }
  }
}

export async function createOwnerMcpTokenAction(data: z.infer<typeof createOwnerTokenSchema>) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const existing = await findOwnerToken(session.user.id)
    if (existing) {
      return { error: "Akun ini sudah memiliki token MCP Owner aktif. Generate ulang token yang ada, atau hapus dulu sebelum membuat yang baru." }
    }

    const parsed = createOwnerTokenSchema.safeParse(data)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Validasi gagal" }
    }

    const { name, description } = parsed.data
    const plainToken = generateOwnerMcpToken()
    const hashedToken = createHash("sha256").update(plainToken).digest("hex")

    const token = await db.ownerApiToken.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        description: description?.trim() || "Owner MCP Server — akses ke seluruh workspace akun ini",
        token: hashedToken,
      },
    })

    revalidatePath("/dashboard/developer/mcp")

    return {
      success: true,
      plainToken,
      token: {
        id: token.id,
        name: token.name,
        description: token.description,
        createdAt: token.createdAt.toISOString(),
        lastUsedAt: null,
      },
    }
  } catch (error) {
    console.error("Error creating owner MCP token:", error)
    return { error: "Internal server error" }
  }
}

export async function regenerateOwnerMcpTokenAction(tokenId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const token = await db.ownerApiToken.findFirst({ where: { id: tokenId, userId: session.user.id } })
    if (!token) return { error: "Token MCP Owner tidak ditemukan" }

    const plainToken = generateOwnerMcpToken()
    const hashedToken = createHash("sha256").update(plainToken).digest("hex")

    const updated = await db.ownerApiToken.update({ where: { id: tokenId }, data: { token: hashedToken } })

    revalidatePath("/dashboard/developer/mcp")

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
    console.error("Error regenerating owner MCP token:", error)
    return { error: "Internal server error" }
  }
}

export async function deleteOwnerMcpTokenAction(tokenId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const token = await db.ownerApiToken.findFirst({ where: { id: tokenId, userId: session.user.id } })
    if (!token) return { error: "Token MCP Owner tidak ditemukan" }

    await db.ownerApiToken.delete({ where: { id: tokenId } })

    revalidatePath("/dashboard/developer/mcp")

    return { success: true }
  } catch (error) {
    console.error("Error deleting owner MCP token:", error)
    return { error: "Internal server error" }
  }
}
