import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

export const GET = withStaffAuth(async (_req, _context, { access }) => {
  const tenantDb = await getTenantDb(access.tenant.slug)
  const projects = await tenantDb.aiSiteProject.findMany({
    where: { tenantId: access.tenantId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { chats: true, files: true } } },
  })

  return NextResponse.json({
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      chatCount: p._count.chats,
      fileCount: p._count.files,
    })),
  })
}, { minRole: "editor" })

export const POST = withStaffAuth(async (req, _context, { access }) => {
  const { name, description } = await req.json().catch(() => ({}))
  if (!name || typeof name !== "string" || !name.trim()) {
    return apiError("validation", { message: "Project name is required" })
  }

  const tenantDb = await getTenantDb(access.tenant.slug)

  // One AI Site project per workspace — the single project IS this
  // workspace's website being developed, not one of many.
  const existing = await tenantDb.aiSiteProject.count({ where: { tenantId: access.tenantId } })
  if (existing > 0) {
    return apiError("conflict", { message: "Workspace ini sudah memiliki proyek AI Site. Hapus proyek yang ada untuk membuat yang baru." })
  }

  const project = await tenantDb.aiSiteProject.create({
    data: {
      tenantId: access.tenantId,
      createdByUserId: access.userId,
      name: name.trim(),
      description: typeof description === "string" ? description.trim() || null : null,
    },
  })

  return NextResponse.json({ project }, { status: 201 })
}, { minRole: "editor" })
