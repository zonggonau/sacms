"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, Zap, CreditCard, CheckCircle2, ShieldCheck, Crown, Receipt, Clock, RefreshCw, Database
} from "lucide-react"
import { getTransactionHistoryAction, checkTransactionStatusAction } from "@/actions/billing"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function BillingClient({
  initialAccountPlans,
  initialActiveWorkspacesCount,
  initialUsage,
  initialTransactions,
  isEnterpriseMode
}: {
  initialAccountPlans: any[]
  initialActiveWorkspacesCount: number
  initialUsage: any
  initialTransactions: any[]
  isEnterpriseMode?: boolean
}) {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  
  const [accountPlans, setAccountPlans] = useState<any[]>(initialAccountPlans)
  const [updatingPlanId, setUpdatingPlanId] = useState<string | null>(null)
  const [activeWorkspacesCount, setActiveWorkspacesCount] = useState(initialActiveWorkspacesCount)
  const [usage, setUsage] = useState<{current: number, max: number | null, allowed: boolean, plan: string} | null>(initialUsage)
  const [transactions, setTransactions] = useState<any[]>(initialTransactions)
  const [checkingOrderId, setCheckingOrderId] = useState<string | null>(null)

  const handleCheckStatus = async (orderId: string) => {
    setCheckingOrderId(orderId)
    try {
      const result = await checkTransactionStatusAction(orderId)
      if (result.success) {
        toast({ title: "Status Updated", description: `Transaction status is now ${result.status}` })
        // Update local state to reflect new status
        setTransactions(prev => prev.map(t => t.orderId === orderId ? { ...t, status: result.status } : t))
        
        // If it successfully updated to success, refresh the user's session plan automatically
        if (result.status === "success") {
          await update()
          router.refresh()
        }
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to check status" })
    } finally {
      setCheckingOrderId(null)
    }
  }

  const handleUpdateUserPlan = async (planId: string) => {
    setUpdatingPlanId(planId)
    try {
      if (planId === "free") {
        const res = await fetch("/api/auth/user/plan", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: "free" }),
        })
        if (res.ok) {
          toast({ title: "Account Plan Updated", description: "You are now on the Free plan." })
          router.refresh()
        }
      } else {
        router.push(`/dashboard/billing/checkout?plan=${planId}&interval=year`)
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to initiate checkout." })
    } finally {
      setUpdatingPlanId(null)
    }
  }

  if (status === "loading") {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Billing & Plans</h2>
        <p className="text-muted-foreground">Manage your workspace limits, billing address, and view invoices.</p>
      </div>

      <Tabs defaultValue="plans" className="w-full">
        <TabsList className={cn("grid w-full", isEnterpriseMode ? "grid-cols-1 max-w-[200px]" : "grid-cols-2 max-w-[400px]")}>
          <TabsTrigger value="plans">Subscription Plans</TabsTrigger>
          {!isEnterpriseMode && <TabsTrigger value="history">Transaction History</TabsTrigger>}
        </TabsList>
        
        <TabsContent value="plans" className="space-y-6 mt-6">
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Workspace Usage</CardTitle>
                    <CardDescription>Current global workspace quota</CardDescription>
                  </div>
                  <Database className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 mt-2">
                  <h3 className="text-4xl font-bold">{usage ? usage.current : activeWorkspacesCount}</h3>
                  <span className="text-sm text-muted-foreground font-medium mb-1">
                    / {usage ? (usage.max === null || usage.max > 9000 ? 'Unlimited' : usage.max) : (session?.user?.plan === 'free' ? '1' : 'Unlimited')}
                  </span>
                </div>
                <div className="mt-4 w-full bg-secondary h-2 rounded-full overflow-hidden">
                  {(!usage && session?.user?.plan === 'free') || (usage && usage.max !== null) ? (
                     <div 
                       className={cn("h-full", (usage && !usage.allowed) ? "bg-destructive" : "bg-primary")} 
                       style={{ width: `${Math.min(((usage?.current || activeWorkspacesCount) / (usage?.max || 1)) * 100, 100)}%` }} 
                     />
                  ) : (
                     <div className="h-full w-full bg-primary" />
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          {!isEnterpriseMode && (
            <section className="space-y-6">
              <div>
                <h3 className="text-xl font-bold">Available Plans</h3>
                <p className="text-sm text-muted-foreground">Select or upgrade your account tier.</p>
              </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {accountPlans.map((plan) => {
                const isActive = session?.user?.plan === plan.id
                return (
                  <Card 
                    key={plan.id} 
                    className={cn(
                      "flex flex-col relative", 
                      isActive && "border-primary shadow-sm"
                    )}
                  >
                    {isActive && (
                      <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-bl-lg">
                        Current
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle>{plan.name}</CardTitle>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-3xl font-bold">{plan.price}</span>
                        <span className="text-sm font-medium text-muted-foreground">/yr</span>
                      </div>
                      <CardDescription>{plan.workspaces === "Unlimited" ? "Unlimited workspaces" : `Max ${plan.workspaces} workspaces`}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col justify-between flex-1">
                      <div className="space-y-3 mb-6">
                        {plan.features.map((f: string, i: number) => (
                          <div key={i} className="flex items-start text-sm">
                            <CheckCircle2 className="mr-2 h-4 w-4 text-primary shrink-0 mt-0.5" /> 
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                      <Button 
                        variant={isActive ? "outline" : "default"} 
                        disabled={isActive || updatingPlanId === plan.id}
                        onClick={() => handleUpdateUserPlan(plan.id)}
                        className="w-full mt-auto"
                      >
                        {updatingPlanId === plan.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {isActive ? "Active Plan" : (plan.id === "free" ? "Downgrade to Free" : "Upgrade to Yearly")}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
            
            <Card className="bg-muted/50">
              <CardContent className="p-6 flex flex-col md:flex-row gap-4 items-center md:items-start text-center md:text-left">
                <div className="bg-background p-3 rounded-full shrink-0">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-lg">Enterprise Dedicated Limits</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Need massive custom storage, custom routing domains, isolated database shards, or custom SLAs? <a href="#" className="text-primary hover:underline font-medium">Contact sales support</a> to discuss a tailored enterprise plan.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>
        )}
        </TabsContent>

        {!isEnterpriseMode && (
          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>View your past payments and invoices.</CardDescription>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No transactions found.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg gap-4">
                        <div>
                          <p className="font-medium text-sm break-all">{tx.orderId}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(tx.createdAt).toLocaleDateString("id-ID", {
                              day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold">Rp {tx.amount.toLocaleString("id-ID")}</p>
                            <Badge 
                              variant={tx.status === 'success' ? 'default' : tx.status === 'failed' ? 'destructive' : 'secondary'}
                              className="mt-1 capitalize"
                            >
                              {tx.status}
                            </Badge>
                          </div>
                          {tx.status === 'pending' && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              disabled={checkingOrderId === tx.orderId}
                              onClick={() => handleCheckStatus(tx.orderId)}
                            >
                              {checkingOrderId === tx.orderId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check Status"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
