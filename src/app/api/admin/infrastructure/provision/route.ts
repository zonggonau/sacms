import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { provisionTenantInfrastructure } from "@/lib/infrastructure/provisioner"
import { z } from "zod/v4"

const provisionSchema = z.object({
  tenantId: z.string().min(1),
  plan: z.string().optional().default("vps-s"),
  region: z.string().optional().default("EU"),
  diskGb: z.number().optional().default(75),
  ramMb: z.number().optional().default(8192),
  cpuCount: z.number().optional().default(4),
  subscriptionId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 })
    }

    const body = await req.json()
    const parsed = provisionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload", details: parsed.error.format() }, { status: 400 })
    }

    const result = await provisionTenantInfrastructure(parsed.data.tenantId, {
      plan: parsed.data.plan,
      region: parsed.data.region,
      diskGb: parsed.data.diskGb,
      ramMb: parsed.data.ramMb,
      cpuCount: parsed.data.cpuCount,
      subscriptionId: parsed.data.subscriptionId,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[API Admin Infrastructure Provision Error]:", error)
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
  }
}
