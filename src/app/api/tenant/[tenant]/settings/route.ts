import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { updateTenantSettingsSchema } from "@/lib/validations"
import { Prisma } from "@prisma/client"
import { isEnterpriseTenant } from "@/lib/license"

// GET /api/tenant/[tenant]/settings - Get tenant settings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug } = await params

    // Get tenant
    const tenant = await db.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
      include: {
        subscriptions: {
          where: { status: { in: ["active", "trialing"] } },
          orderBy: { currentPeriodEnd: "desc" },
          take: 1
        }
      }
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    // Check access
    const membership = await db.tenantMember.findFirst({
      where: {
        tenantId: tenant.id,
        userId: session.user.id,
      },
    })

    const isSuperAdmin = session.user.role === "super_admin"
    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get tenant settings from Setting model
    const settings = await db.setting.findMany({
      where: {
        OR: [
          { tenantId: tenant.id },
          { tenantId: null }, // Global defaults
        ],
      },
    })

    // Build settings object
    const settingsMap: Record<string, string> = {}
    settings.forEach((s) => {
      settingsMap[s.key] = s.value
    })

    const sub = tenant.subscriptions[0]
    let daysRemaining: number | null = null
    
    if (sub?.currentPeriodEnd) {
      const diff = new Date(sub.currentPeriodEnd).getTime() - Date.now()
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
    }

    let isEnterprise = await isEnterpriseTenant("sacms-global", session.user.id)
    if (!isEnterprise) {
      isEnterprise = await isEnterpriseTenant(tenant.id, session.user.id)
    }

    return NextResponse.json({
      settings: {
        name: tenant.name,
        description: tenant.description,
        plan: tenant.plan,
        status: tenant.status,
        subscriptionStatus: sub?.status || null,
        daysRemaining,
        isEnterprise,
        // Custom Infrastructure
        databaseUrl: tenant.databaseUrl || "",
        storageConfig: tenant.storageConfig || null,
        // API settings with defaults
        apiVersion: settingsMap.apiVersion || "v1",
        rateLimiting: settingsMap.rateLimiting !== "false",
        requestsPerMinute: parseInt(settingsMap.requestsPerMinute || "60"),
        burstLimit: parseInt(settingsMap.burstLimit || "100"),
        corsOrigins: settingsMap.corsOrigins || "",
        // Email settings
        smtpHost: settingsMap.smtpHost || "",
        smtpPort: settingsMap.smtpPort || "",
        smtpUser: settingsMap.smtpUser || "",
        smtpPassword: settingsMap.smtpPassword || "",
        fromEmail: settingsMap.fromEmail || "",
        fromName: settingsMap.fromName || "",
        // Security settings
        twoFactorRequired: settingsMap.twoFactorRequired === "true",
        ipWhitelist: settingsMap.ipWhitelist === "true",
        allowedIps: settingsMap.allowedIps || "",
        auditLogging: settingsMap.auditLogging !== "false",
      },
    })
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// PUT /api/tenant/[tenant]/settings - Update tenant settings
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug } = await params

    // Get tenant
    const tenant = await db.tenant.findFirst({
      where: {
        OR: [{ slug: tenantSlug }, { id: tenantSlug }],
      },
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    // Check admin access
    const membership = await db.tenantMember.findFirst({
      where: {
        tenantId: tenant.id,
        userId: session.user.id,
        role: { in: ["owner", "admin"] },
      },
    })

    const isSuperAdmin = session.user.role === "super_admin"
    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
    }

    const result = await validateBody(request, updateTenantSettingsSchema)
    if ("error" in result) return result.error
    const body = result.data
    const {
      name,
      description,
      apiVersion,
      rateLimiting,
      requestsPerMinute,
      burstLimit,
      corsOrigins,
      twoFactorRequired,
      ipWhitelist,
      allowedIps,
      auditLogging,
      databaseUrl,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      fromEmail,
      fromName,
      storageConfig,
    } = body

    if ((databaseUrl !== undefined && databaseUrl !== tenant.databaseUrl) || 
        (storageConfig !== undefined && JSON.stringify(storageConfig) !== JSON.stringify(tenant.storageConfig))) {
      let isEnterprise = await isEnterpriseTenant("sacms-global", session.user.id)
      if (!isEnterprise) {
        isEnterprise = await isEnterpriseTenant(tenant.id, session.user.id)
      }
      if (!isEnterprise) {
        return NextResponse.json({ error: "Enterprise license required for custom infrastructure" }, { status: 403 })
      }
    }

    // Update tenant basic info and custom infrastructure
    if (name !== undefined || description !== undefined || databaseUrl !== undefined || storageConfig !== undefined) {
      await db.tenant.update({
        where: { id: tenant.id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(databaseUrl !== undefined && { databaseUrl: databaseUrl === "" ? null : databaseUrl }),
          ...(storageConfig !== undefined && { storageConfig: storageConfig === null ? Prisma.JsonNull : storageConfig }),
        },
      })
    }

    // Update settings in Setting model
    const settingsToUpdate: Record<string, string | number | boolean> = {}
    
    if (apiVersion !== undefined) settingsToUpdate.apiVersion = apiVersion
    if (rateLimiting !== undefined) settingsToUpdate.rateLimiting = String(rateLimiting)
    if (requestsPerMinute !== undefined) settingsToUpdate.requestsPerMinute = String(requestsPerMinute)
    if (burstLimit !== undefined) settingsToUpdate.burstLimit = String(burstLimit)
    if (corsOrigins !== undefined) settingsToUpdate.corsOrigins = corsOrigins
    if (twoFactorRequired !== undefined) settingsToUpdate.twoFactorRequired = String(twoFactorRequired)
    if (ipWhitelist !== undefined) settingsToUpdate.ipWhitelist = String(ipWhitelist)
    if (allowedIps !== undefined) settingsToUpdate.allowedIps = allowedIps
    if (auditLogging !== undefined) settingsToUpdate.auditLogging = String(auditLogging)
    if (smtpHost !== undefined) settingsToUpdate.smtpHost = smtpHost
    if (smtpPort !== undefined) settingsToUpdate.smtpPort = smtpPort
    if (smtpUser !== undefined) settingsToUpdate.smtpUser = smtpUser
    if (smtpPassword !== undefined) settingsToUpdate.smtpPassword = smtpPassword
    if (fromEmail !== undefined) settingsToUpdate.fromEmail = fromEmail
    if (fromName !== undefined) settingsToUpdate.fromName = fromName

    // Upsert each setting
    for (const [key, value] of Object.entries(settingsToUpdate)) {
      await db.setting.upsert({
        where: {
          key: `${tenant.id}_${key}`,
        },
        create: {
          key: `${tenant.id}_${key}`,
          value: String(value),
          tenantId: tenant.id,
        },
        update: {
          value: String(value),
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating settings:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
