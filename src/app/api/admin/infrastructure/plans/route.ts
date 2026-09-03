import { NextResponse } from "next/server"
import { getContaboPlansList, isContaboConfigured } from "@/lib/infrastructure/contabo"
import { withAdminAuth } from "@/lib/api/route-helpers"

export const GET = withAdminAuth(async () => {
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
        itemCount: plans.filter((p) => p.type === "VPS").length,
      },
      {
        key: "VDS",
        title: "Cloud VDS (100% Dedicated Physical Cores)",
        description:
          "Virtual Dedicated Server dengan 100% garansi CPU lock, no noisy neighbor, dan throughput tinggi.",
        itemCount: plans.filter((p) => p.type === "VDS").length,
      },
    ],
  })
})
