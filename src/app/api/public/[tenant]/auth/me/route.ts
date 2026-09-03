import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getTenantDb } from "@/lib/database"
import { hashMemberPassword, verifyMemberPassword } from "@/lib/member-auth"
import { authCorsPreflight } from "@/lib/member-auth-cors"
import { resolveMemberRequest } from "@/lib/member-request"

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params
  return authCorsPreflight(request, tenant)
}

const UpdateProfileSchema = z.object({
  name: z.string().max(120).optional(),
  avatar: z.string().url().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Password baru minimal 8 karakter").max(128).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  try {
    const { tenant: tenantSlug } = await params
    const auth = await resolveMemberRequest(request, tenantSlug)
    if (!auth.ok) return auth.response

    const tenantDb = (await getTenantDb(auth.tenant.slug)) as any
    const member = await tenantDb.member.findUnique({
      where: { id: auth.payload.sub },
      select: {
        id: true, email: true, name: true, avatar: true, role: true, status: true,
        metadata: true, createdAt: true, updatedAt: true, lastLoginAt: true,
      },
    })
    if (!member || member.status !== "active") {
      return NextResponse.json({ error: "Member not found or inactive" }, { status: 404, headers: auth.cors })
    }

    return NextResponse.json({ user: member }, { status: 200, headers: auth.cors })
  } catch (error) {
    console.error("[public-auth/me]", error)
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  try {
    const { tenant: tenantSlug } = await params
    const auth = await resolveMemberRequest(request, tenantSlug)
    if (!auth.ok) return auth.response

    const body = await request.json().catch(() => ({}))
    const parsed = UpdateProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400, headers: auth.cors },
      )
    }

    const tenantDb = (await getTenantDb(auth.tenant.slug)) as any
    const member = await tenantDb.member.findUnique({ where: { id: auth.payload.sub } })
    if (!member || member.status !== "active") {
      return NextResponse.json({ error: "Member not found or inactive" }, { status: 404, headers: auth.cors })
    }

    const updateData: Record<string, any> = {}
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name
    if (parsed.data.avatar !== undefined) updateData.avatar = parsed.data.avatar
    if (parsed.data.metadata !== undefined) {
      updateData.metadata = {
        ...((member.metadata as Record<string, any>) || {}),
        ...parsed.data.metadata,
      }
    }

    if (parsed.data.newPassword) {
      if (!parsed.data.currentPassword) {
        return NextResponse.json(
          { error: "Password saat ini wajib diisi untuk mengganti password" },
          { status: 400, headers: auth.cors },
        )
      }
      const isCurrentValid = await verifyMemberPassword(parsed.data.currentPassword, member.passwordHash)
      if (!isCurrentValid) {
        return NextResponse.json({ error: "Password saat ini salah" }, { status: 400, headers: auth.cors })
      }
      updateData.passwordHash = await hashMemberPassword(parsed.data.newPassword)
      // A password change invalidates other sessions.
      await tenantDb.memberSession.deleteMany({ where: { memberId: member.id } })
    }

    const updated = await tenantDb.member.update({
      where: { id: member.id },
      data: updateData,
      select: {
        id: true, email: true, name: true, avatar: true, role: true,
        status: true, metadata: true, updatedAt: true,
      },
    })

    return NextResponse.json(
      { message: "Profil berhasil diperbarui", user: updated },
      { status: 200, headers: auth.cors },
    )
  } catch (error) {
    console.error("[public-auth/me]", error)
    return NextResponse.json({ error: "Gagal memperbarui profil" }, { status: 500 })
  }
}
