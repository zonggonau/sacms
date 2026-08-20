import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { AgentOrchestrator, AgentStepEvent } from "@/lib/ai/agent-orchestrator"
import { z } from "zod"

const chatRequestSchema = z.object({
  prompt: z.string().min(2, "Prompt minimal 2 karakter"),
  conversationId: z.string().optional(),
})

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
      select: { id: true, name: true }
    })

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    }

    const json = await request.json()
    const parsed = chatRequestSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

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
      return NextResponse.json({ error: result.error || "Gagal mengeksekusi pipeline AI" }, { status: 400 })
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
  } catch (error: any) {
    console.error("Chat orchestration error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
