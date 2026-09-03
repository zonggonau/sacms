import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { McpClientBridge } from "@/lib/mcp/mcp-client-bridge"
import { applySchemaPlan, SchemaPlanSchema } from "@/lib/ai/schema-engine"
import { generateFullWebsiteProject } from "@/lib/ai/website-generator"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

export const POST = withStaffAuth(
  async (request, context, { access }) => {
    const { siteId } = await context.params
    const tenant = access.tenant

    const site = await db.site.findFirst({
      where: { id: siteId, tenantId: access.tenantId },
      select: { id: true, name: true, slug: true, description: true },
    })
    if (!site) return apiError("not_found", { message: "Site not found" })

    const json = await request.json()
    const parsed = SchemaPlanSchema.safeParse(json.schemaPlan)
    if (!parsed.success) {
      return apiError("validation", { message: "Format Schema Plan tidak valid", details: { issues: parsed.error.issues } })
    }

    const schemaPlan = parsed.data
    const bridge = new McpClientBridge(tenant.id, tenant.slug)

    // 1. Apply schema changes & mock entries via MCP
    const schemaResults = await applySchemaPlan(bridge, schemaPlan)

    // 2. Generate multi-page Next.js project files
    const generatedFiles = generateFullWebsiteProject({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      siteName: site.name,
      siteSlug: site.slug,
      description: site.description || undefined,
      plan: schemaPlan,
    })

    // 3. Persist files into SiteFile database
    for (const f of generatedFiles) {
      await db.siteFile.upsert({
        where: { siteId_path: { siteId: site.id, path: f.path } },
        create: { siteId: site.id, path: f.path, content: f.content },
        update: { content: f.content },
      })
    }

    // 4. Update site status
    await db.site.update({
      where: { id: site.id },
      data: { status: "published", updatedAt: new Date() }
    })

    // 5. Add confirmation message to conversation
    const conv = json.conversationId
      ? await db.siteConversation.findUnique({ where: { id: json.conversationId } })
      : await db.siteConversation.findFirst({ where: { siteId: site.id }, orderBy: { updatedAt: "desc" } })

    if (conv) {
      await db.siteMessage.create({
        data: {
          conversationId: conv.id,
          role: "assistant",
          content: `✅ **Perubahan Skema MCP Berhasil Diterapkan!**\n\n* **Tipe Koleksi:** ${schemaResults.createdContentTypes.join(", ") || "-"}\n* **Tipe Tunggal:** ${schemaResults.createdSingleTypes.join(", ") || "-"}\n* **Entri Terisi:** ${schemaResults.populatedEntries} mock data\n* **Berkas Proyek Dibuat:** ${generatedFiles.length} file Next.js App Router\n\nSemua halaman katalog dan detail kini aktif di Live Preview!`,
          creditsUsed: 0,
          status: "completed",
        }
      })
    }

    return NextResponse.json({
      success: true,
      schemaResults,
      updatedFiles: generatedFiles,
    })
  },
  { minRole: "admin" },
)
