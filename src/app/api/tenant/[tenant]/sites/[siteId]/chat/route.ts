import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { AgentOrchestrator, AgentStepEvent } from "@/lib/ai/agent-orchestrator"
import { z } from "zod"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"

const chatRequestSchema = z.object({
  prompt: z.string().min(2, "Prompt minimal 2 karakter"),
  conversationId: z.string().optional(),
})

export const POST = withStaffAuth(
  async (request, context, { access, session }) => {
    const { siteId } = await context.params
    const tenant = access.tenant

    const site = await db.site.findFirst({
      where: { id: siteId, tenantId: access.tenantId },
      select: { id: true, name: true },
    })
    if (!site) return apiError("not_found", { message: "Site not found" })

    const parsed = await readJson(request, chatRequestSchema)
    if (!parsed.ok) return parsed.response
    const { prompt, conversationId } = parsed.data

    // Find or create conversation
    let conv = conversationId
      ? await db.siteConversation.findUnique({ where: { id: conversationId } })
      : await db.siteConversation.findFirst({ where: { siteId: site.id }, orderBy: { updatedAt: "desc" } })

    if (!conv) {
      conv = await db.siteConversation.create({
        data: {
          siteId: site.id,
          title: prompt.slice(0, 40),
        }
      })
    }

    // Save user message to database
    await db.siteMessage.create({
      data: {
        conversationId: conv.id,
        role: "user",
        content: prompt,
        creditsUsed: 0,
        status: "completed",
      }
    })

    // Setup Agent Orchestrator
    const orchestrator = new AgentOrchestrator(
      tenant.id,
      tenant.slug,
      site.id,
      session.user.id
    )

    const stepEvents: AgentStepEvent[] = []

    // Execute Autonomous Pipeline
    const result = await orchestrator.runPipeline(prompt, (event) => {
      stepEvents.push(event)
    })

    if (!result.success) {
      return apiError("validation", { message: result.error || "Gagal mengeksekusi pipeline AI" })
    }

    // Save assistant response message to database
    const assistantMessage = await db.siteMessage.create({
      data: {
        conversationId: conv.id,
        role: "assistant",
        content: `Saya telah memproses permintaan Anda dan menyelesaikan tahapan berikut:\n\n1. **Inspeksi SaCMS MCP:** Menganalisis skema database aktif.\n2. **Mutasi Skema:** Menerapkan pembuatan tipe koleksi baru (+${result.createdTypes?.length || 0} tipe).\n3. **Generasi Kode Next.js:** Menghasilkan ${result.updatedFiles.length} berkas frontend terhubung ke SaCMS Content API.\n\nWebsite Anda kini sudah aktif di Live Preview!`,
        thought: "Pipeline eksekusi 2-fase selesai dengan sukses.",
        toolCalls: result.createdTypes?.map((t) => ({ tool: "create_content_type", target: t, status: "success" })) || [],
        schemaDiff: result.schemaDiff,
        creditsUsed: result.creditsUsed,
        status: "completed",
      }
    })

    return NextResponse.json({
      success: true,
      message: assistantMessage,
      steps: stepEvents,
      updatedFiles: result.updatedFiles,
      schemaDiff: result.schemaDiff,
      creditsUsed: result.creditsUsed,
    })
  },
  { minRole: "admin" },
)
