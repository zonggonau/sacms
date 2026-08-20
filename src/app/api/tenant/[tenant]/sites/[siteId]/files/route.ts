import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { z } from "zod"

const saveFileSchema = z.object({
  path: z.string().min(1, "Path file tidak boleh kosong"),
  content: z.string(),
  isBinary: z.boolean().default(false),
})

export async function POST(
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

    const site = await db.site.findFirst({
      where: { id: siteId, tenantId: tenant.id },
      select: { id: true }
    })

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    }

    const json = await request.json()
    const parsed = saveFileSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { path, content, isBinary } = parsed.data

    const file = await db.siteFile.upsert({
      where: {
        siteId_path: { siteId: site.id, path }
      },
      create: {
        siteId: site.id,
        path,
        content,
        isBinary,
      },
      update: {
        content,
        isBinary,
      }
    })

    // Also update site updatedAt
    await db.site.update({
      where: { id: site.id },
      data: { updatedAt: new Date() }
    })

    return NextResponse.json({ file })
  } catch (error) {
    console.error("Failed to save file:", error)
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

    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get("path")
    if (!filePath) {
      return NextResponse.json({ error: "Parameter path wajib diisi" }, { status: 400 })
    }

    await db.siteFile.deleteMany({
      where: {
        siteId,
        path: filePath,
        site: { tenantId: tenant.id }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete file:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
