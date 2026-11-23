import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

export async function GET(
  req: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check admin access
    if (session.user.role !== "super_admin" && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { tenantId } = params
    const devEnvSetting = await db.setting.findUnique({
      where: { key: `${tenantId}_dev_env_config` },
    })

    const config = devEnvSetting ? JSON.parse(devEnvSetting.value) : {}

    return NextResponse.json({
      success: true,
      config,
      updatedAt: devEnvSetting?.updatedAt,
    })
  } catch (error) {
    console.error("Error fetching dev env config:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "super_admin" && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { tenantId } = params
    const body = await req.json()

    // Validate required fields
    const requiredFields = [
      "NEXT_PUBLIC_SACMS_API_URL",
      "NEXT_PUBLIC_SACMS_TENANT",
      "SACMS_API_KEY",
    ]
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    const configValue = JSON.stringify(body)

    // Upsert setting
    const setting = await db.setting.upsert({
      where: { key: `${tenantId}_dev_env_config` },
      update: { value: configValue },
      create: {
        key: `${tenantId}_dev_env_config`,
        value: configValue,
        tenantId: tenantId,
      },
    })

    return NextResponse.json({
      success: true,
      config: body,
      updatedAt: setting.updatedAt,
    })
  } catch (error) {
    console.error("Error updating dev env config:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "super_admin" && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { tenantId } = params

    await db.setting.delete({
      where: { key: `${tenantId}_dev_env_config` },
    }).catch(() => null) // Ignore if not exists

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting dev env config:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
