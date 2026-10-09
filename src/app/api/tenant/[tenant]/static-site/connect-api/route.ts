import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { db } from "@/lib/database"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { McpClientBridge } from "@/lib/mcp/mcp-client-bridge"
import { extractMockEntities, connectStaticSiteToApi } from "@/lib/static-site-generator"

const bodySchema = z.object({
  model: z.string().optional(),
})

// POST (STEP 3 of the pipeline, only meaningful after Step 2): rewires the
// draft's app.js to fetch real data from the Public REST API in place of
// its // MOCK: blocks, matched by slug to the schema Step 2 just created.
// index.html is never touched.
export const POST = withStaffAuth(
  async (req, _context, { access, session }) => {
    const parsed = await readJson(req, bodySchema)
    if (!parsed.ok) return parsed.response

    const site = await db.tenantStaticSite.findUnique({ where: { tenantId: access.tenantId } })
    if (!site || !site.draftJs) {
      return apiError("not_found", { message: "Belum ada draft tampilan. Generate tampilan dulu lewat prompt." })
    }
    if (site.stage === "mock") {
      return apiError("validation", { message: "Buatkan skema CMS dulu sebelum menghubungkan ke API asli." })
    }

    const entities = extractMockEntities(site.draftJs)
    if (entities.length === 0) {
      return apiError("validation", { message: "Tidak menemukan data mock di draft ini. Coba generate ulang tampilannya." })
    }

    const bridge = new McpClientBridge(access.tenantId, access.tenant.slug, session.user.id)
    const schema = await bridge.getFullSchema()

    const apiOrigin = process.env.NEXT_PUBLIC_APP_URL || "https://sacms.cloud"
    const apiBase = `${apiOrigin.replace(/\/$/, "")}/api/public/${access.tenant.slug}`

    const manifest = entities
      .map((entity) => {
        if (entity.kind === "content") {
          const match = schema.contentTypes.find((ct) => ct.slug === entity.slug)
          if (!match) return null
          return { varName: entity.varName, endpoint: `${apiBase}/content/${match.slug}?limit=20`, kind: "content" as const }
        }
        const match = schema.singleTypes.find((st) => st.slug === entity.slug)
        if (!match) return null
        return { varName: entity.varName, endpoint: `${apiBase}/single/${match.slug}`, kind: "single" as const }
      })
      .filter((m): m is { varName: string; endpoint: string; kind: "content" | "single" } => m !== null)

    if (manifest.length === 0) {
      return apiError("validation", { message: "Tidak ada entitas mock yang cocok dengan skema CMS. Coba buat ulang skemanya." })
    }

    let result
    try {
      result = await connectStaticSiteToApi(site.draftJs, manifest, access.tenantId, session.user.id, parsed.data.model)
    } catch (err: any) {
      return apiError("internal", { message: err.message || "Gagal menghubungkan ke API" })
    }

    const updated = await db.tenantStaticSite.update({
      where: { tenantId: access.tenantId },
      data: { draftJs: result.js, draftAt: new Date(), stage: "api_connected" },
    })

    return NextResponse.json({ site: updated })
  },
  { minRole: "admin" },
)
