"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Loader2, CreditCard, ShieldCheck, CheckCircle2, 
  ArrowLeft, Zap, Lock, AlertCircle, Info, Check
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function CheckoutPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  const tenantSlug = params?.tenant as string
  const planId = searchParams.get("plan")
  const interval = (searchParams.get("interval") as 'month' | 'year') || 'month'

  const [plan, setPlan] = useState<any>(null)
  const [proration, setProration] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [loadingTenants, setLoadingTenants] = useState(true)
  const [snapToken, setSnapToken] = useState<string | null>(null)
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
        console.error("Failed to fetch live tenants in checkout:", error)
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

  const tenants = useMemo(() => {
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
    tenants.find(t => t.slug === tenantSlug || t.id === tenantSlug), 
    [tenants, tenantSlug]
  )

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated") setInitializing(false)
  }, [status, router])

  useEffect(() => {
    async function fetchData() {
      if (!tenantSlug || !planId) return
      try {
        console.log("Fetching plans for tenant:", tenantSlug);
        // Fetch Plan Details
        const plansRes = await fetch(`/api/tenant/${tenantSlug}/subscriptions/plans`)
        const plansData = await plansRes.json()
        console.log("Plans data received:", plansData);
        
        const selectedPlan = plansData.plans?.find((p: any) => p.id === planId || p.slug === planId)
        console.log("Selected plan:", selectedPlan);
        setPlan(selectedPlan)

        // Fetch Proration Info
        const prorateRes = await fetch(`/api/tenant/${tenantSlug}/subscription/prorate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPlan: planId })
        })
        if (prorateRes.ok) {
          const prorateData = await prorateRes.json();
          console.log("Proration data:", prorateData);
          setProration(prorateData)
        }
      } catch (error) {
        console.error("Failed to fetch checkout data", error)
      }
    }
    fetchData()
  }, [tenantSlug, planId])

  // Load Midtrans Snap Script
  useEffect(() => {
    const snapScript = process.env.NEXT_PUBLIC_MIDTRANS_SNAP_URL || "https://app.sandbox.midtrans.com/snap/snap.js"
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ""
    
    console.log("Loading Midtrans Snap Script from:", snapScript);

    const script = document.createElement("script")
    script.src = snapScript
    script.setAttribute("data-client-key", clientKey)
    script.async = true
    script.onload = () => console.log("Midtrans Snap Script loaded successfully");
    script.onerror = () => console.error("Failed to load Midtrans Snap Script");
    document.body.appendChild(script)

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [])

  const handleCheckout = async () => {
    const isAccount = tenantSlug === "account"
    if (!currentTenant && !isAccount) {
      console.error("Missing tenant data. TenantSlug:", tenantSlug, "Available tenants:", tenants);
      toast({ variant: "destructive", title: "Error", description: "Tenant information not found. Please try again." });
      return
    }
    if (!plan) {
      console.error("Missing plan data. PlanId:", planId);
      toast({ variant: "destructive", title: "Error", description: "Plan information not found. Please try again." });
      return
    }
    
    setLoading(true)
    try {
      console.log("Creating checkout session for:", { planId: plan.id, tenantId: currentTenant.id, interval });
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          tenantId: isAccount ? null : currentTenant?.id,
          interval: interval,
          type: isAccount ? "account" : "tenant"
        }),
      })

      const data = await res.json()
      console.log("Checkout API response:", data);

      if (res.ok && data.token) {
        setSnapToken(data.token)
        console.log("Triggering Midtrans Snap for token:", data.token);
        
        // Check if snap is available on window
        if (typeof window !== 'undefined' && (window as any).snap) {
          (window as any).snap.pay(data.token, {
            onSuccess: (result: any) => {
              console.log("Payment success:", result);
              toast({ title: "Payment Successful!", description: "Your workspace has been upgraded." })
              router.push(`/dashboard/${tenantSlug}/subscriptions`)
            },
            onPending: (result: any) => {
              console.log("Payment pending:", result);
              toast({ title: "Payment Pending", description: "Please complete your payment." })
              router.push(`/dashboard/${tenantSlug}/subscriptions`)
            },
            onError: (error: any) => {
              console.error("Payment error:", error);
              toast({ variant: "destructive", title: "Payment Failed", description: "Please try again." })
            },
            onClose: () => {
              console.log("Payment popup closed");
              setLoading(false)
            }
          })
        } else {
          console.error("Midtrans Snap is not loaded on window object");
          toast({ variant: "destructive", title: "Checkout Error", description: "Payment system not ready. Please refresh the page." })
          setLoading(false)
        }
      } else {
        throw new Error(data.error || "Checkout initialization failed")
      }
    } catch (err: any) {
      console.error("Checkout process error:", err);
      toast({ variant: "destructive", title: "Checkout Error", description: err.message })
      setLoading(false)
    }
  }

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (initializing || !plan || loadingTenants) {
    return (
      <div className="flex items-center justify-center bg-background text-foreground flex-1 flex-col w-full">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  const basePrice = interval === 'year' ? plan.price * 12 : plan.price
  const credit = proration?.credit || 0
  const subtotal = Math.max(0, basePrice - credit)
  const tax = Math.round(subtotal * 0.11)
  const total = subtotal + tax

  return (
    <div className="flex relative flex-1 flex-col w-full">
<div className="flex-1 min-w-0 h-full overflow-x-hidden bg-background text-foreground flex-col w-full">
        <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-none hover:bg-muted border border-border">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight">Checkout</h1>
              <p className="text-xs text-muted-foreground font-medium mt-1">Review your plan and complete the payment securely.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              {/* Order Summary */}
              <Card className="border border-border shadow-none rounded-none overflow-hidden bg-card text-card-foreground">
                <CardHeader className="bg-muted/10 border-b border-border p-6 rounded-none">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-black uppercase tracking-tight">Review Order</CardTitle>
                    <Badge variant="outline" className="rounded-none border-border font-black uppercase tracking-widest text-[9px]">
                      {interval === 'year' ? 'Annual' : 'Monthly'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="flex items-center justify-between p-6 rounded-none bg-muted/30 border border-border">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-none bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0">
                        <Zap className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="font-black text-xl uppercase tracking-tight">{plan.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">{interval === 'year' ? 'Yearly Billing' : 'Monthly Billing'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black">{formatPrice(basePrice)}</p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <span>Plan Price</span>
                      <span className="text-foreground">{formatPrice(basePrice)}</span>
                    </div>
                    
                    {credit > 0 && (
                      <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-orange-500">
                        <span className="flex items-center gap-1.5">
                          <Check className="h-4 w-4" /> Unused Credit ({proration.currentPlan})
                        </span>
                        <span>-{formatPrice(credit)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="text-foreground">{formatPrice(subtotal)}</span>
                    </div>

                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <span>PPN (11%)</span>
                      <span className="text-foreground">{formatPrice(tax)}</span>
                    </div>
                    
                    <Separator className="my-4 bg-border" />
                    
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-base font-black uppercase tracking-tight">Total Amount</span>
                        {credit > 0 && <p className="text-[9px] text-orange-500 font-black uppercase tracking-widest mt-0.5">Proration applied</p>}
                      </div>
                      <span className="text-3xl font-black text-foreground tracking-tight">{formatPrice(total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Proration Info (if applicable) */}
              {proration && proration.credit > 0 && (
                <div className="p-5 bg-orange-500/5 border border-orange-500/10 rounded-none flex gap-4 text-orange-500 shadow-none">
                  <Info className="h-5 w-5 shrink-0 mt-0.5 text-orange-500" />
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase tracking-widest">Proration applied</p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground font-medium">
                      We've credited <strong className="text-foreground">{formatPrice(proration.credit)}</strong> from your unused time on the <strong className="text-foreground">{proration.currentPlan}</strong> plan toward this upgrade.
                    </p>
                  </div>
                </div>
              )}

              {/* Security Hint */}
              <div className="p-5 bg-card border border-border rounded-none flex gap-4 text-muted-foreground shadow-none">
                <Lock className="h-5 w-5 shrink-0 mt-0.5 text-orange-500" />
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-widest text-foreground">Secure Payment</p>
                  <p className="text-[11px] leading-relaxed font-medium text-muted-foreground">
                    Your transaction is processed securely via <strong>Midtrans</strong>. We do not store your credit card or sensitive financial information on our servers.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <Card className="border border-border shadow-none bg-card text-foreground rounded-none overflow-hidden">
                <CardHeader className="p-6 pb-0 rounded-none">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Summary</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{tenantSlug === "account" ? "Account" : "Workspace"}</p>
                    <p className="font-bold text-lg uppercase tracking-tight truncate">{tenantSlug === "account" ? session?.user?.name || "Personal Account" : currentTenant?.name}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Selected Plan</p>
                    <Badge className="bg-orange-500 text-white hover:bg-orange-600 border-none font-black text-[10px] px-2 py-0.5 rounded-none uppercase tracking-widest">{plan.name}</Badge>
                  </div>
                  
                  <Separator className="bg-border" />
                  
                  <Button 
                    className="w-full h-14 bg-orange-500 hover:bg-orange-600 text-white font-black text-lg rounded-none shadow-none border-none"
                    onClick={handleCheckout}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-6 w-6 animate-spin text-white" /> : <><CreditCard className="mr-2 h-5 w-5" /> PAY NOW</>}
                  </Button>
                  
                  <p className="text-[10px] text-center text-muted-foreground font-medium">
                    By clicking "Pay Now", you agree to our Terms of Service and Subscription Agreement.
                  </p>
                </CardContent>
              </Card>

              <div className="flex flex-col items-center gap-4 py-4">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Supported Methods</p>
                <div className="flex gap-4 grayscale opacity-50 h-6">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal" className="h-full" />
                  <img src="https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg" alt="Visa" className="h-full" />
                  <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
