import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db, getTenantDb } from "@/lib/database"
import { 
  verifyMemberAccessToken, 
  hashMemberPassword, 
  verifyMemberPassword 
} from "@/lib/member-auth"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

const UpdateProfileSchema = z.object({
  name: z.string().optional(),
  avatar: z.string().url().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, "Password baru minimal 6 karakter").optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: tenantSlug } = await params
    const authHeader = request.headers.get("authorization") || ""
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid Bearer token" }, { status: 401, headers: CORS_HEADERS })
    }

    const token = authHeader.substring(7).trim()
    const payload = verifyMemberAccessToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired access token" }, { status: 401, headers: CORS_HEADERS })
    }

    const tenantDb = (await getTenantDb(tenantSlug)) as any
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
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      }
    })

    if (!member || member.status !== "active") {
      return NextResponse.json({ error: "Member not found or inactive" }, { status: 404, headers: CORS_HEADERS })
    }

    return NextResponse.json({ user: member }, { status: 200, headers: CORS_HEADERS })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch profile" }, { status: 500, headers: CORS_HEADERS })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: tenantSlug } = await params
    const authHeader = request.headers.get("authorization") || ""
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid Bearer token" }, { status: 401, headers: CORS_HEADERS })
    }

    const token = authHeader.substring(7).trim()
    const payload = verifyMemberAccessToken(token)
    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired access token" }, { status: 401, headers: CORS_HEADERS })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = UpdateProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const tenantDb = (await getTenantDb(tenantSlug)) as any
    const member = await tenantDb.member.findUnique({
      where: { id: payload.sub }
    })

    if (!member || member.status !== "active") {
      return NextResponse.json({ error: "Member not found or inactive" }, { status: 404, headers: CORS_HEADERS })
    }

    const updateData: Record<string, any> = {}

    if (parsed.data.name !== undefined) updateData.name = parsed.data.name
    if (parsed.data.avatar !== undefined) updateData.avatar = parsed.data.avatar
    if (parsed.data.metadata !== undefined) {
      updateData.metadata = {
        ...((member.metadata as Record<string, any>) || {}),
        ...parsed.data.metadata
      }
    }

    // Password change flow
    if (parsed.data.newPassword) {
      if (!parsed.data.currentPassword) {
        return NextResponse.json(
          { error: "Password saat ini wajib diisi untuk mengganti password" },
          { status: 400, headers: CORS_HEADERS }
        )
      }

      const isCurrentValid = await verifyMemberPassword(parsed.data.currentPassword, member.passwordHash)
      if (!isCurrentValid) {
        return NextResponse.json(
          { error: "Password saat ini salah" },
          { status: 400, headers: CORS_HEADERS }
        )
      }

      updateData.passwordHash = await hashMemberPassword(parsed.data.newPassword)
    }

    const updated = await tenantDb.member.update({
      where: { id: member.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        status: true,
        metadata: true,
        updatedAt: true,
      }
    })

    return NextResponse.json(
      { message: "Profil berhasil diperbarui", user: updated },
      { status: 200, headers: CORS_HEADERS }
    )
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Gagal memperbarui profil" }, { status: 500, headers: CORS_HEADERS })
  }
}
