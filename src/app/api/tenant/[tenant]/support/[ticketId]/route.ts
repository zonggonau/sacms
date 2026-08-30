import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { z } from "zod"
import { sendSupportNotificationEmail } from "@/lib/mail"

const sendMessageSchema = z.object({
  message: z.string().min(1, "Pesan tidak boleh kosong"),
  attachments: z.array(z.string()).optional(),
})

// GET /api/tenant/[tenant]/support/[ticketId] - Get single ticket details and conversation thread
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; ticketId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlugOrId, ticketId } = await params
    const tenant = await db.tenant.findFirst({
      where: { OR: [{ id: tenantSlugOrId }, { slug: tenantSlugOrId }] },
      select: { id: true, slug: true, name: true }
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true, role: true } },
        tenant: { select: { id: true, name: true, slug: true, plan: true } },
        messages: {
          orderBy: { createdAt: "asc" },
        }
      }
    })

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    // Check access
    const isSuperAdmin = session.user.role === "super_admin"
    if (!isSuperAdmin && ticket.tenantId !== tenant.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Mark unread messages as read
    await db.supportMessage.updateMany({
      where: {
        ticketId: ticket.id,
        senderId: { not: session.user.id },
        isRead: false,
      },
      data: { isRead: true }
    }).catch(() => {})

    return NextResponse.json({ ticket })
  } catch (error: any) {
    console.error("[Support Ticket Detail GET Error]:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

// POST /api/tenant/[tenant]/support/[ticketId] - Reply to ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; ticketId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlugOrId, ticketId } = await params
    const tenant = await db.tenant.findFirst({
      where: { OR: [{ id: tenantSlugOrId }, { slug: tenantSlugOrId }] },
      select: { id: true, slug: true, name: true }
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      }
    })

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const body = await request.json()
    const parsed = sendMessageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Pesan tidak valid", details: parsed.error.format() }, { status: 400 })
    }

    const isSuperAdmin = session.user.role === "super_admin"
    const senderRole = isSuperAdmin ? "admin" : "user"

    const newMessage = await db.supportMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: session.user.id,
        senderRole,
        message: parsed.data.message,
        attachments: parsed.data.attachments && parsed.data.attachments.length > 0 ? (parsed.data.attachments as any) : undefined,
        isRead: false,
      }
    })

    // Update ticket timestamp and reopen if closed and sent by user
    const newStatus = !isSuperAdmin && ticket.status === "resolved" ? "open" : ticket.status
    await db.supportTicket.update({
      where: { id: ticket.id },
      data: {
        updatedAt: new Date(),
        status: newStatus
      }
    })

    // Dispatch email notification
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    if (isSuperAdmin) {
      // Admin replied -> Notify ticket owner
      if (ticket.user.email) {
        sendSupportNotificationEmail({
          to: ticket.user.email,
          recipientName: ticket.user.name || "Owner Workspace",
          ticketId: ticket.id,
          subject: ticket.subject,
          senderName: "Tim IT Support SaCMS",
          senderRole: "admin",
          messagePreview: parsed.data.message,
          viewUrl: `${baseUrl}/dashboard/${tenant.slug}/support?ticketId=${ticket.id}`
        }).catch(() => {})
      }
    } else {
      // Tenant replied -> Notify platform super admins
      try {
        const superAdmins = await db.user.findMany({
          where: { role: "super_admin" },
          select: { email: true }
        })
        const adminEmails = superAdmins.map(a => a.email).filter(Boolean)
        for (const email of adminEmails) {
          sendSupportNotificationEmail({
            to: email,
            recipientName: "Tim IT Support SaCMS",
            ticketId: ticket.id,
            subject: ticket.subject,
            senderName: `${session.user.name || session.user.email} (${tenant.name})`,
            senderRole: "user",
            messagePreview: parsed.data.message,
            viewUrl: `${baseUrl}/admin/support?ticketId=${ticket.id}`
          }).catch(() => {})
        }
      } catch {}
    }

    return NextResponse.json({ success: true, message: newMessage })
  } catch (error: any) {
    console.error("[Support Message Reply Error]:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/tenant/[tenant]/support/[ticketId] - Update status or priority
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; ticketId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { ticketId } = await params
    const body = await request.json()
    const { status, priority } = body

    const updateData: any = { updatedAt: new Date() }
    if (status) updateData.status = status
    if (priority) updateData.priority = priority

    const updated = await db.supportTicket.update({
      where: { id: ticketId },
      data: updateData
    })

    return NextResponse.json({ success: true, ticket: updated })
  } catch (error: any) {
    console.error("[Support Ticket Status Update Error]:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
