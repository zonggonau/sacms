import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { z } from "zod/v4"
import { validateBody } from "@/lib/validate"

const GLOBAL_SLUG = "sacms-global"

const updateSchema = z.object({
  contentTypeSlug: z.string().min(1),
  entryId: z.string().min(1).optional(),
  data: z.record(z.string(), z.unknown()),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
})

/**
 * GET /api/admin/global/content?ct=sacms-hero
 * Returns all entries for a specific content type in the global tenant
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const ctSlug = searchParams.get("ct")

    const globalTenant = await db.tenant.findUnique({ where: { slug: GLOBAL_SLUG } })
    if (!globalTenant) return NextResponse.json({ error: "Global tenant not found. Run seed first." }, { status: 404 })

    const where = ctSlug
      ? { tenantId: globalTenant.id, contentType: { slug: ctSlug } }
      : { tenantId: globalTenant.id }

    const entries = await db.contentEntry.findMany({
      where,
      include: { contentType: { select: { id: true, slug: true, name: true } } },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({ entries, tenantId: globalTenant.id })
  } catch (error) {
    console.error("Global content GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/global/content
 * Update or create a specific entry in the global tenant
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const result = await validateBody(request, updateSchema)
    if ("error" in result) return result.error

    const { contentTypeSlug, entryId, data, status = "PUBLISHED" } = result.data

    const globalTenant = await db.tenant.findUnique({ where: { slug: GLOBAL_SLUG } })
    if (!globalTenant) return NextResponse.json({ error: "Global tenant not found. Run seed first." }, { status: 404 })

    const contentType = await db.contentType.findFirst({
      where: { slug: contentTypeSlug, tenantId: globalTenant.id },
    })
    if (!contentType) return NextResponse.json({ error: "Content type not found" }, { status: 404 })

    let entry
    if (entryId) {
      // Update existing entry
      entry = await db.contentEntry.update({
        where: { id: entryId },
        data: {
          data,
          status,
          publishedAt: status === "PUBLISHED" ? new Date() : undefined,
        },
      })
    } else {
      // Create new entry
      entry = await db.contentEntry.create({
        data: {
          tenantId: globalTenant.id,
          contentTypeId: contentType.id,
          data,
          status,
          publishedAt: status === "PUBLISHED" ? new Date() : undefined,
        },
      })
    }

    return NextResponse.json({ entry })
  } catch (error) {
    console.error("Global content PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/global/content?entryId=xxx
 * Delete an entry from the global tenant
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const entryId = searchParams.get("entryId")
    if (!entryId) return NextResponse.json({ error: "entryId is required" }, { status: 400 })

    await db.contentEntry.delete({ where: { id: entryId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Global content DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
