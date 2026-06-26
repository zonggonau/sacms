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
  const enterprise = await isEnterpriseTenant(session.user.id)

  // 1. Fetch Workspace Plans directly from DB
  let accountPlans: any[] = []
  try {
    const contentType = await db.contentType.findFirst({
      where: { slug: "sacms-workspace-pricing", tenantId: null }
    })

    if (contentType) {
      const entries = await db.contentEntry.findMany({
        where: { contentTypeId: contentType.id, tenantId: null, status: "PUBLISHED" },
        orderBy: { createdAt: "asc" }
      })

      accountPlans = entries.map(t => {
        const d = (typeof t.data === 'string' ? JSON.parse(t.data) : t.data) as any
        
        let price = 0
        if (typeof d.price === 'string') {
          price = parseInt(d.price.replace(/[^\d]/g, ''), 10) || 0
        } else {
          price = Number(d.price) || 0
        }

        let displayPrice = "Rp 0"
        const yearlyPrice = d.yearly_price !== undefined ? d.yearly_price : price * 10
        
        if (price > 0) {
          if (yearlyPrice >= 1000000) {
            displayPrice = `Rp ${(yearlyPrice / 1000000).toLocaleString('id-ID')}M`
          } else {
            displayPrice = `Rp ${(yearlyPrice / 1000).toLocaleString('id-ID')}k`
          }
        } else if (price === 0 && d.cta_text?.toLowerCase().includes('contact')) {
          displayPrice = "Custom"
        }

        const features = Array.isArray(d.features) 
          ? d.features 
          : (typeof d.features === 'string' ? d.features.split(',').map((s: string) => s.trim()) : [])

        return {
          id: d.plan_slug || t.id,
          name: d.name || "Unnamed Plan",
          workspaces: d.max_workspaces || "Unlimited",
          price: displayPrice,
          priceAmount: price,
          features: features
        }
      })

      // Add a fallback Free plan if not present
      if (!accountPlans.some(p => p.id === "free" || p.priceAmount === 0)) {
         accountPlans.unshift({
           id: "free",
           name: "Free Forever",
           workspaces: "1",
           price: "Rp 0",
           priceAmount: 0,
           features: ["1 Workspace", "Basic Support"]
         })
      }
      
      accountPlans.sort((a, b) => (a.priceAmount || 0) - (b.priceAmount || 0))
    }
  } catch (err) {
    console.error("Failed to fetch workspace plans:", err)
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
