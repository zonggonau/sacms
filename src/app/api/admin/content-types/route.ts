import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { createContentTypeSchema } from "@/lib/validations"
import { Prisma } from "@prisma/client"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const contentTypes = await db.contentType.findMany({
      where: {
        tenantId: null, // Only global/system content types
      },
      include: {
        fields: {
          orderBy: { order: "asc" },
        },
        tenants: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        _count: {
          select: { entries: true, tenants: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ contentTypes })
  } catch (error) {
    console.error("Error fetching content types:", error)
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

    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await validateBody(request, createContentTypeSchema)
    if ("error" in result) return result.error
    const { name, slug, description, fields } = result.data

    // Check if slug is already taken
    const existingContentType = await db.contentType.findFirst({
      where: { 
        slug,
        tenantId: null, // Check global content types
      },
    })

    if (existingContentType) {
      return NextResponse.json(
        { error: "A content type with this slug already exists" },
        { status: 400 }
      )
    }

    // Create global content type with fields
    const contentType = await db.contentType.create({
      data: {
        name,
        slug,
        description,
        isPublished: true,
        fields: fields
          ? {
              create: fields.map((field: Record<string, unknown>, index: number) => ({
                name: field.name as string,
                slug: field.slug as string,
                type: field.type as string,
                required: field.required as boolean || false,
                unique: field.unique as boolean || false,
                options: field.options ? (typeof field.options === 'string' ? field.options : JSON.stringify(field.options)) : Prisma.JsonNull,
                order: typeof field.order === 'number' ? field.order : index,
                relationSlug: field.relationSlug as string || null,
              })),
            }
          : undefined,
      },
      include: {
        fields: true,
      },
    })

    return NextResponse.json({ contentType })
  } catch (error) {
    console.error("Error creating content type:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}