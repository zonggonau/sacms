import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"

/**
 * DELETE /api/tenant/[tenant]/locales/[localeId]
 * Remove a locale from the tenant (cannot remove default locale)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; localeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant, localeId } = await params
    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (access.role !== "owner" && access.role !== "admin") {
      return NextResponse.json({ error: "Only admins can manage locales" }, { status: 403 })
    }

    const locale = await db.tenantLocale.findFirst({
      where: { id: localeId, tenantId: access.tenantId },
    })

    if (!locale) {
      return NextResponse.json({ error: "Locale not found" }, { status: 404 })
    }

    if (locale.isDefault) {
      return NextResponse.json(
        { error: "Cannot delete the default locale. Set another locale as default first." },
        { status: 400 }
      )
    }

    await db.tenantLocale.delete({ where: { id: localeId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting locale:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/tenant/[tenant]/locales/[localeId]
 * Update a locale (e.g. set as default)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; localeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant, localeId } = await params
    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (access.role !== "owner" && access.role !== "admin") {
      return NextResponse.json({ error: "Only admins can manage locales" }, { status: 403 })
    }

    const body = await request.json()
    const { isDefault } = body

    const locale = await db.tenantLocale.findFirst({
      where: { id: localeId, tenantId: access.tenantId },
    })

    if (!locale) {
      return NextResponse.json({ error: "Locale not found" }, { status: 404 })
    }

    if (isDefault) {
      // Unset existing default
      await db.tenantLocale.updateMany({
        where: { tenantId: access.tenantId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const updated = await db.tenantLocale.update({
      where: { id: localeId },
      data: { isDefault: isDefault ?? locale.isDefault },
    })

    return NextResponse.json({ locale: updated })
  } catch (error) {
    console.error("Error updating locale:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
