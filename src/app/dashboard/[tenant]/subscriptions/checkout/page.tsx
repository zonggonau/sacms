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
  ArrowLeft, Zap, Lock, AlertCircle, Info
} from "lucide-react"
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
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
  const [snapToken, setSnapToken] = useState<string | null>(null)

  const tenants = useMemo(() => session?.user?.tenants || [], [session])
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
    if (!currentTenant) {
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
          tenantId: currentTenant.id,
          interval: interval
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

  if (initializing || !plan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const basePrice = interval === 'year' ? plan.price * 12 : plan.price
  const credit = proration?.credit || 0
  const subtotal = Math.max(0, basePrice - credit)
  const tax = Math.round(subtotal * 0.11)
  const total = subtotal + tax

  return (
    <div className="flex min-h-screen bg-muted/10">
      <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-12 max-w-6xl mx-auto space-y-8">
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Checkout</h1>
              <p className="text-muted-foreground">Review your plan and complete the payment.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              {/* Order Summary */}
              <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-card">
                <CardHeader className="bg-muted/20 border-b p-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold">Review Order</CardTitle>
                    <Badge variant="outline" className="rounded-lg font-bold uppercase tracking-tight">
                      {interval === 'year' ? 'Annual' : 'Monthly'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="flex items-center justify-between p-6 rounded-2xl bg-primary/5 border border-primary/10">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                        <Zap className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="font-black text-xl tracking-tight">{plan.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em]">{interval === 'year' ? 'Yearly Billing' : 'Monthly Billing'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black">{formatPrice(basePrice)}</p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-muted-foreground">Plan Price</span>
                      <span>{formatPrice(basePrice)}</span>
                    </div>
                    
                    {credit > 0 && (
                      <div className="flex justify-between text-sm font-medium text-emerald-600">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4" /> Unused Credit ({proration.currentPlan})
                        </span>
                        <span>-{formatPrice(credit)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>

                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-muted-foreground">PPN (11%)</span>
                      <span>{formatPrice(tax)}</span>
                    </div>
                    
                    <Separator className="my-4 bg-muted/60" />
                    
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-lg font-bold">Total Amount</span>
                        {credit > 0 && <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight">Proration applied</p>}
                      </div>
                      <span className="text-3xl font-black text-primary tracking-tighter">{formatPrice(total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Proration Info (if applicable) */}
              {proration && proration.credit > 0 && (
                <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl flex gap-4 text-blue-800 shadow-sm">
                  <Info className="h-5 w-5 shrink-0 mt-0.5 text-blue-500" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-tight">Proration applied</p>
                    <p className="text-[11px] leading-relaxed opacity-80">
                      We've credited <strong>{formatPrice(proration.credit)}</strong> from your unused time on the <strong>{proration.currentPlan}</strong> plan toward this upgrade.
                    </p>
                  </div>
                </div>
              )}

              {/* Security Hint */}
              <div className="p-5 bg-zinc-50 border border-zinc-200 rounded-2xl flex gap-4 text-zinc-600 shadow-sm">
                <Lock className="h-5 w-5 shrink-0 mt-0.5 text-zinc-400" />
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-tight text-zinc-800">Secure Payment</p>
                  <p className="text-[11px] leading-relaxed opacity-80">
                    Your transaction is processed securely via <strong>Midtrans</strong>. We do not store your credit card or sensitive financial information on our servers.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <Card className="border-none shadow-xl bg-zinc-900 text-white rounded-3xl overflow-hidden">
                <CardHeader className="p-6 pb-0">
                  <CardTitle className="text-base font-bold uppercase tracking-widest opacity-50">Summary</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-zinc-400">Workspace</p>
                    <p className="font-bold text-lg truncate">{currentTenant?.name}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-zinc-400">Selected Plan</p>
                    <Badge className="bg-emerald-500 text-white border-none font-black text-[10px]">{plan.name}</Badge>
                  </div>
                  
                  <Separator className="bg-white/10" />
                  
                  <Button 
                    className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-lg rounded-2xl shadow-2xl shadow-primary/20"
                    onClick={handleCheckout}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <><CreditCard className="mr-2 h-5 w-5" /> PAY NOW</>}
                  </Button>
                  
                  <p className="text-[10px] text-center text-zinc-500 font-medium">
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
      </main>
    </div>
  )
}
