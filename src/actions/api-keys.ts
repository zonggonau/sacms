"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { randomBytes } from "crypto"
import { getTenantAccess } from "@/lib/tenant-access"
import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import { createHash } from "crypto"

function generateToken(): string {
  return `cf_${randomBytes(32).toString("hex")}`
}

const createApiTokenSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).optional(),
  type: z.enum(["read-only", "full-access"]).default("read-only"),
  permissions: z.array(z.string().min(1)).max(100).default([]),
  expiresAt: z.string().datetime().optional(),
})

export async function getApiTokensAction(tenantSlug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden or Tenant not found" }

    const tokens = await db.apiToken.findMany({
      where: { tenantId: access.tenantId },
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

    const safeTokens = tokens.map((t) => {
      let perms = t.permissions
      if (typeof t.permissions === 'string') {
        try { perms = JSON.parse(t.permissions) } catch { perms = [] }
      }
      return {
        ...t,
        permissions: Array.isArray(perms) ? perms : [],
      }
    })

    return { tokens: safeTokens }
  } catch (error) {
    console.error("Error fetching API tokens:", error)
    return { error: "Internal server error" }
  }
}

export async function createApiTokenAction(tenantSlug: string, data: z.infer<typeof createApiTokenSchema>) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden or Tenant not found" }

    if (access.role !== "admin" && access.role !== "owner") {
      return { error: "Only tenant admins and owners can create API tokens" }
    }

    const parsed = createApiTokenSchema.safeParse(data)
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Validation failed" }
    }
    const { name, description, type, permissions, expiresAt } = parsed.data

    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      return { error: "Token expiry must be in the future" }
    }

    const token = generateToken()
    const hashedToken = createHash("sha256").update(token).digest("hex")
    
    const apiToken = await db.apiToken.create({
      data: {
        tenantId: access.tenantId,
        name: name,
        description: description || null,
        token: hashedToken,
        type,
        permissions: permissions as any,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: session.user.id,
      },
    })
    
    revalidatePath(`/dashboard/${tenantSlug}/api-keys`)

    const { token: _storedHash, ...safeApiToken } = apiToken

    return {
      token: {
        ...safeApiToken,
        permissions: Array.isArray(apiToken.permissions) ? apiToken.permissions : []
      },
      plainToken: token
    }
  } catch (error) {
    console.error("Error creating API token:", error)
    return { error: "Internal server error" }
  }
}

export async function deleteApiTokenAction(tenantSlug: string, tokenId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden or Tenant not found" }

    if (access.role !== "admin" && access.role !== "owner") {
      return { error: "Only tenant admins and owners can delete API tokens" }
    }

    const token = await db.apiToken.findFirst({
      where: {
        id: tokenId,
        tenantId: access.tenantId,
      },
    })

    if (!token) return { error: "API token not found" }

    await db.apiToken.delete({
      where: { id: tokenId },
    })

    revalidatePath(`/dashboard/${tenantSlug}/api-keys`)

    return { success: true }
  } catch (error) {
    console.error("Error deleting API token:", error)
    return { error: "Internal server error" }
  }
}
