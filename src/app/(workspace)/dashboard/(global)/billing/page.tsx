import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import BillingClient from "./billing-client"
import { getTransactionHistoryAction } from "@/actions/billing"
import { db } from "@/lib/database"

export default async function BillingPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect("/login")
  }

  const globalToken = process.env.NEXT_PUBLIC_SYSTEM_API_KEY || "cf_cc0045e6f75d9cb58a5a81a4b03dbc5602258b70c06c5c6ce8be304e9474b5fd"
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"

  const { isEnterpriseTenant } = await import("@/lib/license")
  const enterprise = await isEnterpriseTenant("sacms-global")

  // 1. Fetch Account Plans
  let accountPlans: any[] = []
  try {
    const res = await fetch(`${baseUrl}/api/public/plans?type=account`, {
      headers: { "Authorization": `Bearer ${globalToken}` },
      cache: "no-store"
    })
    const json = await res.json()
    if (json.plans && Array.isArray(json.plans)) {
      accountPlans = json.plans.map((p: any) => {
        let displayPrice = "Rp 0"
        const yearlyPrice = p.yearlyPrice !== undefined ? p.yearlyPrice : p.price * 10
        
        if (p.price > 0) {
          if (yearlyPrice >= 1000000) {
            displayPrice = `Rp ${(yearlyPrice / 1000000).toLocaleString('id-ID')}M`
          } else {
            displayPrice = `Rp ${(yearlyPrice / 1000).toLocaleString('id-ID')}k`
          }
        } else if (p.price === 0 && p.cta?.toLowerCase().includes('contact')) {
          displayPrice = "Custom"
        }
        
        return {
          id: p.id,
          name: p.name,
          workspaces: p.max_workspaces || "Unlimited",
          price: displayPrice,
          priceAmount: p.price,
          features: p.features || []
        }
      })
    }
  } catch (err) {
    console.error("Failed to fetch account plans:", err)
  }

  // 2. Fetch Active Workspaces Count & Usage
  let activeWorkspacesCount = 0
  let usage = null
  try {
    // Get usage from enforcement
    const { enforceUserPlanLimit } = await import("@/lib/plan-enforcement")
    const workspaceEnforcement = await enforceUserPlanLimit(session.user.id, "workspaces")
    
    usage = {
      current: workspaceEnforcement.current,
      max: workspaceEnforcement.max,
      allowed: workspaceEnforcement.allowed,
      plan: workspaceEnforcement.planSlug
    }
    activeWorkspacesCount = workspaceEnforcement.current
  } catch (err) {
    console.error("Failed to fetch workspace usage:", err)
    // Fallback if the enforcement module fails
    const tenants = await db.tenant.count({
      where: {
        members: { some: { userId: session.user.id } },
        slug: { notIn: ["sacms-global"] }
      }
    })
    activeWorkspacesCount = tenants
  }

  // 3. Fetch Transaction History
  let transactions: any[] = []
  try {
    const tx = await getTransactionHistoryAction()
    if (tx) {
      transactions = tx
    }
  } catch (err) {
    console.error("Failed to fetch transactions:", err)
  }

  return (
    <BillingClient 
      initialAccountPlans={accountPlans}
      initialActiveWorkspacesCount={activeWorkspacesCount}
      initialUsage={usage}
      initialTransactions={transactions}
      isEnterpriseMode={enterprise}
    />
  )
}
