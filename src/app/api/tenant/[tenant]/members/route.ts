import { NextResponse } from "next/server"
import { hashPassword } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

const createMemberSchema = z.object({
  email: z.string().email(),
  role: z.string().default("viewer"),
  name: z.string().optional(),
  password: z.string().min(8).optional(), // Optional for invite, required for create
  customPermissions: z.array(z.string()).optional(),
})

/** GET /api/tenant/[tenant]/members — list workspace staff members. */
export const GET = withStaffAuth(async (_request, context, { access }) => {
  const { tenant: tenantSlug } = await context.params
  const tenantDb = await getTenantDb(tenantSlug)

  const members = await tenantDb.tenantMember.findMany({
    where: { tenantId: access.tenantId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true, role: true } },
    },
    orderBy: { joinedAt: "asc" },
  })
  return NextResponse.json({ members })
})

/** POST /api/tenant/[tenant]/members — add a staff member (admin/owner only). */
export const POST = withStaffAuth(
  async (request, context, { access, session }) => {
    const { tenant: tenantSlug } = await context.params
    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
    const enforcement = await enforcePlanLimit(tenantId, "team_members", session.user.id)
    if (!enforcement.allowed) {
      return apiError("plan_limit", {
        message: enforcement.message,
        details: { current: enforcement.current, max: enforcement.max, plan: enforcement.planSlug },
      })
    }

    const result = await validateBody(request, createMemberSchema)
    if ("error" in result) return result.error
    const { email, role, name, password, customPermissions } = result.data

    // 1. Find or Create User in Master DB
    let user = await db.user.findUnique({ where: { email } })
    
    if (!user) {
      if (!password) {
        return apiError("validation", { message: "User not found. Provide a password to create a new account." })
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

    if (existingMember) return apiError("conflict", { message: "User is already a member" })

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
  },
  { minRole: "admin" },
)
