import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { randomBytes, createHash } from "crypto"
import { validateBody } from "@/lib/validate"
import { createApiTokenSchema } from "@/lib/validations"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

function generateToken(): string {
  return `cf_${randomBytes(32).toString("hex")}`
}

/** GET — list API tokens (values never returned). */
export const GET = withStaffAuth(async (_request, _context, { access }) => {
  const tokens = await db.apiToken.findMany({
    where: { tenantId: access.tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, tenantId: true, name: true, description: true, type: true,
      permissions: true, lastUsedAt: true, expiresAt: true, createdAt: true,
    },
  })

  const safeTokens = tokens.map((t) => {
    let perms = t.permissions
    if (typeof t.permissions === "string") {
      try { perms = JSON.parse(t.permissions) } catch { perms = [] }
    }
    return { ...t, permissions: Array.isArray(perms) ? perms : [] }
  })

  return NextResponse.json({ tokens: safeTokens })
})

/** POST — create an API token (admin/owner only). The plain token is shown once. */
export const POST = withStaffAuth(
  async (request, _context, { access, session }) => {
    const result = await validateBody(request, createApiTokenSchema)
    if ("error" in result) return result.error
    const { name, description, type, permissions, expiresAt } = result.data

    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      return apiError("validation", { message: "Token expiry must be in the future" })
    }

    const token = generateToken()
    const hashedToken = createHash("sha256").update(token).digest("hex")

    const apiToken = await db.apiToken.create({
      data: {
        tenantId: access.tenantId,
        name: name as string,
        description: (description as string) || null,
        token: hashedToken,
        type,
        permissions: permissions as any,
        expiresAt: expiresAt || null,
        createdBy: session.user.id,
      },
    })

    const { token: _storedHash, ...safeApiToken } = apiToken
    return NextResponse.json({
      token: {
        ...safeApiToken,
        permissions: Array.isArray(apiToken.permissions) ? apiToken.permissions : [],
      },
      plainToken: token,
    })
  },
  { minRole: "admin" },
)
