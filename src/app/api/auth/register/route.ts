import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { hashPassword } from "@/lib/auth"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { validateBody } from "@/lib/validate"
import { registerSchema } from "@/lib/validations"
import { randomBytes } from "crypto"
import { provisionTenant } from "@/lib/tenant-provisioning"

/**
 * Generate a random unique slug (10 chars alphanumeric)
 */
async function generateUniqueSlug(): Promise<string> {
  const slug = randomBytes(5).toString("hex") // 10 characters
  const existing = await db.tenant.findUnique({ where: { slug } })
  if (existing) return generateUniqueSlug()
  return slug
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    const rateLimitResult = await rateLimit(`auth:${ip}`, RATE_LIMITS.auth)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      )
    }

    const validationResult = await validateBody(request, registerSchema)
    if ("error" in validationResult) return validationResult.error
    const { name, email, password, tenantName } = validationResult.data

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }

    // Check if this is the first user (will be super_admin)
    const userCount = await db.user.count()
    const isFirstUser = userCount === 0

    // Hash password with bcrypt
    const hashedPassword = await hashPassword(password)

    // If first user (super_admin), create without tenant
    if (isFirstUser) {
      const user = await db.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          role: "super_admin",
        },
      })

      await logAudit({
        userId: user.id,
        action: AuditAction.REGISTER,
        entity: "User",
        entityId: user.id,
        data: { role: "super_admin", isFirstUser: true },
        ipAddress: ip,
      })

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        isFirstUser: true,
        message: "Super Admin account created successfully",
      })
    }

    // If tenantName is NOT provided, create ONLY the user
    if (!tenantName) {
      const user = await db.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          role: "user",
        },
      })

      await logAudit({
        userId: user.id,
        action: AuditAction.REGISTER,
        entity: "User",
        entityId: user.id,
        data: { role: "user", hasTenant: false },
        ipAddress: ip,
      })

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        isFirstUser: false,
        hasTenant: false,
        message: "Account created successfully. You can create a workspace after signing in.",
      })
    }

    // If tenantName IS provided, create user + tenant (legacy/optional path)
    // Auto-generate unique slug
    const tenantSlug = await generateUniqueSlug()

    // Create user, tenant, and membership in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          role: "user", 
        },
      })

      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          slug: tenantSlug,
          plan: "starter",
          status: "active",
        },
      })

      // Create tenant membership
      await tx.tenantMember.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: "owner",
        },
      })

      // Create subscription with 7-day trial
      const trialEndDate = new Date()
      trialEndDate.setDate(trialEndDate.getDate() + 7)

      await tx.subscription.create({
        data: {
          userId: user.id,
          tenantId: tenant.id,
          plan: "starter",
          status: "trialing",
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndDate,
        },
      })

      return { user, tenant }
    })

    // Provision default content types and demo data
    await provisionTenant(result.tenant.id)

    await logAudit({
      userId: result.user.id,
      tenantId: result.tenant.id,
      action: AuditAction.REGISTER,
      entity: "User",
      entityId: result.user.id,
      data: { role: "owner", tenantSlug: result.tenant.slug },
      ipAddress: ip,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
      },
      isFirstUser: false,
      message: "Account created successfully",
    })
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
