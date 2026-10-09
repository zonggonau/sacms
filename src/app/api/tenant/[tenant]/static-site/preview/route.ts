import { db } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { renderStaticSite } from "@/lib/static-site-render"

// Authenticated-only preview of the pending DRAFT (falls back to the live
// version if no draft has been generated yet) — never reachable publicly.
// The dashboard loads this into an <iframe srcDoc=...> before the human
// decides whether to call .../publish.
export const GET = withStaffAuth(async (_req, _context, { access }) => {
  const site = await db.tenantStaticSite.findUnique({ where: { tenantId: access.tenantId } })
  if (!site) return apiError("not_found", { message: "Belum ada draft website" })

  const html = site.draftHtml ?? site.html
  const js = site.draftJs ?? site.js
  if (!html) return apiError("not_found", { message: "Belum ada draft website" })

  const { body, headers } = renderStaticSite(html, js)
  return new Response(body, { headers })
})
