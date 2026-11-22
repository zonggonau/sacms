import { NextResponse } from "next/server"
import { z } from "zod"
import { withAdminAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { decideApproval } from "@/lib/infrastructure/mcp-approvals"

const decisionSchema = z.object({ decision: z.enum(["approve", "reject"]) })

export const POST = withAdminAuth(async (req, context, { session }) => {
  const { id } = await context.params
  const parsed = await readJson(req, decisionSchema)
  if (!parsed.ok) return parsed.response

  const result = await decideApproval(id, parsed.data.decision, session.user.id)
  if (!result.ok) return apiError("conflict", { message: result.error })
  return NextResponse.json(result)
})
