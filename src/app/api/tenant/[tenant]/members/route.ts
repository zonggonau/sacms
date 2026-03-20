import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, hashPassword } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"

const createMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "editor", "viewer"]).default("viewer"),
  name: z.string().optional(),
  password: z.string().min(8).optional(), // Optional for invite, required for create
})

// GET /api/tenant/[tenant]/members - List all members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug } = await params
    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } })
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 })

    const membership = await db.tenantMember.findFirst({
      where: { tenantId: tenant.id, userId: session.user.id },
    })
    const isSuperAdmin = session.user.role === "super_admin"
    if (!membership && !isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const members = await db.tenantMember.findMany({
      where: { tenantId: tenant.id },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true, role: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    })

    return NextResponse.json({ members })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/tenant/[tenant]/members - Add/Create new member
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug } = await params
    const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } })
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 })

    const requester = await db.tenantMember.findFirst({
      where: { tenantId: tenant.id, userId: session.user.id, role: { in: ["owner", "admin"] } },
    })
    const isSuperAdmin = session.user.role === "super_admin"
    if (!requester && !isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const result = await validateBody(request, createMemberSchema)
    if ("error" in result) return result.error
    const { email, role, name, password } = result.data

    // 1. Find or Create User
    let user = await db.user.findUnique({ where: { email } })
    
    if (!user) {
      if (!password) {
        return NextResponse.json({ error: "User not found. Provide a password to create a new user account." }, { status: 400 })
      }
      // Create a new platform user
      const hashedPassword = await hashPassword(password)
      user = await db.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          password: hashedPassword,
          role: "user", // Default platform role
        }
      })
    }

    // 2. Check if already a member
    const existingMember = await db.tenantMember.findFirst({
      where: { tenantId: tenant.id, userId: user.id },
    })

    if (existingMember) return NextResponse.json({ error: "User is already a member" }, { status: 400 })

    // 3. Link to tenant
    const member = await db.tenantMember.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role: role,
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    })

    return NextResponse.json({ member })
  } catch (error) {
    console.error("Error adding member:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
