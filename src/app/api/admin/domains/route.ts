import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "super_admin" && session?.user?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""

    const where: any = {}
    if (search) {
      where.OR = [
        { domain: { contains: search, mode: "insensitive" } },
        { tenant: { name: { contains: search, mode: "insensitive" } } },
        { tenant: { slug: { contains: search, mode: "insensitive" } } },
      ]
    }

    const domains = await db.customDomain.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            status: true,
          }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json({ domains })
  } catch (error: any) {
    console.error("Failed to fetch admin custom domains:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "super_admin" && session?.user?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { domainId, action } = body

    if (!domainId) {
      return NextResponse.json({ error: "Domain ID is required" }, { status: 400 })
    }

    const existingDomain = await db.customDomain.findUnique({
      where: { id: domainId }
    })

    if (!existingDomain) {
      return NextResponse.json({ error: "Custom domain not found" }, { status: 404 })
    }

    if (action === "verify") {
      const updated = await db.customDomain.update({
        where: { id: domainId },
        data: {
          status: "verified",
          verifiedAt: new Date()
        }
      })
      return NextResponse.json({ success: true, domain: updated })
    }

    if (action === "set_pending") {
      const updated = await db.customDomain.update({
        where: { id: domainId },
        data: {
          status: "pending",
          verifiedAt: null
        }
      })
      return NextResponse.json({ success: true, domain: updated })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    console.error("Failed to update custom domain status:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "super_admin" && session?.user?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Domain ID is required" }, { status: 400 })
    }

    await db.customDomain.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Failed to delete custom domain:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
