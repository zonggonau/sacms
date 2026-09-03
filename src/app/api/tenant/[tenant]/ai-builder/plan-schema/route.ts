import { NextResponse } from "next/server"
import { getDomainBlueprints } from "@/lib/ai/domain-knowledge"
import { generateSystemSchema } from "@/lib/ai-schema-generator"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

export const POST = withStaffAuth(async (req, _context, { access, session }) => {
    const { prompt, templateId } = await req.json()
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
      return apiError("validation", { message: "Prompt is required" })
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
}, { minRole: "admin" })
