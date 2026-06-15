import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { processAutoSlugs } from "@/lib/slug"

import { SYSTEM_TENANT_SLUG } from "@/lib/constants"

/**
 * POST /api/admin/single-types/by-slug/[slug]/data
 * Create or update single type data for platform-level content
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { slug } = await params
    const body = await request.json()
    const { data } = body

    if (!data) {
      return NextResponse.json({ error: "Data is required" }, { status: 400 })
    }

    // Get single type
    const singleType = await db.singleType.findFirst({
      where: { 
        slug,
        tenantId: null
      },
      include: {
        fields: true,
      },
    })

    if (!singleType) {
      return NextResponse.json({ error: "Single type not found" }, { status: 404 })
    }

    // Get or create system tenant for platform-level content
    let systemTenant = await db.tenant.findFirst({
      where: { slug: SYSTEM_TENANT_SLUG },
    })

    if (!systemTenant) {
      // Fallback if sacms-global is missing, check for 'system'
      systemTenant = await db.tenant.findFirst({ where: { slug: "system" } })

      if (!systemTenant) {
        systemTenant = await db.tenant.create({
          data: {
            name: "SaCMS Global",
            slug: SYSTEM_TENANT_SLUG,
            description: "Platform-level content",
            status: "active",
            plan: "enterprise",
          },
        })
      }
    }

    // Check if assignment already exists
    let assignment = await db.tenantSingleTypeAssignment.findUnique({
      where: {
        tenantId_singleTypeId: {
          tenantId: systemTenant.id,
          singleTypeId: singleType.id,
        },
      },
    })

    // Process auto-generated slugs
    const existingData = assignment?.data ? (typeof assignment.data === 'string' ? JSON.parse(assignment.data) : assignment.data) : {}
    const fullData = { ...existingData, ...data }
    const dataWithSlugs = await processAutoSlugs(
      systemTenant.id,
      singleType.id,
      singleType.fields,
      fullData,
      assignment?.id,
      'single'
    )

    if (assignment) {
      // Update existing assignment
      assignment = await db.tenantSingleTypeAssignment.update({
        where: {
          tenantId_singleTypeId: {
            tenantId: systemTenant.id,
            singleTypeId: singleType.id,
          },
        },
        data: {
          data: JSON.stringify(dataWithSlugs),
          publishedAt: new Date(),
          updatedAt: new Date(),
        },
      })
    } else {
      // Create new assignment
      assignment = await db.tenantSingleTypeAssignment.create({
        data: {
          tenantId: systemTenant.id,
          singleTypeId: singleType.id,
          enabled: true,
          data: JSON.stringify(dataWithSlugs),
          publishedAt: new Date(),
        },
      })
    }

    return NextResponse.json({
      assignment,
      singleType,
    })
  } catch (error) {
    console.error("Error saving single type data:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/single-types/by-slug/[slug]/data
 * Get single type data for system tenant
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { slug } = await params

    // Get single type
    const singleType = await db.singleType.findFirst({
      where: { 
        slug,
        tenantId: null
      },
    })

    if (!singleType) {
      return NextResponse.json({ error: "Single type not found" }, { status: 404 })
    }

    // Get system tenant
    const systemTenant = await db.tenant.findFirst({
      where: { 
        OR: [
          { slug: SYSTEM_TENANT_SLUG },
          { slug: "system" }
        ]
      },
    })

    if (!systemTenant) {
      return NextResponse.json({ error: "System tenant not found" }, { status: 404 })
    }

    // Get assignment
    const assignment = await db.tenantSingleTypeAssignment.findUnique({
      where: {
        tenantId_singleTypeId: {
          tenantId: systemTenant.id,
          singleTypeId: singleType.id,
        },
      },
    })

    return NextResponse.json({
      assignment,
      singleType,
      data: assignment?.data ? (typeof assignment.data === 'string' ? JSON.parse(assignment.data) : assignment.data) : null,
    })
  } catch (error) {
    console.error("Error fetching single type data:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}