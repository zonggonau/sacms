import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { listChats, createChat, MESSAGE_MAX_LENGTH } from "@/lib/ai-site/chats"

export const GET = withStaffAuth(async (_req, context, { access }) => {
  const { projectId } = await context.params
  const tenantDb = await getTenantDb(access.tenant.slug)
  const project = await tenantDb.aiSiteProject.findFirst({
    where: { id: projectId, tenantId: access.tenantId },
    select: { id: true },
  })
  if (!project) return apiError("not_found", { message: "Project not found" })

  const chats = await listChats(tenantDb, projectId)
  return NextResponse.json({ chats })
}, { minRole: "editor" })

export const POST = withStaffAuth(async (req, context, { access }) => {
  const { projectId } = await context.params
  const tenantDb = await getTenantDb(access.tenant.slug)
  const project = await tenantDb.aiSiteProject.findFirst({
    where: { id: projectId, tenantId: access.tenantId },
    select: { id: true },
  })
  if (!project) return apiError("not_found", { message: "Project not found" })

  // One chat per project — the chat IS the website being developed, not
  // one of many threads about it.
  const existingChats = await tenantDb.aiSiteChat.count({ where: { projectId } })
  if (existingChats > 0) {
    return apiError("conflict", { message: "Proyek ini sudah memiliki chat. Satu proyek hanya bisa memiliki satu chat." })
  }

  const { text } = await req.json().catch(() => ({}))
  if (!text || typeof text !== "string" || !text.trim()) {
    return apiError("validation", { message: "Enter a message." })
  }
  if (text.length > MESSAGE_MAX_LENGTH) {
    return apiError("validation", { message: "That message is too long." })
  }

  const chat = await createChat(tenantDb, projectId, access.userId, text.trim())
  return NextResponse.json({ chat }, { status: 201 })
}, { minRole: "editor" })
