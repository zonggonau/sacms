import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { z } from "zod"
import { sendSupportNotificationEmail } from "@/lib/mail"

const createTicketSchema = z.object({
  subject: z.string().min(3, "Subjek minimal 3 karakter"),
  category: z.enum(["general", "billing", "technical", "infrastructure", "domain"]).default("general"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  initialMessage: z.string().min(3, "Pesan tidak boleh kosong"),
  attachments: z.array(z.string()).optional(),
})

// GET /api/tenant/[tenant]/support - Get list of tickets for this tenant
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlugOrId } = await params
    const tenant = await db.tenant.findFirst({
      where: {
        OR: [{ id: tenantSlugOrId }, { slug: tenantSlugOrId }],
      },
      select: { id: true, slug: true, name: true }
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    // Verify membership or super_admin
    const isSuperAdmin = session.user.role === "super_admin"
    if (!isSuperAdmin) {
      const membership = await db.tenantMember.findFirst({
        where: { tenantId: tenant.id, userId: session.user.id }
      })
      if (!membership) {
        return NextResponse.json({ error: "Forbidden: Not a member of this workspace" }, { status: 403 })
      }
    }

    const tickets = await db.supportTicket.findMany({
      where: { tenantId: tenant.id },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true, role: true }
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { updatedAt: "desc" }
    })

    return NextResponse.json({ tickets })
  } catch (error: any) {
    console.error("[Support Ticket List Error]:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

// POST /api/tenant/[tenant]/support - Create new support ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlugOrId } = await params
    const tenant = await db.tenant.findFirst({
      where: {
        OR: [{ id: tenantSlugOrId }, { slug: tenantSlugOrId }],
      },
      select: { id: true, slug: true, name: true }
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    const body = await request.json()
    const parsed = createTicketSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tiket tidak valid", details: parsed.error.format() }, { status: 400 })
    }

    const { subject, category, priority, initialMessage, attachments } = parsed.data

    const ticket = await db.supportTicket.create({
      data: {
        tenantId: tenant.id,
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
          }
        }
      },
      include: {
        messages: true,
        user: { select: { id: true, name: true, email: true } },
      }
    })

    // Send email alert to platform Super Admins in background
    try {
      const superAdmins = await db.user.findMany({
        where: { role: "super_admin" },
        select: { email: true }
      })
      const adminEmails = superAdmins.map(a => a.email).filter(Boolean)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      for (const email of adminEmails) {
        sendSupportNotificationEmail({
          to: email,
          recipientName: "Tim IT / CS SaCMS",
          ticketId: ticket.id,
          subject: ticket.subject,
          senderName: `${session.user.name || session.user.email} (${tenant.name})`,
          senderRole: "user",
          messagePreview: initialMessage,
          viewUrl: `${baseUrl}/admin/support?ticketId=${ticket.id}`
        }).catch(() => {})
      }
    } catch {}

    return NextResponse.json({ success: true, ticket })
  } catch (error: any) {
    console.error("[Support Ticket Create Error]:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
