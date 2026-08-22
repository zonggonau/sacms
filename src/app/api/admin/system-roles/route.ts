import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

import { getGlobalWorkspaceId } from "@/lib/settings"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const roles = await db.tenantRole.findMany({
      where: { isSystem: true },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ roles })
  } catch (error) {
    console.error("Error fetching system roles:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { name, slug, description } = body

    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required" }, { status: 400 })
    }

    const globalTenantId = await getGlobalWorkspaceId()

    const existing = await db.tenantRole.findFirst({ where: { tenantId: globalTenantId, slug } })
    if (existing) {
      return NextResponse.json({ error: "Role with this slug already exists" }, { status: 400 })
    }

    const role = await db.tenantRole.create({
      data: {
        tenantId: globalTenantId,
        name,
        slug,
        description,
        isSystem: true
      }
    })

    return NextResponse.json({ role })
  } catch (error) {
    console.error("Error creating system role:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
