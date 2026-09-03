import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth } from "@/lib/api/route-helpers"

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
      contentEntries,
      singleTypeData,
      locales,
      mediaFolders,
      media,
    ] = await Promise.all([
      tenantDb.contentType.findMany({
        where: { tenantId },
        include: { schemaFields: true },
      }),
      tenantDb.singleType.findMany({
        where: { tenantId },
        include: { schemaFields: true },
      }),
      tenantDb.component.findMany({
        where: { tenantId },
        include: { schemaFields: true },
      }),
      tenantDb.contentEntry.findMany({
        where: { tenantId },
      }),
      tenantDb.tenantSingleTypeAssignment.findMany({
        where: { tenantId },
      }),
      tenantDb.tenantLocale.findMany({
        where: { tenantId },
      }),
      tenantDb.mediaFolder.findMany({
        where: { tenantId },
      }).catch(() => []),
      tenantDb.media.findMany({
        where: { tenantId },
      }).catch(() => []),
    ])

    const contentTypes = contentTypesRaw.map(ct => ({ ...ct, fields: ct.schemaFields }))
    const singleTypes = singleTypesRaw.map(st => ({ ...st, fields: st.schemaFields }))
    const components = componentsRaw.map(cp => ({ ...cp, fields: cp.schemaFields }))

    const exportData = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      tenant: {
        id: tenantId,
        slug: tenantSlug,
      },
      data: {
        locales,
        contentTypes,
        singleTypes,
        components,
        contentEntries,
        singleTypeData,
        mediaFolders,
        media,
      }
    }

    const jsonString = JSON.stringify(exportData, null, 2)
    
    // Return as a downloadable file
    return new NextResponse(jsonString, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${tenantSlug}-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    })
  },
  { minRole: "admin" },
)
