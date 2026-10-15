import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { createUserSchema } from "@/lib/validations"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"
import { logAudit, AuditAction } from "@/lib/audit-log"

// GET /api/admin/users - list account owners & platform admins
export const GET = withAdminAuth(
  async (request) => {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "24")
    const search = searchParams.get("search")

    // Must list every real account holder, regular "user" role included —
    // not just literal tenant-owners. Workspaces auto-created before an
    // earlier provisioning fix gave the registering user only an "admin"
    // TenantMember row (a super_admin service account held "owner"
    // instead), so restricting this to `role: "owner"` silently hid every
    // one of them. `admin` is included below for that reason, not to
    // widen this into a general team-member directory — someone merely
    // invited as "author"/"contributor" into someone else's workspace
    // still won't match.
    const ownerFilter = {
      OR: [
        { role: { in: ["super_admin", "owner", "admin", "developer", "user"] } },
        { tenants: { some: { role: { in: ["owner", "admin"] } } } },
        { tenants: { none: {} } },
      ],
    }
    const where: any = { AND: [ownerFilter] }
    if (search) {
      where.AND.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      })
    }

    // Dashboard stat cards (super admin / account owner / has-a-workspace
    // counts) used to be computed client-side from `.filter()` over just
    // the current 10-row page — correct on page 1, wrong everywhere else.
    // Computed here over the full result set matching the same `where`
    // (so they stay consistent with the active search, like `total` does).
    const [total, users, superAdminCount, accountOwnerCount, withWorkspaceCount] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        select: {
          id: true, email: true, name: true, role: true, plan: true,
          image: true, emailVerified: true, createdAt: true,
          tenants: {
            include: { tenant: { select: { id: true, name: true, slug: true, plan: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where: { AND: [...where.AND, { role: "super_admin" }] } }),
      db.user.count({ where: { AND: [...where.AND, { role: { notIn: ["super_admin", "developer"] } }] } }),
      db.user.count({ where: { AND: [...where.AND, { tenants: { some: {} } }] } }),
    ])

    return NextResponse.json({
      users,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      stats: { superAdminCount, accountOwnerCount, withWorkspaceCount },
    })
  },
  { allowRoles: ["admin"] },
)

/** Roles a plain platform admin may create. `super_admin` and `developer`
 *  (cross-tenant platform staff — see lib/platform-roles.ts) are super_admin-only. */
const ADMIN_CREATABLE_ROLES = new Set(["owner", "user", "admin", "employee", "karyawan"])

// POST /api/admin/users - create a user
export const POST = withAdminAuth(
  async (request, _context, { session }) => {
    const result = await validateBody(request, createUserSchema)
    if ("error" in result) return result.error
    const { name, email, password, requireVerification = true } = result.data
    const requestedRole = result.data.role || "owner"

    const isSuperAdmin = session.user.role === "super_admin"
    if (requestedRole === "super_admin" && !isSuperAdmin) {
      return apiError("forbidden", { message: "Only a super admin can create a super admin account" })
    }
    if (!isSuperAdmin && !ADMIN_CREATABLE_ROLES.has(requestedRole)) {
      return apiError("forbidden", { message: "You cannot create a user with that role" })
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) return apiError("conflict", { message: "User with this email already exists" })

    const { hashPassword } = await import("@/lib/auth")
    const hashedPassword = password ? await hashPassword(password) : null

    const user = await db.user.create({
      data: {
        email,
        name: name || null,
        role: requestedRole,
        password: hashedPassword,
        emailVerified: requireVerification ? null : new Date(),
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    })

    logAudit({
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "User",
      entityId: user.id,
      data: { targetEmail: user.email, targetRole: user.role, createdByAdmin: true },
    })

    return NextResponse.json({ user })
  },
  { allowRoles: ["admin"] },
)
