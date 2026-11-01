"use server"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { getTenantDb } from "@/lib/database"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { revalidatePath } from "next/cache"
import {
  listContentTypeGroups,
  createContentTypeGroup,
  renameContentTypeGroup,
  reparentContentTypeGroup,
  reorderContentTypeGroups,
  deleteContentTypeGroup,
  assignContentTypeToGroup,
} from "@/lib/content-type-group-service"

// Thin auth/RBAC wrappers around src/lib/content-type-group-service.ts —
// the depth-cap/cycle-prevention/etc. business logic lives there so the
// MCP server's group tools (src/app/api/mcp/[[...transport]]/route.ts,
// which authenticates via Bearer token, not a NextAuth session, and so
// cannot call these "use server" actions directly) use the exact same
// rules instead of a second, independently-maintained copy.

export async function getContentTypeGroupsAction(tenantSlug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbacContentType = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_READ)
    const rbacContent = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
    if (!rbacContentType.allowed && !rbacContent.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)
    return await listContentTypeGroups(tenantDb, access.tenantId)
  } catch (error) {
    console.error("Error fetching content type groups:", error)
    return { error: "Internal server error" }
  }
}

export async function createContentTypeGroupAction(
  tenantSlug: string,
  data: { name: string; parentId?: string | null },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_CREATE)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)
    const result = await createContentTypeGroup(tenantDb, access.tenantId, data)
    if ("error" in result) return result

    revalidatePath(`/dashboard/${tenantSlug}/developer/content-types`)
    revalidatePath(`/dashboard/${tenantSlug}/cms`)
    return result
  } catch (error) {
    console.error("Error creating content type group:", error)
    return { error: "Internal server error" }
  }
}

export async function renameContentTypeGroupAction(tenantSlug: string, id: string, name: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_UPDATE)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)
    const result = await renameContentTypeGroup(tenantDb, access.tenantId, id, name)
    if ("error" in result) return result

    revalidatePath(`/dashboard/${tenantSlug}/developer/content-types`)
    revalidatePath(`/dashboard/${tenantSlug}/cms`)
    return result
  } catch (error) {
    console.error("Error renaming content type group:", error)
    return { error: "Internal server error" }
  }
}

export async function reparentContentTypeGroupAction(
  tenantSlug: string,
  id: string,
  newParentId: string | null,
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_UPDATE)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)
    const result = await reparentContentTypeGroup(tenantDb, access.tenantId, id, newParentId)
    if ("error" in result) return result

    revalidatePath(`/dashboard/${tenantSlug}/developer/content-types`)
    revalidatePath(`/dashboard/${tenantSlug}/cms`)
    return result
  } catch (error) {
    console.error("Error reparenting content type group:", error)
    return { error: "Internal server error" }
  }
}

export async function reorderContentTypeGroupsAction(
  tenantSlug: string,
  parentId: string | null,
  orderedIds: string[],
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_UPDATE)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)
    const result = await reorderContentTypeGroups(tenantDb, access.tenantId, parentId, orderedIds)
    if ("error" in result) return result

    revalidatePath(`/dashboard/${tenantSlug}/developer/content-types`)
    revalidatePath(`/dashboard/${tenantSlug}/cms`)
    return result
  } catch (error) {
    console.error("Error reordering content type groups:", error)
    return { error: "Internal server error" }
  }
}

export async function deleteContentTypeGroupAction(tenantSlug: string, id: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_DELETE)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)
    const result = await deleteContentTypeGroup(tenantDb, access.tenantId, id)
    if ("error" in result) return result

    revalidatePath(`/dashboard/${tenantSlug}/developer/content-types`)
    revalidatePath(`/dashboard/${tenantSlug}/cms`)
    return result
  } catch (error) {
    console.error("Error deleting content type group:", error)
    return { error: "Internal server error" }
  }
}

export async function assignContentTypeToGroupAction(
  tenantSlug: string,
  contentTypeId: string,
  groupId: string | null,
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return { error: "Forbidden" }

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_TYPE_UPDATE)
    if (!rbac.allowed) return { error: "Forbidden" }

    const tenantDb = await getTenantDb(tenantSlug)
    const result = await assignContentTypeToGroup(tenantDb, access.tenantId, contentTypeId, groupId, access.isGlobal)
    if ("error" in result) return result

    revalidatePath(`/dashboard/${tenantSlug}/developer/content-types`)
    revalidatePath(`/dashboard/${tenantSlug}/cms`)
    return result
  } catch (error) {
    console.error("Error assigning content type to group:", error)
    return { error: "Internal server error" }
  }
}
