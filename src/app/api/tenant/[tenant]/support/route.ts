import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { z } from "zod"
import { sendSupportNotificationEmail } from "@/lib/mail"
import { withStaffAuth, readJson } from "@/lib/api/route-helpers"

const createTicketSchema = z.object({
  subject: z.string().min(3, "Subjek minimal 3 karakter"),
  category: z.enum(["general", "billing", "technical", "infrastructure", "domain"]).default("general"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  initialMessage: z.string().min(3, "Pesan tidak boleh kosong"),
  attachments: z.array(z.string()).optional(),
})

/** GET /api/tenant/[tenant]/support — support tickets for this workspace. */
export const GET = withStaffAuth(async (_request, _context, { access }) => {
  const tickets = await db.supportTicket.findMany({
    where: { tenantId: access.tenantId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true, role: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
  })
  return NextResponse.json({ tickets })
})

/** POST /api/tenant/[tenant]/support — open a support ticket. */
export const POST = withStaffAuth(async (request, _context, { access, session }) => {
  const parsed = await readJson(request, createTicketSchema)
  if (!parsed.ok) return parsed.response
  const { subject, category, priority, initialMessage, attachments } = parsed.data

  const tenant = await db.tenant.findUnique({ where: { id: access.tenantId }, select: { name: true } })

  const ticket = await db.supportTicket.create({
    data: {
      tenantId: access.tenantId,
      userId: session.user.id,
      subject,
      category,
      priority,
      status: "open",
      messages: {
        create: {
          senderId: session.user.id,
          senderRole: session.user.role === "super_admin" ? "admin" : "user",
          message: initialMessage,
          attachments: attachments && attachments.length > 0 ? (attachments as any) : undefined,
          isRead: false,
        },
      },
    },
    include: { messages: true, user: { select: { id: true, name: true, email: true } } },
  })

  // Notify platform super-admins (fire and forget).
  try {
    const superAdmins = await db.user.findMany({ where: { role: "super_admin" }, select: { email: true } })
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    for (const email of superAdmins.map((a) => a.email).filter(Boolean)) {
      sendSupportNotificationEmail({
        to: email,
        recipientName: "Tim IT / CS SaCMS",
        ticketId: ticket.id,
        subject: ticket.subject,
        senderName: `${session.user.name || session.user.email} (${tenant?.name ?? ""})`,
        senderRole: "user",
        messagePreview: initialMessage,
        viewUrl: `${baseUrl}/admin/support?ticketId=${ticket.id}`,
      }).catch(() => {})
    }
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ success: true, ticket })
})
