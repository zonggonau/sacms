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

  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [snapToken, setSnapToken] = useState<string | null>(null)

  const tenants = useMemo(() => session?.user?.tenants || [], [session])
  const currentTenant = useMemo(() => tenants.find(t => t.slug === tenantSlug), [tenants, tenantSlug])

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated") setInitializing(false)
  }, [status, router])

  useEffect(() => {
    async function fetchPlans() {
      if (!tenantSlug) return
      try {
        const res = await fetch(`/api/tenant/${tenantSlug}/subscriptions/plans`)
        const data = await res.json()
        if (data.plans) {
          const selectedPlan = data.plans.find((p: any) => p.id === planId) || data.plans[0]
          setPlan(selectedPlan)
        }
      } catch (error) {
        console.error("Failed to fetch plans", error)
      }
    }
    fetchPlans()
  }, [tenantSlug, planId])

  // Load Midtrans Snap Script
  useEffect(() => {
    const snapScript = "https://app.sandbox.midtrans.com/snap/snap.js"
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ""
    
    const script = document.createElement("script")
    script.src = snapScript
    script.setAttribute("data-client-key", clientKey)
    script.async = true
    document.body.appendChild(script)

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [])

  const handleCheckout = async () => {
    if (!currentTenant || !plan) return
    setLoading(true)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          tenantId: currentTenant.id
        }),
      })

      const data = await res.json()
      if (res.ok && data.token) {
        setSnapToken(data.token)
        // @ts-ignore
        window.snap.pay(data.token, {
          onSuccess: (result: any) => {
            toast({ title: "Payment Successful!", description: "Your workspace has been upgraded." })
            router.push(`/dashboard/${tenantSlug}/subscriptions`)
          },
          onPending: (result: any) => {
            toast({ title: "Payment Pending", description: "Please complete your payment." })
            router.push(`/dashboard/${tenantSlug}/subscriptions`)
          },
          onError: (error: any) => {
            toast({ variant: "destructive", title: "Payment Failed", description: "Please try again." })
          },
          onClose: () => {
            setLoading(false)
          }
        })
      } else {
        throw new Error(data.error || "Checkout initialization failed")
      }
    } catch (err: any) {
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

  return (
    <div className="flex min-h-screen bg-muted/10">
      <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-12 max-w-6xl mx-auto space-y-8">
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Checkout</h1>
              <p className="text-muted-foreground">Complete your subscription to unlock premium features.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              {/* Order Summary */}
              <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-card">
                <CardHeader className="bg-muted/20 border-b p-6">
                  <CardTitle className="text-lg font-bold">Review Order</CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Zap className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-bold text-lg">{plan.name}</p>
                        <p className="text-xs text-muted-foreground uppercase font-black tracking-widest">Monthly Billing</p>
                      </div>
                    </div>
                    <p className="text-xl font-black">{formatPrice(plan.price)}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{formatPrice(plan.price)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Platform Fee</span>
                      <span className="font-medium text-emerald-600">FREE</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between">
                      <span className="text-lg font-bold">Total Amount</span>
                      <span className="text-2xl font-black text-primary">{formatPrice(plan.price)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Security Hint */}
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex gap-3 text-emerald-800">
                <Lock className="h-5 w-5 shrink-0" />
                <p className="text-[11px] leading-relaxed">
                  Your payment is secured by <strong>Midtrans</strong>. We do not store your credit card or sensitive financial information on our servers.
                </p>
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
