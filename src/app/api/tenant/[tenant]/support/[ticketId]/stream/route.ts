import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// GET /api/tenant/[tenant]/support/[ticketId]/stream - Server-Sent Events (SSE) Live Stream
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; ticketId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { tenant: tenantSlugOrId, ticketId } = await params

  // Verify ticket exists
  const ticket = await db.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      tenant: { select: { id: true, slug: true } }
    }
  })

  if (!ticket) {
    return new Response("Ticket not found", { status: 404 })
  }

  const isSuperAdmin = session.user.role === "super_admin"
  if (!isSuperAdmin && ticket.tenant?.slug !== tenantSlugOrId && ticket.tenantId !== tenantSlugOrId) {
    return new Response("Forbidden", { status: 403 })
  }

  const encoder = new TextEncoder()

  // Track latest message timestamp
  let lastCheckedTime = new Date(Date.now() - 5000)

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: "connected", ticketId })}\n\n`))

      let isClosed = false

      request.signal.addEventListener("abort", () => {
        isClosed = true
        try {
          controller.close()
        } catch {}
      })

      const intervalId = setInterval(async () => {
        if (isClosed || request.signal.aborted) {
          clearInterval(intervalId)
          return
        }

        try {
          // Check for new messages created after lastCheckedTime
          const newMessages = await db.supportMessage.findMany({
            where: {
              ticketId,
              createdAt: { gt: lastCheckedTime }
            },
            orderBy: { createdAt: "asc" }
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
      }, 1500) // 1.5s sub-second low-latency streaming
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
}
