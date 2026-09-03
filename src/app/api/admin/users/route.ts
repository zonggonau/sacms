import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { createUserSchema } from "@/lib/validations"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"

// GET /api/admin/users - list account owners & platform admins
export const GET = withAdminAuth(
  async (request) => {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "24")
    const search = searchParams.get("search")

    const ownerFilter = {
      OR: [
        { role: { in: ["super_admin", "owner", "admin"] } },
        { tenants: { some: { role: "owner" } } },
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

    const [total, users] = await Promise.all([
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
    ])

    return NextResponse.json({
      users,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    })
  },
  { allowRoles: ["admin"] },
)

/** Roles a plain platform admin may create. `super_admin` is super_admin-only. */
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
    return NextResponse.json({ user })
  },
  { allowRoles: ["admin"] },
)
