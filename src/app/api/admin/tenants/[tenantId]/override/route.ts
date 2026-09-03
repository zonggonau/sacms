import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"
import { withAdminAuth } from "@/lib/api/route-helpers"

const overrideSchema = z.object({
  maxContentTypes: z.number().int().nonnegative().nullable().optional(),
  maxContentEntries: z.number().int().nonnegative().nullable().optional(),
  maxTeamMembers: z.number().int().nonnegative().nullable().optional(),
  maxStorage: z.number().int().nonnegative().nullable().optional(),
  maxLocales: z.number().int().nonnegative().nullable().optional(),
  maxApiCalls: z.number().int().nonnegative().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
})

export const GET = withAdminAuth(async (_request, context) => {
  const { tenantId } = await context.params
  const override = await db.customPlanOverride.findUnique({ where: { tenantId } })
  return NextResponse.json({ override })
})

export const POST = withAdminAuth(async (request, context, { session }) => {
  const { tenantId } = await context.params
  const result = await validateBody(request, overrideSchema)
  if ("error" in result) return result.error

  const { maxContentTypes, maxContentEntries, maxTeamMembers, maxStorage, maxLocales, maxApiCalls, note } = result.data
  const creator = session.user.email || session.user.name || "super_admin"

  const values = {
    maxContentTypes: maxContentTypes ?? null,
    maxContentEntries: maxContentEntries ?? null,
    maxTeamMembers: maxTeamMembers ?? null,
    maxStorage: maxStorage ?? null,
    maxLocales: maxLocales ?? null,
    maxApiCalls: maxApiCalls ?? null,
    note: note ?? null,
  }

  const override = await db.customPlanOverride.upsert({
    where: { tenantId },
    update: values,
    create: { tenantId, ...values, createdBy: creator },
  })
  return NextResponse.json({ override })
})

export const DELETE = withAdminAuth(async (_request, context) => {
  const { tenantId } = await context.params
  await db.customPlanOverride.deleteMany({ where: { tenantId } })
  return NextResponse.json({ success: true })
})
