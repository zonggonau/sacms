"use server"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { getTenantDbById } from "@/lib/database"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"

const LIST_FIELDS = {
  id: true,
  email: true,
  name: true,
  avatar: true,
  role: true,
  status: true,
} as const

/**
 * Lists end-user Member accounts for this tenant — used by the "relation"
 * field picker (RelationSelectField) when a schema field's relation target
 * is Member rather than a Content Type/Single Type. Mirrors the query in
 * api/tenant/[tenant]/app-members/route.ts's GET handler, exposed as a
 * server action so the picker can call it the same way it already calls
 * getEntriesAction/getSingleTypeBySlugAction.
 */
export async function getMembersAction(
  tenantSlug: string,
  params: { search?: string; page?: number; pageSize?: number } = {}
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDbById(access.tenantId)
    const page = Math.max(1, params.page || 1)
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 50))

    const where: Record<string, unknown> = { tenantId: access.tenantId }
    if (params.search) {
      where.OR = [
        { email: { contains: params.search, mode: "insensitive" } },
        { name: { contains: params.search, mode: "insensitive" } },
      ]
    }

    const [members, total] = await Promise.all([
      tenantDb.member.findMany({
        where,
        select: LIST_FIELDS,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      tenantDb.member.count({ where }),
    ])

    return { members, total }
  } catch (error) {
    console.error("Error fetching members:", error)
    return { error: "Internal server error" }
  }
}
