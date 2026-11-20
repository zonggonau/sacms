import { NextResponse } from "next/server"
import { db, getTenantDb } from "@/lib/database"
import { withStaffAuth } from "@/lib/api/route-helpers"
import { BACKUP_VERSION, BACKUP_UNSUPPORTED } from "@/lib/workspace-backup"

export const GET = withStaffAuth(
  async (_request, context, { access }) => {
    const { tenant: tenantSlug } = await context.params
    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    // Fetch all exportable data
    const [
      contentTypesRaw,
      singleTypesRaw,
      componentsRaw,
      contentTypeGroups,
      contentEntries,
      singleTypeData,
      locales,
      mediaFolders,
      media,
    ] = await Promise.all([
      tenantDb.contentType.findMany({
        where: { tenantId, draftTemplateId: null },
        include: { schemaFields: { orderBy: { order: "asc" } } },
      }),
      tenantDb.singleType.findMany({
        where: { tenantId, draftTemplateId: null },
        include: { schemaFields: { orderBy: { order: "asc" } } },
      }),
      tenantDb.component.findMany({
        where: { tenantId, draftTemplateId: null },
        include: { schemaFields: { orderBy: { order: "asc" } } },
      }),
      tenantDb.contentTypeGroup.findMany({ where: { tenantId } }),
      tenantDb.contentEntry.findMany({
        where: { tenantId, contentType: { draftTemplateId: null } },
      }),
      tenantDb.tenantSingleTypeAssignment.findMany({
        where: { tenantId, singleType: { draftTemplateId: null } },
      }),
      db.tenantLocale.findMany({
        where: { tenantId },
      }),
      tenantDb.mediaFolder.findMany({
        where: { tenantId },
      }),
      tenantDb.media.findMany({
        where: { tenantId },
        select: {
          id: true, folderId: true, name: true, originalName: true, mimeType: true, size: true,
          alt: true, caption: true, width: true, height: true, isPrivate: true, createdAt: true, updatedAt: true,
        },
      }),
    ])

    const contentTypes = contentTypesRaw.map(({ schemaFields, ...definition }) => ({ ...definition, fields: schemaFields }))
    const singleTypes = singleTypesRaw.map(({ schemaFields, ...definition }) => ({ ...definition, fields: schemaFields }))
    const components = componentsRaw.map(({ schemaFields, ...definition }) => ({ ...definition, fields: schemaFields }))

    const data = { locales, contentTypes, singleTypes, components, contentTypeGroups, contentEntries, singleTypeData, mediaFolders, media }

    const exportData = {
      version: BACKUP_VERSION,
      timestamp: new Date().toISOString(),
      tenant: {
        id: tenantId,
        slug: access.tenant.slug,
      },
      manifest: {
        counts: Object.fromEntries(Object.entries(data).map(([section, rows]) => [section, rows.length])),
        unsupported: BACKUP_UNSUPPORTED,
      },
      data,
    }

    const jsonString = JSON.stringify(exportData, null, 2)
    
    // Return as a downloadable file
    return new NextResponse(jsonString, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${tenantSlug}-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    })
  },
  { minRole: "admin" },
)
