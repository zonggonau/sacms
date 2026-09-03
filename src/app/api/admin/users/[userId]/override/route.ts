import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"
import { withAdminAuth } from "@/lib/api/route-helpers"

const overrideSchema = z.object({
  maxWorkspaces: z.number().int().nonnegative().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
})

export const GET = withAdminAuth(async (_request, context) => {
  const { userId } = await context.params
  const override = await db.customPlanOverride.findUnique({ where: { userId } })
  return NextResponse.json({ override })
})

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
  return NextResponse.json({ override })
})

export const DELETE = withAdminAuth(async (_request, context) => {
  const { userId } = await context.params
  await db.customPlanOverride.deleteMany({ where: { userId } })
  return NextResponse.json({ success: true })
})
