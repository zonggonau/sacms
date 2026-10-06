import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { AgentOrchestrator, AgentStepEvent, OrchestrationResult } from "@/lib/ai/agent-orchestrator"
import { V0_MODEL_IDS } from "@/lib/v0-client"
import { z } from "zod"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const chatRequestSchema = z.object({
  prompt: z.string().min(2, "Prompt minimal 2 karakter"),
  conversationId: z.string().optional(),
  /** v0 model used for this generation. */
  model: z.enum(V0_MODEL_IDS).optional(),
  /** Stream progress as Server-Sent Events instead of a single JSON response. */
  stream: z.boolean().optional(),
  /** Start a brand-new v0 chat instead of iterating on the current one. */
  forceNew: z.boolean().optional(),
})

function buildAssistantContent(result: OrchestrationResult): string {
  if (result.mode === "iterate") return result.summary

  return `Saya telah memproses permintaan Anda dan menyelesaikan tahapan berikut:\n\n1. **Inspeksi SaCMS MCP:** Menganalisis skema database aktif.\n2. **Mutasi Skema:** Menerapkan pembuatan tipe koleksi baru (+${result.createdTypes?.length || 0} tipe).\n3. **Generasi Frontend (${result.usedV0Sdk ? `SaCMS AI Engine · ${result.model}` : "SaCMS Engine"}):** Menghasilkan ${result.updatedFiles.length} berkas frontend terhubung ke SaCMS Content API.\n\nWebsite Anda kini sudah aktif di Live Preview! Kirim instruksi lanjutan untuk menyempurnakannya.`
}

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
    const { prompt, conversationId, model, stream, forceNew } = parsed.data

    // Find or create conversation
    let conv = conversationId
      ? await db.siteConversation.findUnique({ where: { id: conversationId } })
      : await db.siteConversation.findFirst({ where: { siteId: site.id }, orderBy: { updatedAt: "desc" } })

    if (!conv) {
      conv = await db.siteConversation.create({
        data: {
          siteId: site.id,
          title: prompt.slice(0, 40),
        },
      })
    }
    const conversation = conv

    // Save user message to database
    await db.siteMessage.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: prompt,
        creditsUsed: 0,
        status: "completed",
      },
    })

    const orchestrator = new AgentOrchestrator(tenant.id, tenant.slug, site.id, session.user.id)

    /** Persist the assistant reply and build the response payload. */
    const finalize = async (result: OrchestrationResult, stepEvents: AgentStepEvent[]) => {
      const assistantMessage = await db.siteMessage.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: buildAssistantContent(result),
          thought: result.usedV0Sdk
            ? `Frontend dihasilkan oleh SaCMS AI Engine (${result.model || "v0-pro"}${result.mode === "iterate" ? ", iterasi" : ""}).`
            : "Pipeline eksekusi 2-fase selesai dengan sukses.",
          toolCalls: result.createdTypes?.map((t) => ({ tool: "create_content_type", target: t, status: "success" })) || [],
          schemaDiff: result.schemaDiff,
          creditsUsed: result.creditsUsed,
          status: "completed",
        },
      })

      return {
        success: true,
        message: assistantMessage,
        steps: stepEvents,
        updatedFiles: result.updatedFiles,
        changedFiles: result.changedFiles,
        schemaDiff: result.schemaDiff,
        creditsUsed: result.creditsUsed,
        usedV0Sdk: result.usedV0Sdk,
        v0ChatId: result.v0ChatId,
        v0PreviewUrl: result.v0PreviewUrl,
        mode: result.mode,
        model: result.model,
      }
    }

    // ── Streaming (SSE) mode: live pipeline steps like v0.app ─────────────────
    if (stream) {
      const encoder = new TextEncoder()
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (event: Record<string, unknown>) => {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            } catch {
              /* client disconnected */
            }
          }
          const stepEvents: AgentStepEvent[] = []

          try {
            const result = await orchestrator.runPipeline(
              prompt,
              (event) => {
                stepEvents.push(event)
                send({ type: "step", step: event.step, message: event.message })
              },
              { model, forceNew }
            )

            if (!result.success) {
              send({ type: "error", message: result.error || "Gagal mengeksekusi pipeline AI" })
            } else {
              send({ type: "done", payload: await finalize(result, stepEvents) })
            }
          } catch (err: any) {
            send({ type: "error", message: err?.message || "Terjadi kesalahan tak terduga" })
          } finally {
            controller.close()
          }
        },
      })

      return new Response(body, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      })
    }

    // ── Classic JSON mode ─────────────────────────────────────────────────────
    const stepEvents: AgentStepEvent[] = []
    const result = await orchestrator.runPipeline(
      prompt,
      (event) => {
        stepEvents.push(event)
      },
      { model, forceNew }
    )

    if (!result.success) {
      return apiError("validation", { message: result.error || "Gagal mengeksekusi pipeline AI" })
    }

    return NextResponse.json(await finalize(result, stepEvents))
  },
  { minRole: "admin" },
)
