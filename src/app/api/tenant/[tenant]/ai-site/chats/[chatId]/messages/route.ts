import { convertToModelMessages, createIdGenerator, stepCountIs, streamText, type UIMessage } from "ai"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { resolveGatewayModel, toUsageTotals } from "@/lib/ai"
import { reserveAiSiteTurn, refundAiSiteTurn, recordAiSiteTurnUsage } from "@/lib/ai-site/quota"
import { aiSiteTools } from "@/lib/ai-site/tools"
import { aiSiteSystemPrompt } from "@/lib/ai-site/prompt"
import { listProjectFiles } from "@/lib/ai-site/files"
import { loadMessages, saveMessages, deleteMessages, userMessage, MESSAGE_MAX_LENGTH } from "@/lib/ai-site/chats"

export const maxDuration = 300

const MAX_STEPS = 40

type SendBody = {
  trigger?: "submit-message" | "regenerate-message"
  message?: { id?: unknown; role?: unknown; parts?: unknown }
}

/**
 * Generates the assistant's reply for an AI Site chat turn. The client sends
 * only its newest message; history comes from the database, and the user
 * message is rebuilt from its text so a client cannot inject tool results or
 * assistant turns.
 */
export const POST = withStaffAuth(async (request, context, { access }) => {
  const { chatId } = await context.params
  const tenantDb = await getTenantDb(access.tenant.slug)

  const chat = await tenantDb.aiSiteChat.findUnique({
    where: { id: chatId },
    include: { project: true },
  })
  if (!chat || chat.project.tenantId !== access.tenantId) {
    return apiError("not_found", { message: "Chat not found" })
  }

  const body = (await request.json().catch(() => null)) as SendBody | null

  let history = await loadMessages(tenantDb, chatId)

  if (body?.trigger === "submit-message") {
    const text = messageText(body.message)
    if (!text) return apiError("validation", { message: "Enter a message." })
    if (text.length > MESSAGE_MAX_LENGTH) {
      return apiError("validation", { message: "That message is too long." })
    }
    const message = userMessage(text)
    await saveMessages(tenantDb, chatId, [message])
    history = [...history, message]
  } else if (body?.trigger === "regenerate-message") {
    const lastUser = history.findLastIndex((message) => message.role === "user")
    if (lastUser === -1) return apiError("validation", { message: "Nothing to respond to." })
    await deleteMessages(tenantDb, chatId, history.slice(lastUser + 1).map((message) => message.id))
    history = history.slice(0, lastUser + 1)
  } else {
    return apiError("validation", { message: "Unknown request." })
  }

  await reserveAiSiteTurn(access.tenantId, access.userId)

  let model: Awaited<ReturnType<typeof resolveGatewayModel>>["model"]
  let modelId: string
  try {
    const resolved = await resolveGatewayModel()
    model = resolved.model
    modelId = resolved.modelId
  } catch (error) {
    await refundAiSiteTurn(access.tenantId, access.userId)
    return apiError("validation", { message: error instanceof Error ? error.message : "AI not configured" })
  }

  const files = await listProjectFiles(tenantDb, chat.projectId)
  const tools = aiSiteTools({
    tenantDb,
    tenantId: access.tenantId,
    tenantSlug: access.tenant.slug,
    tenantName: access.tenant.name,
    projectId: chat.projectId,
  })

  let streamStarted = false
  try {
    const result = streamText({
      model,
      system: aiSiteSystemPrompt({
        tenantName: access.tenant.name,
        projectName: chat.project.name,
        projectDescription: chat.project.description,
        filePaths: files.map((file) => file.path),
      }),
      messages: await convertToModelMessages(history, { tools, ignoreIncompleteToolCalls: true }),
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
      providerOptions: {
        gateway: {
          user: access.userId,
          tags: ["ai-site", `tenant:${access.tenantId}`, `project:${chat.projectId}`],
        },
      },
      abortSignal: request.signal,
      onError: ({ error }) => console.error("[AI Site] Generation failed", error),
    })
    streamStarted = true

    return result.toUIMessageStreamResponse<UIMessage>({
      originalMessages: history,
      generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
      onFinish: async ({ responseMessage }) => {
        if (responseMessage.parts.length > 0) await saveMessages(tenantDb, chatId, [responseMessage])
        const usage = await result.usage
        await recordAiSiteTurnUsage(access.tenantId, access.userId, toUsageTotals(usage), modelId)
      },
      onError: (error) => streamErrorMessage(error),
    })
  } catch (error) {
    if (!streamStarted) await refundAiSiteTurn(access.tenantId, access.userId)
    throw error
  }
}, { minRole: "editor" })

function messageText(message: SendBody["message"]) {
  if (!message || message.role !== "user" || !Array.isArray(message.parts)) return ""
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim()
}

function streamErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (/AI_GATEWAY_API_KEY|api key|authentication/i.test(message)) {
    return "The AI Gateway rejected the request. Check the Gateway API key in Admin > Settings."
  }
  return message.slice(0, 500) || "Generation failed."
}
