import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"

const overrideSchema = z.object({
  maxContentTypes: z.number().int().nonnegative().nullable().optional(),
  maxContentEntries: z.number().int().nonnegative().nullable().optional(),
  maxTeamMembers: z.number().int().nonnegative().nullable().optional(),
  maxStorage: z.number().int().nonnegative().nullable().optional(), // in MB
  maxLocales: z.number().int().nonnegative().nullable().optional(),
  maxApiCalls: z.number().int().nonnegative().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { tenantId } = await params

    const override = await db.customPlanOverride.findUnique({
      where: { tenantId },
    })

    return NextResponse.json({ override })
  } catch (error) {
    console.error("Error fetching tenant overrides:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { tenantId } = await params
    const result = await validateBody(request, overrideSchema)
    if ("error" in result) return result.error

    const {
      maxContentTypes,
      maxContentEntries,
      maxTeamMembers,
      maxStorage,
      maxLocales,
      maxApiCalls,
      note,
    } = result.data

    const creator = session.user.email || session.user.name || "super_admin"

    const override = await db.customPlanOverride.upsert({
      where: { tenantId },
      update: {
        maxContentTypes: maxContentTypes ?? null,
        maxContentEntries: maxContentEntries ?? null,
        maxTeamMembers: maxTeamMembers ?? null,
        maxStorage: maxStorage ?? null,
        maxLocales: maxLocales ?? null,
        maxApiCalls: maxApiCalls ?? null,
        note: note ?? null,
      },
      create: {
        tenantId,
        maxContentTypes: maxContentTypes ?? null,
        maxContentEntries: maxContentEntries ?? null,
        maxTeamMembers: maxTeamMembers ?? null,
        maxStorage: maxStorage ?? null,
        maxLocales: maxLocales ?? null,
        maxApiCalls: maxApiCalls ?? null,
        note: note ?? null,
        createdBy: creator,
      },
    })

    return NextResponse.json({ override })
  } catch (error) {
    console.error("Error saving tenant overrides:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { tenantId } = await params

    await db.customPlanOverride.deleteMany({
      where: { tenantId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting tenant overrides:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
