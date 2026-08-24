import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getContaboPlansList, isContaboConfigured } from "@/lib/infrastructure/contabo"

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 })
    }

    const plans = getContaboPlansList()
    const isLiveApi = isContaboConfigured()

    return NextResponse.json({
      success: true,
      mode: isLiveApi ? "live_api" : "simulation",
      totalPlans: plans.length,
      plans,
      categories: [
        {
          key: "VPS",
          title: "Cloud VPS (Shared Burstable Cores)",
          description: "Virtual Private Server cost-effective dengan shared CPU dan NVMe storage cepat.",
          itemCount: plans.filter(p => p.type === "VPS").length,
        },
        {
          key: "VDS",
          title: "Cloud VDS (100% Dedicated Physical Cores)",
          description: "Virtual Dedicated Server dengan 100% garansi CPU lock, no noisy neighbor, dan throughput tinggi.",
          itemCount: plans.filter(p => p.type === "VDS").length,
        }
      ]
    })
  } catch (error: any) {
    console.error("[API Contabo Plans Error]:", error)
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
  }
}
