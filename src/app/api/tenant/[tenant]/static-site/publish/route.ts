import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { snapshotCurrentVersion, setStaticSiteFlag } from "@/lib/static-site-versions"

// Promotes the pending draft to live. If something was already live, it's
// snapshotted into version history first — this is the only place that
// actually changes what the public sees, so it's the only place that needs
// to protect the outgoing version.
export const POST = withStaffAuth(
  async (_req, _context, { access }) => {
    const site = await db.tenantStaticSite.findUnique({ where: { tenantId: access.tenantId } })
    if (!site || !site.draftHtml || !site.draftJs) {
      return apiError("not_found", { message: "Belum ada draft untuk di-publish. Generate dulu lewat prompt." })
    }

    if (site.html) {
      await snapshotCurrentVersion(site.id, site.html, site.js, site.prompt)
    }

    const updated = await db.tenantStaticSite.update({
      where: { tenantId: access.tenantId },
      data: {
        html: site.draftHtml,
        js: site.draftJs,
        prompt: site.draftPrompt,
        published: true,
      },
    })

    await setStaticSiteFlag(access.tenant.slug, true)

    return NextResponse.json({ site: updated })
  },
  { minRole: "admin" },
)
