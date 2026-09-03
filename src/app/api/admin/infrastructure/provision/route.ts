import { NextResponse } from "next/server"
import { provisionTenantInfrastructure } from "@/lib/infrastructure/provisioner"
import { z } from "zod/v4"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"

const provisionSchema = z.object({
  tenantId: z.string().min(1),
  plan: z.string().optional().default("vps-4"),
  region: z.string().optional().default("SIN"),
  diskGb: z.number().optional(),
  ramMb: z.number().optional(),
  cpuCount: z.number().optional(),
  subscriptionId: z.string().optional(),
})

export const POST = withAdminAuth(async (req) => {
  const parsed = provisionSchema.safeParse(await req.json())
  if (!parsed.success) {
    return apiError("validation", {
      message: "Invalid request payload",
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    })
  }

  const result = await provisionTenantInfrastructure(parsed.data.tenantId, {
    plan: parsed.data.plan,
    region: parsed.data.region,
    diskGb: parsed.data.diskGb,
    ramMb: parsed.data.ramMb,
    cpuCount: parsed.data.cpuCount,
    subscriptionId: parsed.data.subscriptionId,
  })
  if (!result.success) return apiError("internal", { message: result.message })

  return NextResponse.json(result)
})
