import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { createSingleTypeSchema } from "@/lib/validations"
import { Prisma } from "@prisma/client"

// GET /api/admin/single-types - List all single types
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const singleTypes = await db.singleType.findMany({
      where: { tenantId: null },
      include: { schemaFields: {
          orderBy: { order: "asc" }
        },
        tenants: {
          include: {
            tenant: {
              select: { id: true, name: true, slug: true }
            }
          }
        },
        _count: {
          select: { tenants: true }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    const globalSingleTypes = singleTypes.map(st => ({
      ...st,
      fields: st.schemaFields || [],
    }))

    return NextResponse.json({ singleTypes: globalSingleTypes })
  } catch (error) {
    console.error("Failed to fetch single types:", error)
    return NextResponse.json(
      { error: "Failed to fetch single types" },
      { status: 500 }
    )
  }
}

// POST /api/admin/single-types - Create a new single type
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await validateBody(request, createSingleTypeSchema)
    if ("error" in result) return result.error
    const { name, slug, description, fields } = result.data

    // Check if slug already exists
    const existing = await db.singleType.findFirst({
      where: { 
        slug,
        tenantId: null // Check global single types
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: "A single type with this slug already exists" },
        { status: 400 }
      )
    }

    // Create single type with fields
    const singleType = await db.singleType.create({
      data: {
        name,
        slug,
        description,
        schemaFields: fields ? { 
          create: fields.map((field: Record<string, unknown>, index: number) => ({
            name: field.name as string,
            slug: field.slug as string,
            type: field.type as string,
            required: (field.required as boolean) || false,
            unique: (field.unique as boolean) || false,
            options: field.options ? (typeof field.options === 'string' ? field.options : JSON.stringify(field.options)) : Prisma.JsonNull,
            jsonPath: (field.jsonPath as string) || null,
            relationSlug: (field.relationSlug as string) || null,
            order: typeof field.order === 'number' ? field.order as number : index,
          }))
        } : undefined
      },
      include: { schemaFields: true }
    })

    return NextResponse.json({ singleType })
  } catch (error) {
    console.error("Failed to create single type:", error)
    return NextResponse.json(
      { error: "Failed to create single type" },
      { status: 500 }
    )
  }
}