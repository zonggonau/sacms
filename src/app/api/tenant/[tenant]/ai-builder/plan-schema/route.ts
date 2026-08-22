import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { getDomainBlueprints, DOMAIN_KNOWLEDGE_LIBRARY } from "@/lib/ai/domain-knowledge"
import { generateSystemSchema } from "@/lib/ai-schema-generator"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug } = await params
    const { prompt, templateId } = await req.json()

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) {
      return NextResponse.json({ error: "Tenant not found or unauthorized" }, { status: 404 })
    }

    const tenant = access.tenant

    // 1. Check if matching pre-baked template requested
    if (templateId) {
      const blueprints = await getDomainBlueprints()
      const template = blueprints.find(t => t.id === templateId)
      if (template) {
        return NextResponse.json({
          success: true,
          isPrebaked: true,
          plan: {
            domain: template.category,
            title: template.name,
            summary: `Blueprint instan siap pakai untuk ${template.name}`,
            contentTypes: template.schema.contentTypes,
            singleTypes: template.schema.singleTypes,
            components: template.schema.components || [],
            frontendPrompt: template.frontendPrompt,
            estimatedCredits: 0
          }
        })
      }
    }

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    // 2. Generate Schema Plan via AI (Safe Mode Planning)
    const schema = await generateSystemSchema(prompt, tenant.id, session.user.id)

    const totalFields = schema.contentTypes.reduce((acc, ct) => acc + (ct.fields?.length || 0), 0) +
      schema.singleTypes.reduce((acc, st) => acc + (st.fields?.length || 0), 0)

    return NextResponse.json({
      success: true,
      isPrebaked: false,
      plan: {
        domain: "Custom Architecture",
        title: "Perencanaan Skema AI",
        summary: `Rencana arsitektur dengan ${schema.contentTypes.length} Koleksi, ${schema.singleTypes.length} Single Type, dan ${totalFields} Total Fields`,
        contentTypes: schema.contentTypes,
        singleTypes: schema.singleTypes,
        components: schema.components || [],
        frontendPrompt: prompt,
        estimatedCredits: 25
      }
    })
  } catch (error: any) {
    console.error("[PLAN_SCHEMA_ERROR]", error)
    return NextResponse.json({ 
      error: error?.message || "Gagal merencanakan skema. Silakan coba lagi." 
    }, { status: 500 })
  }
}
