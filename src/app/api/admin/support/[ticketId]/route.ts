import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { z } from "zod"
import { sendSupportNotificationEmail } from "@/lib/mail"
import { withAdminAuth, apiError, readJson } from "@/lib/api/route-helpers"

/**
 * Admin-side ticket detail/reply/status routes — distinct from
 * src/app/api/tenant/[tenant]/support/[ticketId]/route.ts, which filters
 * `where: { id, tenantId: access.tenantId }` and so can NEVER match a
 * ticket whose tenantId is null (account-level tickets not tied to any
 * workspace). The admin dashboard used to borrow that tenant-scoped route
 * by guessing a fake tenant slug ("global") for such tickets — the lookup
 * failed regardless of which slug was used, since the filter is on
 * tenantId, not slug, so these tickets were permanently unopenable from
 * /admin/support. These routes look tickets up by id alone (no tenant
 * scoping needed — admin staff can see every ticket, same as the list at
 * src/app/api/admin/support/route.ts) and work for every ticket.
 */

const sendMessageSchema = z.object({
  message: z.string().min(1, "Pesan tidak boleh kosong"),
  attachments: z.array(z.string()).optional(),
})

const updateTicketSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
})

/** GET — ticket detail + conversation thread. Marks incoming messages read. */
export const GET = withAdminAuth(
  async (_request, context) => {
    const { ticketId } = await context.params
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true, role: true } },
        tenant: { select: { id: true, name: true, slug: true, plan: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    })
    if (!ticket) return apiError("not_found", { message: "Ticket not found" })

    await db.supportMessage
      .updateMany({
        where: { ticketId: ticket.id, senderRole: { not: "admin" }, isRead: false },
        data: { isRead: true },
      })
      .catch(() => {})

    return NextResponse.json({ ticket })
  },
  { allowRoles: ["employee"] },
)

/** POST — staff reply to a ticket. */
export const POST = withAdminAuth(
  async (request, context, { session }) => {
    const { ticketId } = await context.params
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: { select: { id: true, name: true, email: true } }, tenant: { select: { slug: true, name: true } } },
    })
    if (!ticket) return apiError("not_found", { message: "Ticket not found" })

    const parsed = await readJson(request, sendMessageSchema)
    if (!parsed.ok) return parsed.response

    const newMessage = await db.supportMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: session.user.id,
        senderRole: "admin",
        message: parsed.data.message,
        attachments:
          parsed.data.attachments && parsed.data.attachments.length > 0 ? (parsed.data.attachments as any) : undefined,
        isRead: false,
      },
    })

    await db.supportTicket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } })

    if (ticket.user.email) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      sendSupportNotificationEmail({
        to: ticket.user.email,
        recipientName: ticket.user.name || "Owner Workspace",
        ticketId: ticket.id,
        subject: ticket.subject,
        senderName: "Tim IT Support SaCMS",
        senderRole: "admin",
        messagePreview: parsed.data.message,
        viewUrl: ticket.tenant?.slug
          ? `${baseUrl}/dashboard/${ticket.tenant.slug}/support?ticketId=${ticket.id}`
          : `${baseUrl}/dashboard/billing?ticketId=${ticket.id}`,
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, message: newMessage })
  },
  { allowRoles: ["employee"] },
)

/** PATCH — update ticket status/priority from the admin dashboard. */
export const PATCH = withAdminAuth(
  async (request, context) => {
    const { ticketId } = await context.params
    const ticket = await db.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true } })
    if (!ticket) return apiError("not_found", { message: "Ticket not found" })

    const parsed = await readJson(request, updateTicketSchema)
    if (!parsed.ok) return parsed.response

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.status) updateData.status = parsed.data.status
    if (parsed.data.priority) updateData.priority = parsed.data.priority

    const updated = await db.supportTicket.update({ where: { id: ticket.id }, data: updateData })
    return NextResponse.json({ success: true, ticket: updated })
  },
  { allowRoles: ["employee"] },
)
