import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminRoles = ["super_admin", "admin", "employee", "karyawan"]
    if (!adminRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    
    // Find the license
    const license = await db.enterpriseLicense.findUnique({
      where: { id }
    })

    if (!license) {
      return NextResponse.json({ error: "License not found" }, { status: 404 })
    }

    // Check if license is in use
    const usedInCache = await db.licenseCache.findFirst({
      where: { licenseKey: license.licenseKey }
    })

    const usedInTenant = await db.tenant.findFirst({
      where: { licenseKey: license.licenseKey }
    })

    if (usedInCache || usedInTenant) {
      return NextResponse.json({ 
        error: "Cannot delete this license because it is currently in use by one or more users or workspaces." 
      }, { status: 400 })
    }

    // Delete it
    await db.enterpriseLicense.delete({
      where: { id }
    })

    return NextResponse.json({ success: true, message: "License deleted successfully" })
  } catch (error: any) {
    console.error("Delete license API Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
