"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Check, Loader2, CreditCard, Clock, Calendar, 
  ArrowUpRight, AlertCircle, Zap, ShieldCheck,
  History, ExternalLink, FileText, BarChart3,
  HardDrive, Users, Database, Package, Shield, Bot
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface Subscription {
  id: string
  plan: string
  status: string
  currentPeriodEnd: string | null
}

interface Invoice {
  id: string
  amount: number
  status: string
  createdAt: string
  midtransInvoiceId: string | null
}

export default function TenantSubscriptionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string
  const { toast } = useToast()

  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [usage, setUsage] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTenants, setLoadingTenants] = useState(true)
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('year')

  const tenants = useMemo(() => session?.user?.tenants || [], [session])
  const [liveTenants, setLiveTenants] = useState<any[]>([])

  useEffect(() => {
    async function fetchLiveTenants() {
      try {
        setLoadingTenants(true)
        const res = await fetch("/api/tenants")
        if (res.ok) {
          const data = await res.json()
          setLiveTenants(data.tenants || [])
        }
      } catch (error) {
        console.error("Failed to fetch live tenants in subscriptions:", error)
      } finally {
        setLoadingTenants(false)
      }
    }
    if (status === "authenticated" && session?.user) {
      fetchLiveTenants()
    } else if (status === "unauthenticated") {
      setLoadingTenants(false)
    }
  }, [session, status])

  const combinedTenants = useMemo(() => {
    const staticTenants = session?.user?.tenants || []
    const combined = [...staticTenants]
    for (const t of liveTenants) {
      if (!combined.some(x => x.id === t.id)) {
        combined.push(t)
      }
    }
    return combined
  }, [session, liveTenants])

  const currentTenant = useMemo(() => 
    combinedTenants.find(t => t.slug === tenantSlug || t.id === tenantSlug), 
    [combinedTenants, tenantSlug]
  )

  const fetchBillingData = async () => {
    if (!tenantSlug) return
    try {
      const [subRes, invRes, plansRes, usageRes] = await Promise.all([
        fetch(`/api/tenant/${tenantSlug}/subscription/prorate`),
        fetch(`/api/tenant/${tenantSlug}/invoices`),
        fetch(`/api/tenant/${tenantSlug}/subscriptions/plans`),
        fetch(`/api/tenant/${tenantSlug}/billing/usage`)
      ])
      
      if (subRes.ok) {
        const data = await subRes.json()
        setSubscription(data.subscription)
      }
      if (invRes.ok) {
        const data = await invRes.json()
        setInvoices(data.invoices || [])
      }
      if (plansRes.ok) {
        const data = await plansRes.json()
        setPlans(data.plans || [])
      }
      if (usageRes.ok) {
        const data = await usageRes.json()
        setUsage(data.usage || [])
      }
    } catch (err) {
      console.error("Billing fetch error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) fetchBillingData()
  }, [tenantSlug, session])

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (status === "loading" || loading || loadingTenants) {
    return (
      <div className="flex items-center justify-center flex-1 flex-col w-full">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  const currentPlan = plans.find(p => p.id === (subscription?.plan || 'free'))

  const mainPlans = plans.filter(p => p.type === "workspace")
  const addonPlans = plans.filter(p => p.type === "addons")

  return (
    <div className="flex relative flex-1 flex-col w-full">
<div className="flex-1 min-w-0 h-full overflow-x-hidden bg-background text-foreground flex-col w-full">
        <div className="p-6 lg:p-8 w-full space-y-8">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight">Billing & Plans</h1>
              <p className="text-xs text-muted-foreground font-medium mt-1">Manage your workspace subscription and view payment history.</p>
            </div>
            <div className="flex items-center gap-3 bg-card p-2 px-4 rounded-none border border-border shadow-none">
              <Package className="h-5 w-5 text-orange-500" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-muted-foreground leading-none mb-1">Active Plan</span>
                <span className="text-sm font-bold uppercase tracking-tight text-foreground">{subscription?.plan || "Free"}</span>
              </div>
            </div>
          </div>

          {tenantSlug === "sacms-global" ? (
            <Card className="border border-border shadow-none bg-card text-card-foreground overflow-hidden rounded-none relative">
              <CardContent className="p-16 relative flex flex-col items-center justify-center text-center">
                <ShieldCheck className="h-20 w-20 text-orange-500 mb-6 opacity-30" />
                <h2 className="text-3xl font-black uppercase tracking-tight">System Account</h2>
                <p className="text-muted-foreground mt-4 max-w-lg mx-auto font-medium">Billing, plans, and resource limits are not applicable for the global system workspace. This workspace has unlimited platform access.</p>
              </CardContent>
            </Card>
          ) : (
            <>
          {/* Current Status Card */}
          <Card className="border border-border shadow-none bg-card text-card-foreground overflow-hidden rounded-none relative">
            <CardContent className="p-8 relative">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="space-y-4">
                  <Badge className="bg-orange-500 text-white hover:bg-orange-600 border-none font-black px-3 py-1 uppercase tracking-widest text-[10px] rounded-none">
                    Current Subscription
                  </Badge>
                  <h2 className="text-4xl font-black uppercase tracking-tight">{currentPlan?.name || subscription?.plan || "Standard Plan"}</h2>
                  <div className="flex flex-wrap gap-6 text-sm font-medium text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-500" />
                      Status: <span className="font-black uppercase tracking-widest text-xs text-orange-500">{subscription?.status || "Active"}</span>
                    </div>
                    {subscription?.currentPeriodEnd && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-orange-500" />
                        Next Billing: <span className="font-bold text-foreground">{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden md:block">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Yearly cost</p>
                    <p className="text-2xl font-black text-foreground">{formatPrice((currentPlan?.yearlyPrice !== undefined ? currentPlan?.yearlyPrice : (currentPlan?.price || 0) * 12) * (subscription?.plan === 'free' ? 0 : 1))}</p>
                  </div>
                  {subscription?.status === 'trialing' ? (
                    <Button 
                      variant="default" 
                      className="h-12 px-8 font-black uppercase tracking-widest text-[10px] rounded-none bg-orange-500 hover:bg-orange-600 text-white border-none shadow-none"
                      onClick={() => router.push(`/dashboard/${tenantSlug}/subscriptions/checkout?plan=${subscription?.plan || 'starter'}&interval=year`)}
                    >
                      Pay Now
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="h-12 px-8 font-bold rounded-none border-border shadow-none"
                      onClick={() => {
                        const el = document.getElementById('billing-history')
                        if (el) el.scrollIntoView({ behavior: 'smooth' })
                      }}
                    >
                      View Invoices
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usage Limits Section */}
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-orange-500" /> Resource Usage
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {usage.map((item) => {
                const percentage = Math.min(100, (item.current / item.limit) * 100)
                const isNearingLimit = percentage > 80
                
                const formatValue = (val: number, unit: string) => {
                  if (unit === "bytes") {
                    const gb = val / (1024 * 1024 * 1024)
                    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(val / (1024 * 1024)).toFixed(0)} MB`
                  }
                  return val.toLocaleString()
                }

                return (
                  <Card key={item.label} className="border border-border shadow-none bg-card rounded-none overflow-hidden">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          {item.unit === "entries" ? <Database className="h-4 w-4 text-orange-500" /> : 
                           item.unit === "bytes" ? <HardDrive className="h-4 w-4 text-orange-500" /> : <Users className="h-4 w-4 text-orange-500" />}
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{item.label}</span>
                        </div>
                        {isNearingLimit && <AlertCircle className="h-4 w-4 text-orange-500 animate-pulse" />}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-end justify-between">
                          <p className="text-2xl font-black">{formatValue(item.current, item.unit)}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Limit: {formatValue(item.limit, item.unit)}</p>
                        </div>
                        <Progress value={percentage} className="h-1.5 bg-muted rounded-none">
                          <div 
                            className={cn(
                              "h-full transition-all rounded-none",
                              percentage > 90 ? "bg-red-500" : percentage > 70 ? "bg-orange-500" : "bg-orange-500"
                            )}
                            style={{ width: `${percentage}%` }}
                          />
                        </Progress>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Main Plans Grid */}
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Upgrade your Workspace</h2>
              
              <div className="flex items-center p-1 bg-muted/30 rounded-none border border-border w-fit">
                <Button 
                  variant="ghost"
                  size="sm" 
                  className={cn(
                    "rounded-none px-6 font-bold h-8 text-xs border-none", 
                    billingInterval === 'month' ? "bg-orange-500 hover:bg-orange-600 text-white" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setBillingInterval('month')}
                >
                  Monthly
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={cn(
                    "rounded-none px-6 font-bold h-8 text-xs border-none", 
                    billingInterval === 'year' ? "bg-orange-500 hover:bg-orange-600 text-white" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setBillingInterval('year')}
                >
                  Yearly <Badge className="ml-2 bg-orange-600 text-white border-none text-[8px] h-4 rounded-none font-black">-15%</Badge>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {mainPlans.map((plan) => {
                const isCurrent = plan.id === subscription?.plan
                const displayPrice = billingInterval === 'year' ? (plan.yearlyPrice !== undefined ? plan.yearlyPrice : plan.price * 12) : plan.price
                const label = billingInterval === 'year' ? '/yr' : '/mo'

                return (
                  <Card key={plan.id} className={cn(
                    "border border-border bg-card shadow-none rounded-none overflow-hidden relative group flex flex-col transition-colors hover:border-orange-500 duration-300",
                    plan.popular && "border-2 border-orange-500"
                  )}>
                    {plan.popular && (
                      <div className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] font-black uppercase px-4 py-1.5 rounded-none border-b border-l border-orange-600">
                        Most Popular
                      </div>
                    )}
                    <CardHeader className="p-8 pt-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{plan.name}</p>
                        {billingInterval === 'year' && <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest h-5 rounded-none border border-border">Annual</Badge>}
                      </div>
                      <div className="flex items-baseline gap-1 mt-4">
                        <span className="text-3xl font-black">{formatPrice(displayPrice)}</span>
                        <span className="text-xs text-muted-foreground">{label}</span>
                      </div>
                      {billingInterval === 'year' && <p className="text-[10px] text-muted-foreground font-medium italic">Equivalent to {formatPrice(plan.price)}/mo</p>}
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-8 flex-1 flex flex-col">
                      <Separator className="bg-border" />
                      
                      {/* Plan Details / Limits */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-muted-foreground opacity-70">Schemas</p>
                          <p className="text-sm font-bold">{plan.maxContentTypes > 100 ? "Unlimited" : plan.maxContentTypes}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-muted-foreground opacity-70">Entries</p>
                          <p className="text-sm font-bold">{plan.maxContentEntries?.toLocaleString() || "Basic"}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-muted-foreground opacity-70">Team</p>
                          <p className="text-sm font-bold">{plan.maxTeamMembers > 100 ? "Unlimited" : plan.maxTeamMembers}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-muted-foreground opacity-70">API Calls</p>
                          <p className="text-sm font-bold">{plan.maxApiCalls > 1000000 ? "Unlimited" : (plan.maxApiCalls?.toLocaleString() || "Standard")}</p>
                        </div>
                      </div>

                      <Separator className="bg-border" />

                      <ul className="space-y-4 flex-1">
                        {plan.features.map((feature: string) => (
                          <li key={feature} className="flex items-start gap-3 text-xs font-bold text-muted-foreground">
                            <div className="mt-0.5 w-4 h-4 rounded-none bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                              <Check className="h-2.5 w-2.5 text-orange-500" strokeWidth={4} />
                            </div>
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <Button 
                        className={cn(
                          "w-full h-12 font-bold rounded-none shadow-none",
                          isCurrent 
                            ? "bg-muted text-muted-foreground cursor-not-allowed border border-border" 
                            : "bg-orange-500 hover:bg-orange-600 text-white border-none"
                        )}
                        onClick={() => !isCurrent && router.push(`/dashboard/${tenantSlug}/subscriptions/checkout?plan=${plan.id}&interval=${billingInterval}`)}
                        disabled={isCurrent}
                      >
                        {isCurrent ? "Current Plan" : `Upgrade to ${plan.name}`}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Add-ons Section */}
          {addonPlans.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-orange-500" /> Powerful Add-ons
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {addonPlans.map((addon) => (
                  <Card key={addon.id} className="border border-border bg-card shadow-none rounded-none overflow-hidden hover:border-orange-500 transition-colors duration-300">
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row justify-between gap-6">
                        <div className="space-y-4 flex-1">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-none border border-border bg-orange-500/10 flex items-center justify-center text-orange-500">
                              {addon.icon === 'Shield' && <Shield className="h-5 w-5" />}
                              {addon.icon === 'Zap' && <Zap className="h-5 w-5" />}
                              {addon.icon === 'Database' && <Database className="h-5 w-5" />}
                              {addon.icon === 'Bot' && <Bot className="h-5 w-5" />}
                              {addon.icon === 'FileText' && <FileText className="h-5 w-5" />}
                              {!['Shield', 'Zap', 'Database', 'Bot', 'FileText'].includes(addon.icon) && (
                                addon.name.toLowerCase().includes('backup') ? <History className="h-5 w-5" /> : <Package className="h-5 w-5" />
                              )}
                            </div>
                            <div>
                              <p className="text-lg font-black uppercase tracking-tight">{addon.name}</p>
                              <p className="text-sm font-black text-orange-500">{formatPrice(addon.price)}<span className="text-[10px] text-muted-foreground font-medium">/month</span></p>
                            </div>
                          </div>
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {addon.features.map((feature: string) => (
                              <li key={feature} className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                                <Check className="h-3 w-3 text-orange-500" /> {feature}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex sm:flex-col justify-end gap-3 shrink-0">
                          <Button 
                            className="font-bold rounded-none px-6 h-10 bg-orange-500 hover:bg-orange-600 text-white shadow-none border-none"
                            onClick={() => router.push(`/dashboard/${tenantSlug}/subscriptions/checkout?plan=${addon.id}`)}
                          >
                            Activate
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Invoices */}
          <Card id="billing-history" className="border border-border shadow-none bg-card rounded-none overflow-hidden scroll-mt-24">
            <CardHeader className="bg-muted/10 p-6 border-b border-border rounded-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <History className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg font-black uppercase tracking-tight">Billing History</CardTitle>
                </div>
                <Badge variant="outline" className="font-black rounded-none border-border">Recent Invoices</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-10 text-muted-foreground" />
                  <p className="font-bold text-foreground text-sm">No payment history yet</p>
                  <p className="text-xs">Your future invoices will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {invoices.map((inv) => (
                    <div key={inv.id} className="p-4 px-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-none border border-border bg-muted flex items-center justify-center text-muted-foreground">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{inv.isTransaction ? 'Transaction' : 'Invoice'} #{inv.id.substring(0, 8).toUpperCase()}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                            {new Date(inv.createdAt).toLocaleDateString()} &middot; IDR {inv.amount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className={cn(
                          "text-[10px] font-black uppercase px-2 py-0.5 rounded-none border shadow-none",
                          inv.status === 'paid' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                        )}>
                          {inv.status}
                        </Badge>
                        {inv.isTransaction && inv.status === 'pending' ? (
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="rounded-none bg-orange-500 hover:bg-orange-600 text-white border-none shadow-none text-[10px] font-black uppercase"
                            onClick={() => router.push(`/dashboard/${tenantSlug}/subscriptions/checkout?plan=${inv.plan}&interval=year`)}
                          >
                            Pay Now
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-muted text-muted-foreground">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
