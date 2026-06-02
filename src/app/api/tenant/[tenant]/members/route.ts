import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions, hashPassword } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"

const createMemberSchema = z.object({
  email: z.string().email(),
  role: z.string().default("viewer"),
  name: z.string().optional(),
  password: z.string().min(8).optional(), // Optional for invite, required for create
  customPermissions: z.array(z.string()).optional(),
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
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    // Fetch members from the tenant-specific database
    const members = await tenantDb.tenantMember.findMany({
      where: { tenantId: tenantId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true, role: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    })

    return NextResponse.json({ members })
  } catch (error) {
    console.error("Error fetching members:", error)
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
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (access.role !== "admin" && access.role !== "owner") {
      return NextResponse.json({ error: "Only admins and owners can add members" }, { status: 403 })
    }

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    // Enforce team member limit based on workspace plan
    const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
    const enforcement = await enforcePlanLimit(tenantId, "team_members")
    if (!enforcement.allowed) {
      return NextResponse.json({ 
        error: enforcement.message,
        current: enforcement.current,
        max: enforcement.max,
        plan: enforcement.planSlug,
      }, { status: 403 })
    }

    const result = await validateBody(request, createMemberSchema)
    if ("error" in result) return result.error
    const { email, role, name, password, customPermissions } = result.data

    // 1. Find or Create User in Master DB
    let user = await db.user.findUnique({ where: { email } })
    
    if (!user) {
      if (!password) {
        return NextResponse.json({ error: "User not found. Provide a password to create a new account." }, { status: 400 })
      }
      const hashedPassword = await hashPassword(password)
      user = await db.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          password: hashedPassword,
          role: "user",
          emailVerified: new Date(),
        }
      })
    }

    // 2. Sync User to dedicated DB (if isolated)
    if (tenantDb !== db) {
      console.log(`[Members] Syncing user ${email} to dedicated DB`)
      await tenantDb.user.upsert({
        where: { id: user.id },
        update: {
          email: user.email,
          name: user.name,
          password: user.password,
          role: user.role,
          image: user.image,
          emailVerified: user.emailVerified
        },
        create: {
          id: user.id,
          email: user.email,
          name: user.name,
          password: user.password,
          role: user.role,
          image: user.image,
          emailVerified: user.emailVerified
        }
      })
    }

    // 3. Check if already a member in Master DB
    const existingMember = await db.tenantMember.findFirst({
      where: { tenantId: tenantId, userId: user.id },
    })

    if (existingMember) return NextResponse.json({ error: "User is already a member" }, { status: 400 })

    // 4. Create membership in Master DB
    const member = await db.tenantMember.create({
      data: {
        tenantId: tenantId,
        userId: user.id,
        role: role,
        customPermissions: customPermissions ? customPermissions : undefined,
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    })

    // 5. Sync Membership to dedicated DB (if isolated)
    if (tenantDb !== db) {
      await tenantDb.tenantMember.upsert({
        where: {
          tenantId_userId: {
            tenantId: tenantId,
            userId: user.id
          }
        },
        update: { 
          role: role,
          customPermissions: customPermissions ? customPermissions : undefined,
        },
        create: {
          id: member.id,
          tenantId: tenantId,
          userId: user.id,
          role: role,
          customPermissions: customPermissions ? customPermissions : undefined,
        }
      })
    }

    return NextResponse.json({ member })
  } catch (error) {
    console.error("Error adding member:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
