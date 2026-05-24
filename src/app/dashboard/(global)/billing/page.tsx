"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, Zap, CreditCard, CheckCircle2, ShieldCheck
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function BillingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [accountPlans, setAccountPlans] = useState<any[]>([])
  const [updatingPlanId, setUpdatingPlanId] = useState<string | null>(null)
  const [activeWorkspacesCount, setActiveWorkspacesCount] = useState(0)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (status === "authenticated") {
      const globalToken = process.env.NEXT_PUBLIC_SYSTEM_API_KEY || "internal"

      // Fetch Account Plans
      fetch("/api/public/sacms-global/content/sacms-account-pricing?sort=price:asc", {
        headers: { "Authorization": `Bearer ${globalToken}` }
      })
        .then(res => res.json())
        .then(json => {
          if (json.data && Array.isArray(json.data)) {
            const mapped = json.data
              // Map all plans directly from the API
              .map((p: any) => {
              let displayPrice = "Rp 0"
              const yearlyPrice = p.yearly_price !== undefined ? p.yearly_price : p.price * 10
              if (p.price > 0) {
                if (yearlyPrice >= 1000000) {
                  displayPrice = `Rp ${(yearlyPrice / 1000000).toLocaleString('id-ID')}M`
                } else {
                  displayPrice = `Rp ${(yearlyPrice / 1000).toLocaleString('id-ID')}k`
                }
              } else if (p.price === 0 && p.cta_text?.toLowerCase().includes('contact')) {
                displayPrice = "Custom"
              }
              
              return {
                id: p.plan_slug,
                name: p.name,
                workspaces: p.max_workspaces || "Unlimited",
                price: displayPrice,
                priceAmount: p.price,
                features: p.features || []
              }
            })
            if (mapped.length > 0) setAccountPlans(mapped)
          }
        })
        .catch(err => console.error("Failed to fetch account plans:", err))

      // Fetch workspaces count for display
      fetch("/api/tenants")
        .then(res => res.json())
        .then(data => {
           if (data.tenants) {
             setActiveWorkspacesCount(data.tenants.length)
           }
        })
        .catch(err => console.error(err))
    }
  }, [session, status, router])

  const handleUpdateUserPlan = async (planId: string) => {
    setUpdatingPlanId(planId)
    try {
      if (planId === "free") {
        const res = await fetch("/api/user/plan", {
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
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-20">
      
      {/* 1. Header & Current Plan Usage */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Account Billing</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage your global subscription, usage, and payment methods.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card shadow-sm">
            <CardContent className="p-6 flex flex-col justify-between h-full space-y-6">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current Plan</span>
                <div className="flex items-center gap-3 mt-2">
                  <h3 className="text-3xl font-bold uppercase tracking-tight text-primary">{session?.user?.plan || "Free"}</h3>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">Active</Badge>
                </div>
              </div>
              
              <div className="p-4 bg-muted/50 rounded-lg border border-border text-sm text-muted-foreground">
                You are currently on the <strong className="text-foreground uppercase">{session?.user?.plan || "Free"}</strong> plan. 
                {session?.user?.plan === 'free' ? " Upgrade your account to unlock premium templates, higher limits, and unlimited workspaces." : " Your subscription is active and in good standing. You will be billed annually."}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card shadow-sm">
            <CardContent className="p-6 space-y-6">
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Workspace Usage Limit</span>
                <div className="flex items-end gap-2 mt-2">
                  <h3 className="text-3xl font-bold tracking-tight text-foreground">{activeWorkspacesCount}</h3>
                  <span className="text-sm text-muted-foreground font-semibold mb-1 uppercase tracking-wider">/ {session?.user?.plan === 'free' ? '3' : 'UNLIMITED'}</span>
                </div>
              </div>
              
              <div className="space-y-3 pt-2">
                <div className="w-full flex gap-1 h-3 rounded-full overflow-hidden bg-muted">
                  {session?.user?.plan === 'free' ? (
                     <div 
                       className={cn("h-full transition-all duration-500", activeWorkspacesCount >= 3 ? "bg-destructive" : "bg-primary")} 
                       style={{ width: `${Math.min((activeWorkspacesCount / 3) * 100, 100)}%` }} 
                     />
                  ) : (
                     <div className="h-full w-full bg-emerald-500" />
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  {session?.user?.plan === 'free' 
                    ? `${Math.max(3 - activeWorkspacesCount, 0)} slots remaining` 
                    : "Unlimited capacity"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Card className="bg-card shadow-sm">
           <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
             <div>
               <h3 className="text-lg font-bold tracking-tight">Payment Method & Invoices</h3>
               <p className="text-sm text-muted-foreground mt-1">Manage your credit cards, billing address, and download past invoices.</p>
             </div>
             <Button variant="outline" disabled>
               <CreditCard className="mr-2 h-4 w-4" /> Open Billing Portal
             </Button>
           </CardContent>
        </Card>
      </section>

      {/* 2. Account Subscription Plans Grid */}
      <section className="space-y-6">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500 fill-orange-500" /> Subscription Plans
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Select or upgrade your account tier. Limits scale per plan.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Plans from API */}
          {accountPlans.map((plan) => {
            const isActive = session?.user?.plan === plan.id
            return (
              <Card key={plan.id} className={cn("relative transition-colors shadow-sm", isActive ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/50")}>
                {isActive && (
                  <Badge className="absolute -top-3 right-4">Current Plan</Badge>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-primary">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">/yr</span>
                  </div>
                  <CardDescription>{plan.workspaces === "Unlimited" ? "Unlimited workspaces" : `Max ${plan.workspaces} workspaces`}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col justify-between h-[calc(100%-8rem)]">
                  <div className="space-y-3 mb-8">
                    {plan.features.map((f: string, i: number) => (
                      <p key={i} className="text-sm flex items-center"><CheckCircle2 className="mr-2 h-4 w-4 text-primary" /> {f}</p>
                    ))}
                  </div>
                  <Button 
                    variant={isActive ? "outline" : "default"} 
                    disabled={isActive || updatingPlanId === plan.id}
                    onClick={() => handleUpdateUserPlan(plan.id)}
                    className="w-full mt-auto"
                  >
                    {updatingPlanId === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (isActive ? "Active Plan" : (plan.id === "free" ? "Downgrade to Free" : "Upgrade to Yearly"))}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
        
        {/* Enterprise Notice */}
        <div className="p-6 rounded-xl bg-zinc-50 border border-border dark:bg-zinc-900/30 flex gap-4 items-center">
          <div className="w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center shrink-0">
            <ShieldCheck className="h-6 w-6 text-orange-500" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold tracking-tight">Enterprise Dedicated Limits</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Need massive custom storage, custom routing domains, isolated database shards, or custom SLAs? <a href="#" className="text-primary font-medium hover:underline">Contact sales support</a>.
            </p>
          </div>
        </div>
      </section>

    </div>
  )
}
