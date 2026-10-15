import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"
import { withAdminAuth } from "@/lib/api/route-helpers"
import { logAudit, AuditAction } from "@/lib/audit-log"

const overrideSchema = z.object({
  maxWorkspaces: z.number().int().nonnegative().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
})

// GET/POST/DELETE used to call withAdminAuth with no options, defaulting to
// super_admin-only (route-helpers.ts) — every sibling route on this same
// page (users/route.ts, [userId]/route.ts, verify/route.ts) passes
// allowRoles: ["admin"]. The "Kustomisasi Kuota" action is shown to any
// admin (page.tsx's isAdmin gate), so a plain admin clicking it always
// 403'd with no indication why the dialog looked empty/broken.
export const GET = withAdminAuth(async (_request, context) => {
  const { userId } = await context.params
  const override = await db.customPlanOverride.findUnique({ where: { userId } })
  return NextResponse.json({ override })
}, { allowRoles: ["admin"] })

export const POST = withAdminAuth(async (request, context, { session }) => {
  const { userId } = await context.params
  const result = await validateBody(request, overrideSchema)
  if ("error" in result) return result.error

  const { maxWorkspaces, note } = result.data
  const creator = session.user.email || session.user.name || "super_admin"

  const override = await db.customPlanOverride.upsert({
    where: { userId },
    update: { maxWorkspaces: maxWorkspaces ?? null, note: note ?? null },
    create: { userId, maxWorkspaces: maxWorkspaces ?? null, note: note ?? null, createdBy: creator },
  })

  logAudit({
    userId: session.user.id,
    action: AuditAction.SETTINGS_UPDATED,
    entity: "UserQuotaOverride",
    entityId: userId,
    data: { maxWorkspaces: maxWorkspaces ?? null, note: note ?? null },
  })

  return NextResponse.json({ override })
}, { allowRoles: ["admin"] })

export const DELETE = withAdminAuth(async (_request, context, { session }) => {
  const { userId } = await context.params
  await db.customPlanOverride.deleteMany({ where: { userId } })

  logAudit({
    userId: session.user.id,
    action: AuditAction.SETTINGS_UPDATED,
    entity: "UserQuotaOverride",
    entityId: userId,
    data: { removed: true },
  })

  return NextResponse.json({ success: true })
}, { allowRoles: ["admin"] })
