import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"

const overrideSchema = z.object({
  maxWorkspaces: z.number().int().nonnegative().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { userId } = await params

    const override = await db.customPlanOverride.findUnique({
      where: { userId },
    })

    return NextResponse.json({ override })
  } catch (error) {
    console.error("Error fetching user overrides:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { userId } = await params
    const result = await validateBody(request, overrideSchema)
    if ("error" in result) return result.error

    const { maxWorkspaces, note } = result.data
    const creator = session.user.email || session.user.name || "super_admin"

    const override = await db.customPlanOverride.upsert({
      where: { userId },
      update: {
        maxWorkspaces: maxWorkspaces ?? null,
        note: note ?? null,
      },
      create: {
        userId,
        maxWorkspaces: maxWorkspaces ?? null,
        note: note ?? null,
        createdBy: creator,
      },
    })

    return NextResponse.json({ override })
  } catch (error) {
    console.error("Error saving user overrides:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { userId } = await params

    await db.customPlanOverride.deleteMany({
      where: { userId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting user overrides:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
