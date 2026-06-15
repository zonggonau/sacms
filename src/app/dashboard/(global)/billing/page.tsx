"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, Zap, CreditCard, CheckCircle2, ShieldCheck, Crown
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function BillingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [accountPlans, setAccountPlans] = useState<any[]>([])
  const [updatingPlanId, setUpdatingPlanId] = useState<string | null>(null)
  const [activeWorkspacesCount, setActiveWorkspacesCount] = useState(0)
  const [usage, setUsage] = useState<{current: number, max: number | null, allowed: boolean, plan: string} | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (status === "authenticated") {
      const globalToken = process.env.NEXT_PUBLIC_SYSTEM_API_KEY || "cf_cc0045e6f75d9cb58a5a81a4b03dbc5602258b70c06c5c6ce8be304e9474b5fd"

      // Fetch Account Plans from Truly Global endpoint
      fetch("/api/public/plans?type=account", {
        headers: { "Authorization": `Bearer ${globalToken}` }
      })
        .then(res => res.json())
        .then(json => {
          if (json.plans && Array.isArray(json.plans)) {
            const mapped = json.plans.map((p: any) => {
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
           if (data.usage) {
             setUsage(data.usage)
           }
        })
        .catch(err => console.error(err))
    }
  }, [session, status, router])

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
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700 pb-20">
      
      {/* 1. Header & Current Plan Usage */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">Account Billing</h2>
          <p className="text-sm md:text-base text-muted-foreground mt-1 font-medium">Manage your global subscription, usage, and payment methods.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <Card className="bg-card/40 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden relative group rounded-[2rem]">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="p-6 md:p-8 flex flex-col justify-between h-full space-y-6 relative z-10">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current Plan</span>
                <div className="flex items-center gap-4 mt-2">
                  <h3 className="text-4xl font-black tracking-tighter text-foreground uppercase">{session?.user?.plan || "Free"}</h3>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-none font-black text-[10px] uppercase tracking-widest px-2.5 py-1">Active</Badge>
                </div>
              </div>
              
              <div className="p-5 bg-card/50 backdrop-blur-md rounded-2xl border border-white/5 text-sm text-muted-foreground font-medium leading-relaxed shadow-inner">
                You are currently on the <strong className="text-foreground uppercase">{session?.user?.plan || "Free"}</strong> plan. 
                {session?.user?.plan === 'free' ? " Upgrade your account to unlock premium templates, higher limits, and unlimited workspaces." : " Your subscription is active and in good standing. You will be billed annually."}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden relative group rounded-[2rem]">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="p-6 md:p-8 space-y-6 relative z-10">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Workspace Limit</span>
                <div className="flex items-end gap-2 mt-2">
                  <h3 className="text-5xl font-black tracking-tighter text-foreground leading-none">{usage ? usage.current : activeWorkspacesCount}</h3>
                  <span className="text-sm text-muted-foreground font-bold mb-1 uppercase tracking-wider">
                    / {usage ? (usage.max === null ? '∞' : usage.max) : (session?.user?.plan === 'free' ? '1' : '∞')}
                  </span>
                </div>
              </div>
              
              <div className="space-y-3 pt-4">
                <div className="w-full flex gap-1 h-3 rounded-full overflow-hidden bg-background/50 border border-white/5 shadow-inner">
                  {(!usage && session?.user?.plan === 'free') || (usage && usage.max !== null) ? (
                     <div 
                       className={cn("h-full transition-all duration-700 ease-out", (usage && !usage.allowed) ? "bg-red-500" : "bg-gradient-to-r from-primary to-primary/80")} 
                       style={{ width: `${Math.min(((usage?.current || activeWorkspacesCount) / (usage?.max || 1)) * 100, 100)}%` }} 
                     />
                  ) : (
                     <div className="h-full w-full bg-gradient-to-r from-emerald-500 to-emerald-400" />
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest text-right">
                  {(!usage && session?.user?.plan === 'free') || (usage && usage.max !== null)
                    ? `${Math.max((usage?.max || 1) - (usage?.current || activeWorkspacesCount), 0)} slots remaining` 
                    : "Unlimited capacity"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Card className="bg-card/40 backdrop-blur-xl border-white/10 shadow-xl overflow-hidden rounded-[2rem]">
           <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
             <div>
               <h3 className="text-xl font-black tracking-tight text-foreground">Payment Method & Invoices</h3>
               <p className="text-sm text-muted-foreground mt-1 font-medium">Manage your credit cards, billing address, and download past invoices.</p>
             </div>
             <Button variant="outline" disabled className="rounded-xl border-white/10 bg-card/50 h-11 px-6 font-bold shadow-sm w-full md:w-auto">
               <CreditCard className="mr-2 h-4 w-4" /> Open Billing Portal
             </Button>
           </CardContent>
        </Card>
      </section>

      {/* 2. Account Subscription Plans Grid */}
      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 shadow-inner">
            <Zap className="h-5 w-5 text-orange-500 fill-orange-500" />
          </div>
          <div>
            <h3 className="text-2xl font-black tracking-tight text-foreground">Subscription Plans</h3>
            <p className="text-sm text-muted-foreground font-medium">Select or upgrade your account tier. Limits scale per plan.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Plans from API */}
          {accountPlans.map((plan) => {
            const isActive = session?.user?.plan === plan.id
            return (
              <Card 
                key={plan.id} 
                className={cn(
                  "relative transition-all duration-300 shadow-xl overflow-hidden rounded-[2rem] flex flex-col", 
                  isActive ? "border-primary/50 bg-primary/5 ring-2 ring-primary/20 scale-[1.02]" : "border-white/10 bg-card/40 backdrop-blur-xl hover:border-primary/30 hover:shadow-2xl hover:-translate-y-1"
                )}
              >
                {isActive && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-xl z-20">
                    Current Plan
                  </div>
                )}
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-500 z-0", isActive ? "from-primary/10 to-transparent opacity-100" : "from-foreground/5 to-transparent group-hover:opacity-100")} />
                
                <CardHeader className="relative z-10 p-8 pb-4">
                  {isActive && <Crown className="h-6 w-6 text-primary mb-2" />}
                  <CardTitle className="text-2xl font-black tracking-tighter">{plan.name}</CardTitle>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-black tracking-tighter text-foreground">{plan.price}</span>
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">/yr</span>
                  </div>
                  <CardDescription className="font-semibold text-muted-foreground mt-2">{plan.workspaces === "Unlimited" ? "Unlimited workspaces" : `Max ${plan.workspaces} workspaces`}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col justify-between flex-1 relative z-10 p-8 pt-4">
                  <div className="space-y-4 mb-8">
                    {plan.features.map((f: string, i: number) => (
                      <p key={i} className="text-sm font-medium text-foreground flex items-start">
                        <CheckCircle2 className="mr-3 h-5 w-5 text-primary shrink-0" /> 
                        <span className="leading-tight">{f}</span>
                      </p>
                    ))}
                  </div>
                  <Button 
                    variant={isActive ? "outline" : "default"} 
                    disabled={isActive || updatingPlanId === plan.id}
                    onClick={() => handleUpdateUserPlan(plan.id)}
                    className={cn(
                      "w-full h-12 rounded-xl font-bold transition-all mt-auto",
                      !isActive && "shadow-lg shadow-primary/20 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground hover:opacity-90",
                      isActive && "border-primary/20 bg-primary/10 text-primary hover:bg-primary/20"
                    )}
                  >
                    {updatingPlanId === plan.id ? <Loader2 className="h-5 w-5 animate-spin" /> : (isActive ? "Active Plan" : (plan.id === "free" ? "Downgrade to Free" : "Upgrade to Yearly"))}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
        
        {/* Enterprise Notice */}
        <div className="p-8 rounded-[2rem] bg-card/40 backdrop-blur-xl border border-white/10 shadow-xl flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-transparent pointer-events-none" />
          <div className="w-16 h-16 rounded-[1.5rem] bg-background/50 border border-white/10 flex items-center justify-center shrink-0 shadow-inner relative z-10">
            <ShieldCheck className="h-8 w-8 text-orange-500" />
          </div>
          <div className="space-y-2 relative z-10">
            <h4 className="text-xl font-black tracking-tight text-foreground">Enterprise Dedicated Limits</h4>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl font-medium">
              Need massive custom storage, custom routing domains, isolated database shards, or custom SLAs? <a href="#" className="text-primary font-bold hover:underline underline-offset-4">Contact sales support</a> to discuss a tailored enterprise plan.
            </p>
          </div>
        </div>
      </section>

    </div>
  )
}
