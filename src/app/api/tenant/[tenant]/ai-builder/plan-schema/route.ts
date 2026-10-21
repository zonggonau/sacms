import { NextResponse } from "next/server"
import { generateSystemSchema } from "@/lib/ai-schema-generator"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { isAllowedSchemaModel, DEFAULT_SCHEMA_MODEL } from "@/lib/ai/schema-models"

export const POST = withStaffAuth(async (req, _context, { access, session }) => {
    const { prompt, model, documentPlaceholders } = await req.json()
    const tenant = access.tenant

    if (!prompt) {
      return apiError("validation", { message: "Prompt is required" })
    }

    // Exact {placeholder} keys detected from an attached .docx letter
    // template (schema-step.tsx's attachment flow) — passed straight
    // through so generateSystemSchema can restore them verbatim after its
    // own kebab-case slug normalization, keeping the document_template
    // merge's exact-slug-match working. Never trust an arbitrary array
    // shape from the client beyond "list of strings".
    const placeholderKeys: string[] | undefined = Array.isArray(documentPlaceholders)
      ? documentPlaceholders.filter((k: unknown): k is string => typeof k === "string").slice(0, 100)
      : undefined

    // The dropdown only ever offers SCHEMA_MODEL_OPTIONS — reject anything
    // else server-side too, since all tenants share one Vercel AI Gateway
    // key and an unlisted model id would bill that shared key for whatever
    // the request asked for, outside the curated price/provider spread.
    if (model !== undefined && !isAllowedSchemaModel(model)) {
      return apiError("validation", { message: "Model AI tidak dikenal. Pilih salah satu dari daftar yang tersedia." })
    }

    const { schema, usedFallback, fallbackReason } = await generateSystemSchema(
      prompt,
      tenant.id,
      session.user.id,
      model || DEFAULT_SCHEMA_MODEL,
      undefined,
      placeholderKeys,
    )

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
        // Matches the flat creditsCost the generator actually reserves — see
        // ai-schema-generator.ts. Fallback runs never reserve/spend credits.
        estimatedCredits: usedFallback ? 0 : 5,
        usedFallback,
        fallbackReason,
      }
    })
}, { minRole: "admin" })
