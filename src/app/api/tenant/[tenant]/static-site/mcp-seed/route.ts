import { NextResponse } from "next/server"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { McpClientBridge } from "@/lib/mcp/mcp-client-bridge"
import { ensureWorkspaceSchemaAndDataViaMcp, seedMissingCmsDataViaMcp } from "@/lib/static-site-generator"

// GET: Inspect MCP Schema, collections, single types, and public REST API endpoints
export const GET = withStaffAuth(
  async (_req, _context, { access, session }) => {
    try {
      const bridge = new McpClientBridge(access.tenantId, access.tenant.slug, session.user.id)
      const schema = await bridge.getFullSchema()

      const apiOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      const apiBase = `${apiOrigin.replace(/\/$/, "")}/api/public/${access.tenant.slug}`

      const contentTypes = await Promise.all(
        schema.contentTypes.map(async (ct) => {
          const q = await bridge.queryContent({ contentTypeSlug: ct.slug, limit: 1 })
          return {
            id: ct.id,
            name: ct.name,
            slug: ct.slug,
            description: ct.description,
            fieldsCount: ct.fields.length,
            fields: ct.fields,
            hasEntries: (q.pagination?.total || 0) > 0,
            totalEntries: q.pagination?.total || 0,
            endpoint: `${apiBase}/content/${ct.slug}`,
            relativeEndpoint: `/api/public/${access.tenant.slug}/content/${ct.slug}`,
          }
        })
      )

      const singleTypes = await Promise.all(
        schema.singleTypes.map(async (st) => {
          const detail = await bridge.getSingleType(st.slug)
          return {
            id: st.id,
            name: st.name,
            slug: st.slug,
            description: st.description,
            fieldsCount: st.fields.length,
            fields: st.fields,
            hasData: st.hasData,
            data: detail.data || null,
            endpoint: `${apiBase}/single/${st.slug}`,
            relativeEndpoint: `/api/public/${access.tenant.slug}/single/${st.slug}`,
          }
        })
      )

      return NextResponse.json({
        success: true,
        mcpStatus: "connected",
        tenantSlug: access.tenant.slug,
        apiBase,
        contentTypes,
        singleTypes,
        totalCollections: contentTypes.length,
        totalSingletons: singleTypes.length,
      })
    } catch (err: any) {
      return apiError("internal", { message: err.message || "Gagal memeriksa status MCP" })
    }
  },
  { minRole: "viewer" }
)

// POST: Seed or Auto-Provision missing CMS schemas & entries via MCP bridge
export const POST = withStaffAuth(
  async (req, _context, { access, session }) => {
    try {
      let body: any = {}
      try {
        body = await req.json()
      } catch {}

      const prompt = body?.prompt || ""
      const bridge = new McpClientBridge(access.tenantId, access.tenant.slug, session.user.id)

      if (prompt) {
        // Auto-provision schema jika ada permintaan domain spesifik atau skema kosong
        await ensureWorkspaceSchemaAndDataViaMcp(bridge, prompt, access.tenantId, session.user.id)
      } else {
        // Seed data untuk skema yang sudah ada
        await seedMissingCmsDataViaMcp(bridge)
      }

      const updatedSchema = await bridge.getFullSchema()

      return NextResponse.json({
        success: true,
        message: "Skema & data CMS berhasil disinkronkan via MCP",
        schema: updatedSchema,
      })
    } catch (err: any) {
      return apiError("internal", { message: err.message || "Gagal sinkronisasi data MCP" })
    }
  },
  { minRole: "admin" }
)
