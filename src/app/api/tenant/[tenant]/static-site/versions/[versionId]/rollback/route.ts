import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { snapshotCurrentVersion, setStaticSiteFlag } from "@/lib/static-site-versions"

// Rolls the live site back to a previous version. The version being
// replaced is itself snapshotted first, so a rollback is never a dead end —
// you can always roll forward again.
export const POST = withStaffAuth(
  async (_req, context, { access }) => {
    const { versionId } = await context.params

    const site = await db.tenantStaticSite.findUnique({ where: { tenantId: access.tenantId } })
    if (!site) return apiError("not_found", { message: "Website tidak ditemukan" })

    const version = await db.tenantStaticSiteVersion.findFirst({
      where: { id: versionId, siteId: site.id },
    })
    if (!version) return apiError("not_found", { message: "Versi tidak ditemukan" })

    if (site.html) {
      await snapshotCurrentVersion(site.id, site.html, site.js, site.prompt)
    }

    const updated = await db.tenantStaticSite.update({
      where: { tenantId: access.tenantId },
      data: {
        html: version.html,
        js: version.js,
        prompt: version.prompt,
        published: true,
      },
    })

    await setStaticSiteFlag(access.tenant.slug, true)

    return NextResponse.json({ site: updated })
  },
  { minRole: "admin" },
)
