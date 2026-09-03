import { db } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** GET — Server-Sent Events live stream of a ticket's new messages. */
export const GET = withStaffAuth(async (request, context, { access }) => {
  const { ticketId } = await context.params

  const ticket = await db.supportTicket.findFirst({
    where: { id: ticketId, tenantId: access.tenantId },
    select: { id: true },
  })
  if (!ticket) return apiError("not_found", { message: "Ticket not found" })

  const encoder = new TextEncoder()

  // Track latest message timestamp
  let lastCheckedTime = new Date(Date.now() - 5000)

  // Hard cap: a stream lives at most 15 min, then the client must reconnect.
  const MAX_LIFETIME_MS = 15 * 60 * 1000
  const POLL_MS = 3000
  const startedAt = Date.now()

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: "connected", ticketId })}\n\n`))

      let isClosed = false
      let intervalId: ReturnType<typeof setInterval>
      const stop = () => {
        isClosed = true
        clearInterval(intervalId)
        try {
          controller.close()
        } catch {}
      }

      request.signal.addEventListener("abort", stop)

      intervalId = setInterval(async () => {
        if (isClosed || request.signal.aborted || Date.now() - startedAt > MAX_LIFETIME_MS) {
          stop()
          return
        }

        try {
          // Check for new messages created after lastCheckedTime
          const newMessages = await db.supportMessage.findMany({
            where: {
              ticketId,
              createdAt: { gt: lastCheckedTime }
            },
            orderBy: { createdAt: "asc" },
            take: 50,
          })

          if (newMessages.length > 0) {
            lastCheckedTime = newMessages[newMessages.length - 1].createdAt
            for (const msg of newMessages) {
              controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(msg)}\n\n`))
            }
          } else {
            // Keep-alive heartbeat comment to prevent proxy timeout
            controller.enqueue(encoder.encode(`: ping\n\n`))
          }
        } catch (e) {
          // Ignore transient query errors during SSE stream
        }
      }, POLL_MS)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
})
