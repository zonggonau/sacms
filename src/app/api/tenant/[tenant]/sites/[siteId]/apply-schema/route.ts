import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { McpClientBridge } from "@/lib/mcp/mcp-client-bridge"
import { applySchemaPlan, SchemaPlanSchema } from "@/lib/ai/schema-engine"
import { generateFullWebsiteProject } from "@/lib/ai/website-generator"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; siteId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug, siteId } = await params
    const tenant = await db.tenant.findFirst({
      where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] },
      select: { id: true, slug: true, name: true }
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    const site = await db.site.findFirst({
      where: { id: siteId, tenantId: tenant.id },
      select: { id: true, name: true, slug: true, description: true }
    })

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    }

    const json = await request.json()
    const parsed = SchemaPlanSchema.safeParse(json.schemaPlan)
    if (!parsed.success) {
      return NextResponse.json({ error: "Format Schema Plan tidak valid", details: parsed.error.issues }, { status: 400 })
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
  } catch (error: any) {
    console.error("Apply schema error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
