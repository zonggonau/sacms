import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"
import { randomBytes } from "crypto"
import { slugify } from "@/lib/slug"

const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  plan: z.string().optional(),
  status: z.string().optional(),
  databaseUrl: z.string().url().optional().or(z.literal("")),
})

/**
 * Generate a unique slug based on name
 */
async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = slugify(name) || "workspace"
  let slug = baseSlug
  
  const existing = await db.tenant.findUnique({ where: { slug } })
  
  if (existing) {
    const suffix = randomBytes(3).toString("hex")
    slug = `${baseSlug}-${suffix}`
    
    const secondCheck = await db.tenant.findUnique({ where: { slug } })
    if (secondCheck) return generateUniqueSlug(name)
  }
  
  return slug
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only super admin can access all tenants
    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const sort = searchParams.get("sort") || "createdAt:desc"

    const [sortField, sortOrder] = sort.split(":")
    const validSortFields = ["createdAt", "name", "plan", "status"]
    const orderBy: any = validSortFields.includes(sortField) 
      ? { [sortField]: sortOrder === "asc" ? "asc" : "desc" }
      : { createdAt: "desc" }

    const where = search ? {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { slug: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}

    const skip = (page - 1) * limit

    const [tenants, total] = await Promise.all([
      db.tenant.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          plan: true,
          databaseUrl: true,
          description: true,
          logo: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              members: true,
              contentTypeAssignments: true,
              singleTypeAssignments: true,
              componentAssignments: true,
              media: true,
              apiTokens: true,
            },
          },
          apiTokens: {
            select: {
              id: true,
              type: true,
              expiresAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          subscriptions: {
            where: { status: "active" },
            select: {
              id: true,
              plan: true,
              status: true,
              currentPeriodEnd: true,
              invoices: {
                select: {
                  id: true,
                  amount: true,
                  status: true,
                  paidAt: true,
                  createdAt: true,
                },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
            take: 1,
          },
          members: {
            select: {
              user: {
                select: { id: true, name: true, email: true },
              },
              role: true,
            },
            where: { role: "owner" },
            take: 1,
          },
        },
        orderBy,
      }),
      db.tenant.count({ where })
    ])

    return NextResponse.json({ 
      tenants,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    console.error("Error fetching tenants:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only super admin can create tenants
    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await validateBody(request, createTenantSchema)
    if ("error" in result) return result.error
    const { name, description, plan, status, databaseUrl } = result.data

    // 1. Auto-generate unique slug based on name
    const slug = await generateUniqueSlug(name)

    // 2. Create tenant and initial subscription in transaction
    const tenant = await db.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          name,
          slug,
          description: description || null,
          plan: plan || "starter",
          status: status || "active",
          databaseUrl: databaseUrl || null,
        },
      })

      // Create subscription with 7-day trial
      const trialEndDate = new Date()
      trialEndDate.setDate(trialEndDate.getDate() + 7)

      await tx.subscription.create({
        data: {
          userId: session.user.id, // Assigned to the admin who created it
          tenantId: newTenant.id,
          plan: plan || "starter",
          status: "trialing",
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndDate,
        },
      })

      return newTenant
    })

    return NextResponse.json({ tenant })
  } catch (error) {
    console.error("Error creating tenant:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
