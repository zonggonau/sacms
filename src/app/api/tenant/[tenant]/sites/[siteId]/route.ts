import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { z } from "zod"

const updateSiteSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  status: z.enum(["draft", "building", "published", "archived"]).optional(),
  customDomain: z.string().optional().nullable(),
  settings: z.any().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; siteId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug, siteId } = await params
    const tenant = await db.tenant.findFirst({
      where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] },
      select: { id: true, slug: true, name: true }
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    const site = await db.site.findFirst({
      where: {
        id: siteId,
        tenantId: tenant.id,
      },
      include: {
        files: { orderBy: { path: "asc" } },
        versions: { orderBy: { version: "desc" }, take: 10 },
        deployments: { orderBy: { createdAt: "desc" }, take: 5 },
        conversations: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          include: {
            messages: { orderBy: { createdAt: "asc" } }
          }
        }
      }
    })

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    }

    return NextResponse.json({ site })
  } catch (error) {
    console.error("Failed to get site:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; siteId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug, siteId } = await params
    const tenant = await db.tenant.findFirst({
      where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] },
      select: { id: true }
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    const json = await request.json()
    const parsed = updateSiteSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const updated = await db.site.update({
      where: {
        id: siteId,
        tenantId: tenant.id,
      },
      data: parsed.data
    })

    return NextResponse.json({ site: updated })
  } catch (error) {
    console.error("Failed to update site:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; siteId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug, siteId } = await params
    const tenant = await db.tenant.findFirst({
      where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] },
      select: { id: true }
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    await db.site.delete({
      where: {
        id: siteId,
        tenantId: tenant.id,
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete site:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
