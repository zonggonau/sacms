import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { z } from "zod"
import { sendSupportNotificationEmail } from "@/lib/mail"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"

const sendMessageSchema = z.object({
  message: z.string().min(1, "Pesan tidak boleh kosong"),
  attachments: z.array(z.string()).optional(),
})

/** GET — ticket detail + conversation thread. Marks incoming messages read. */
export const GET = withStaffAuth(async (_request, context, { access, session }) => {
  const { ticketId } = await context.params
  const ticket = await db.supportTicket.findFirst({
    where: { id: ticketId, tenantId: access.tenantId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true, role: true } },
      tenant: { select: { id: true, name: true, slug: true, plan: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  })
  if (!ticket) return apiError("not_found", { message: "Ticket not found" })

  await db.supportMessage
    .updateMany({
      where: { ticketId: ticket.id, senderId: { not: session.user.id }, isRead: false },
      data: { isRead: true },
    })
    .catch(() => {})

  return NextResponse.json({ ticket })
})

/** POST — reply to a ticket. */
export const POST = withStaffAuth(async (request, context, { access, session }) => {
  const { ticketId } = await context.params
  const ticket = await db.supportTicket.findFirst({
    where: { id: ticketId, tenantId: access.tenantId },
    include: { user: { select: { id: true, name: true, email: true } }, tenant: { select: { slug: true, name: true } } },
  })
  if (!ticket) return apiError("not_found", { message: "Ticket not found" })

  const parsed = await readJson(request, sendMessageSchema)
  if (!parsed.ok) return parsed.response

  const isSuperAdmin = session.user.role === "super_admin"
  const senderRole = isSuperAdmin ? "admin" : "user"

  const newMessage = await db.supportMessage.create({
    data: {
      ticketId: ticket.id,
      senderId: session.user.id,
      senderRole,
      message: parsed.data.message,
      attachments:
        parsed.data.attachments && parsed.data.attachments.length > 0 ? (parsed.data.attachments as any) : undefined,
      isRead: false,
    },
  })

  const newStatus = !isSuperAdmin && ticket.status === "resolved" ? "open" : ticket.status
  await db.supportTicket.update({ where: { id: ticket.id }, data: { updatedAt: new Date(), status: newStatus } })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  if (isSuperAdmin && ticket.user.email) {
    sendSupportNotificationEmail({
      to: ticket.user.email,
      recipientName: ticket.user.name || "Owner Workspace",
      ticketId: ticket.id,
      subject: ticket.subject,
      senderName: "Tim IT Support SaCMS",
      senderRole: "admin",
      messagePreview: parsed.data.message,
      viewUrl: `${baseUrl}/dashboard/${ticket.tenant?.slug}/support?ticketId=${ticket.id}`,
    }).catch(() => {})
  } else if (!isSuperAdmin) {
    try {
      const superAdmins = await db.user.findMany({ where: { role: "super_admin" }, select: { email: true } })
      for (const email of superAdmins.map((a) => a.email).filter(Boolean)) {
        sendSupportNotificationEmail({
          to: email,
          recipientName: "Tim IT Support SaCMS",
          ticketId: ticket.id,
          subject: ticket.subject,
          senderName: `${session.user.name || session.user.email} (${ticket.tenant?.name ?? ""})`,
          senderRole: "user",
          messagePreview: parsed.data.message,
          viewUrl: `${baseUrl}/admin/support?ticketId=${ticket.id}`,
        }).catch(() => {})
      }
    } catch {
      /* non-fatal */
    }
  }

  return NextResponse.json({ success: true, message: newMessage })
})

/** PATCH — update ticket status / priority (admin/owner). */
export const PATCH = withStaffAuth(
  async (request, context, { access }) => {
    const { ticketId } = await context.params
    const ticket = await db.supportTicket.findFirst({
      where: { id: ticketId, tenantId: access.tenantId },
      select: { id: true },
    })
    if (!ticket) return apiError("not_found", { message: "Ticket not found" })

    const { status, priority } = await request.json()
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (status) updateData.status = status
    if (priority) updateData.priority = priority

    const updated = await db.supportTicket.update({ where: { id: ticket.id }, data: updateData })
    return NextResponse.json({ success: true, ticket: updated })
  },
  { minRole: "admin" },
)
