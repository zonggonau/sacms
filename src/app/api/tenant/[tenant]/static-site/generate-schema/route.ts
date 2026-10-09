import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { db } from "@/lib/database"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { McpClientBridge } from "@/lib/mcp/mcp-client-bridge"
import { extractMockEntities, generateSchemaFromMockUi } from "@/lib/static-site-generator"

const bodySchema = z.object({
  model: z.string().optional(),
})

// POST (STEP 2 of the pipeline): derive a CMS schema from the mock data
// already baked into the current draft's app.js (// MOCK: markers from
// Step 1), apply it via MCP, and mark the draft as schema_applied. Never
// touches the live/published site — same safety property as the base
// generate route.
export const POST = withStaffAuth(
  async (req, _context, { access, session }) => {
    const parsed = await readJson(req, bodySchema)
    if (!parsed.ok) return parsed.response

    const site = await db.tenantStaticSite.findUnique({ where: { tenantId: access.tenantId } })
    if (!site || !site.draftJs) {
      return apiError("not_found", { message: "Belum ada draft tampilan. Generate tampilan dulu lewat prompt." })
    }

    const entities = extractMockEntities(site.draftJs)
    if (entities.length === 0) {
      return apiError("validation", { message: "Tidak menemukan data mock di draft ini. Coba generate ulang tampilannya." })
    }

    let schema
    try {
      schema = await generateSchemaFromMockUi(entities, site.draftPrompt || "", access.tenantId, session.user.id, parsed.data.model)
    } catch (err: any) {
      return apiError("internal", { message: err.message || "Gagal membuat skema" })
    }

    const bridge = new McpClientBridge(access.tenantId, access.tenant.slug, session.user.id)
    const applied = await bridge.applyGeneratedSchema(schema)

    const updated = await db.tenantStaticSite.update({
      where: { tenantId: access.tenantId },
      data: { stage: "schema_applied" },
    })

    return NextResponse.json({ site: updated, applied })
  },
  { minRole: "admin" },
)
