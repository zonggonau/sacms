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
  HardDrive, Users, Database, Package
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
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
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('year')

  const tenants = useMemo(() => session?.user?.tenants || [], [session])
  const currentTenant = useMemo(() => tenants.find(t => t.slug === tenantSlug), [tenants, tenantSlug])

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

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const currentPlan = plans.find(p => p.id === (subscription?.plan || 'free'))

  const mainPlans = plans.filter(p => p.type === "workspace")
  const addonPlans = plans.filter(p => p.type === "addons")

  return (
    <div className="flex h-screen w-full bg-muted/10 overflow-hidden relative">
      <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
      <main className="flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden">
        <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">

          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Billing & Plans</h1>
              <p className="text-muted-foreground">Manage your workspace subscription and view payment history.</p>
            </div>
            <div className="flex items-center gap-3 bg-card p-2 px-4 rounded-2xl border shadow-sm">
              <Package className="h-5 w-5 text-primary" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-muted-foreground leading-none mb-1">Active Plan</span>
                <span className="text-sm font-bold uppercase tracking-tight">{subscription?.plan || "Free"}</span>
              </div>
            </div>
          </div>

          {/* Current Status Card */}
          <Card className="border-none shadow-xl bg-primary text-primary-foreground overflow-hidden rounded-3xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
            <CardContent className="p-8 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-4">
              <Badge className="bg-white/20 text-white hover:bg-white/30 border-none font-black px-3 py-1 uppercase tracking-widest text-[10px]">
                Current Subscription
              </Badge>
              <h2 className="text-4xl font-black">{currentPlan?.name || subscription?.plan || "Standard Plan"}</h2>
              <div className="flex flex-wrap gap-6 text-sm font-medium opacity-90">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Status: <span className="font-bold uppercase tracking-widest text-xs">{subscription?.status || "Active"}</span>
                </div>
                {subscription?.currentPeriodEnd && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Next Billing: <span className="font-bold">{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                <p className="text-xs font-bold uppercase opacity-60">Yearly cost</p>
                <p className="text-2xl font-black">{formatPrice((currentPlan?.price || 0) * (subscription?.plan === 'free' ? 0 : 12))}</p>
              </div>
              <Button variant="secondary" className="h-12 px-8 font-bold rounded-2xl shadow-lg">
                Manage Billing
              </Button>
            </div>
            </div>
            </CardContent>          </Card>

          {/* Usage Limits Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-black uppercase tracking-tight text-muted-foreground/70 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> Resource Usage
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  <Card key={item.label} className="border-none shadow-sm bg-card rounded-3xl overflow-hidden">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          {item.unit === "entries" ? <Database className="h-4 w-4" /> : 
                           item.unit === "bytes" ? <HardDrive className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                          <span className="text-xs font-bold uppercase tracking-widest">{item.label}</span>
                        </div>
                        {isNearingLimit && <AlertCircle className="h-4 w-4 text-orange-500 animate-pulse" />}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-end justify-between">
                          <p className="text-2xl font-black">{formatValue(item.current, item.unit)}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Limit: {formatValue(item.limit, item.unit)}</p>
                        </div>
                        <Progress value={percentage} className="h-1.5 bg-muted">
                          <div 
                            className={cn(
                              "h-full transition-all rounded-full",
                              percentage > 90 ? "bg-red-500" : percentage > 70 ? "bg-orange-500" : "bg-primary"
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
              <h2 className="text-xl font-black uppercase tracking-tight text-muted-foreground/70">Upgrade your Workspace</h2>
              
              <div className="flex items-center p-1 bg-muted/50 rounded-2xl border w-fit">
                <Button 
                  variant={billingInterval === 'month' ? "default" : "ghost"} 
                  size="sm" 
                  className={cn("rounded-xl px-6 font-bold", billingInterval === 'month' && "shadow-lg")}
                  onClick={() => setBillingInterval('month')}
                >
                  Monthly
                </Button>
                <Button 
                  variant={billingInterval === 'year' ? "default" : "ghost"} 
                  size="sm" 
                  className={cn("rounded-xl px-6 font-bold", billingInterval === 'year' && "shadow-lg")}
                  onClick={() => setBillingInterval('year')}
                >
                  Yearly <Badge className="ml-2 bg-emerald-500 hover:bg-emerald-600 border-none text-[8px] h-4">-15%</Badge>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {mainPlans.map((plan) => {
                const isCurrent = plan.id === subscription?.plan
                const displayPrice = billingInterval === 'year' ? plan.price * 12 : plan.price
                const label = billingInterval === 'year' ? '/yr' : '/mo'

                return (
                  <Card key={plan.id} className={cn(
                    "border-none shadow-md rounded-3xl overflow-hidden relative group transition-all duration-300 hover:shadow-2xl flex flex-col",
                    plan.popular && "ring-2 ring-primary"
                  )}>
                    {plan.popular && (
                      <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-black uppercase px-4 py-1.5 rounded-bl-2xl">
                        Most Popular
                      </div>
                    )}
                    <CardHeader className="p-8 pt-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <p className="text-xs font-black uppercase text-muted-foreground tracking-widest">{plan.name}</p>
                        {billingInterval === 'year' && <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-tight h-5">Annual</Badge>}
                      </div>
                      <div className="flex items-baseline gap-1 mt-4">
                        <span className="text-3xl font-black">{formatPrice(displayPrice)}</span>
                        <span className="text-xs text-muted-foreground">{label}</span>
                      </div>
                      {billingInterval === 'year' && <p className="text-[10px] text-muted-foreground font-medium italic">Equivalent to {formatPrice(plan.price)}/mo</p>}
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-8 flex-1 flex flex-col">
                      <Separator className="bg-muted/50" />
                      
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

                      <Separator className="bg-muted/50" />

                      <ul className="space-y-4 flex-1">
                        {plan.features.map((feature: string) => (
                          <li key={feature} className="flex items-start gap-3 text-sm font-medium">
                            <div className="mt-0.5 w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                              <Check className="h-2.5 w-2.5 text-emerald-600" strokeWidth={4} />
                            </div>
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <Button 
                        className={cn(
                          "w-full h-12 font-bold rounded-2xl",
                          isCurrent ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-card hover:bg-muted text-foreground border-2 border-muted"
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
              <h2 className="text-xl font-black uppercase tracking-tight text-muted-foreground/70 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" /> Powerful Add-ons
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {addonPlans.map((addon) => (
                  <Card key={addon.id} className="border-none shadow-md rounded-3xl overflow-hidden hover:shadow-xl transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row justify-between gap-6">
                        <div className="space-y-4 flex-1">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                              {addon.name.toLowerCase().includes('backup') ? <History className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                            </div>
                            <div>
                              <p className="text-lg font-black tracking-tight">{addon.name}</p>
                              <p className="text-sm font-black text-primary">{formatPrice(addon.price)}<span className="text-[10px] text-muted-foreground font-medium">/month</span></p>
                            </div>
                          </div>
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {addon.features.map((feature: string) => (
                              <li key={feature} className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                                <Check className="h-3 w-3 text-emerald-500" /> {feature}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex sm:flex-col justify-end gap-3 shrink-0">
                          <Button 
                            className="font-bold rounded-xl px-6 h-10 shadow-sm"
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
          <Card className="border-none shadow-sm bg-card rounded-3xl overflow-hidden">
            <CardHeader className="bg-muted/20 p-6 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <History className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg font-bold">Billing History</CardTitle>
                </div>
                <Badge variant="outline" className="font-bold">Recent Invoices</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-10" />
                  <p className="font-bold">No payment history yet</p>
                  <p className="text-xs">Your future invoices will appear here.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {invoices.map((inv) => (
                    <div key={inv.id} className="p-4 px-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Invoice #{inv.id.substring(0, 8).toUpperCase()}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                            {new Date(inv.createdAt).toLocaleDateString()} &middot; IDR {inv.amount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className={cn(
                          "text-[10px] font-black uppercase px-2 py-0.5",
                          inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        )}>
                          {inv.status}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  )
}
