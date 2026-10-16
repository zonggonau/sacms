import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { deleteProjectSandbox } from "@/lib/ai-site/sandbox"

export const GET = withStaffAuth(async (_req, context, { access }) => {
  const { projectId } = await context.params
  const tenantDb = await getTenantDb(access.tenant.slug)
  const project = await tenantDb.aiSiteProject.findFirst({
    where: { id: projectId, tenantId: access.tenantId },
  })
  if (!project) return apiError("not_found", { message: "Project not found" })

  return NextResponse.json({ project })
}, { minRole: "editor" })

export const PATCH = withStaffAuth(async (req, context, { access }) => {
  const { projectId } = await context.params
  const tenantDb = await getTenantDb(access.tenant.slug)
  const existing = await tenantDb.aiSiteProject.findFirst({
    where: { id: projectId, tenantId: access.tenantId },
  })
  if (!existing) return apiError("not_found", { message: "Project not found" })

  const { name, description } = await req.json().catch(() => ({}))
  const project = await tenantDb.aiSiteProject.update({
    where: { id: projectId },
    data: {
      ...(typeof name === "string" && name.trim() ? { name: name.trim() } : {}),
      ...(typeof description === "string" ? { description: description.trim() || null } : {}),
    },
  })

  return NextResponse.json({ project })
}, { minRole: "editor" })

export const DELETE = withStaffAuth(async (_req, context, { access }) => {
  const { projectId } = await context.params
  const tenantDb = await getTenantDb(access.tenant.slug)
  const existing = await tenantDb.aiSiteProject.findFirst({
    where: { id: projectId, tenantId: access.tenantId },
  })
  if (!existing) return apiError("not_found", { message: "Project not found" })

  await deleteProjectSandbox(access.tenantId, projectId).catch(() => undefined)
  await tenantDb.aiSiteProject.delete({ where: { id: projectId } })

  return NextResponse.json({ success: true })
}, { minRole: "editor" })
