"use client"

import { useEffect, useState, Suspense } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CreditCard, ArrowLeft, Building2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"

function CheckoutContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const planId = searchParams.get("plan")
  const interval = searchParams.get("interval") || "year"
  
  const [planData, setPlanData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (status === "authenticated" && planId) {
      const globalToken = process.env.NEXT_PUBLIC_SYSTEM_API_KEY || "internal"

      // Fetch Account Plans
      fetch("/api/public/sacms-global/content/sacms-account-pricing?sort=price:asc", {
        headers: { "Authorization": `Bearer ${globalToken}` }
      })
        .then(res => res.json())
        .then(json => {
          if (json.data && Array.isArray(json.data)) {
            const plan = json.data.find((p: any) => p.plan_slug === planId)
            if (plan) {
              setPlanData({
                id: plan.plan_slug,
                name: plan.name,
                priceAmount: plan.price,
                yearlyPrice: plan.yearly_price !== undefined ? plan.yearly_price : plan.price * 10
              })
            } else {
              toast({ variant: "destructive", title: "Error", description: "Plan not found." })
              router.push("/dashboard/billing")
            }
          }
        })
        .catch(err => {
          console.error("Failed to fetch plan:", err)
          toast({ variant: "destructive", title: "Error", description: "Network error." })
        })
        .finally(() => setLoading(false))
    }
  }, [session, status, planId, router])

  // Load Midtrans Snap Script
  useEffect(() => {
    const snapScript = process.env.NEXT_PUBLIC_MIDTRANS_SNAP_URL || "https://app.sandbox.midtrans.com/snap/snap.js"
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

  const handleCheckoutProcess = async () => {
    if (!planData) return
    setCheckoutLoading(true)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: planData.id,
          type: "account",
          interval: interval
        }),
      })

      const data = await res.json()

      if (res.ok && data.token) {
        if (typeof window !== 'undefined' && (window as any).snap) {
          ;(window as any).snap.pay(data.token, {
            onSuccess: (result: any) => {
              toast({ title: "Payment Successful!", description: "Your account has been upgraded." })
              router.push("/dashboard/billing")
              router.refresh()
            },
            onPending: (result: any) => {
              toast({ title: "Payment Pending", description: "Please complete your payment." })
              router.push("/dashboard/billing")
              router.refresh()
            },
            onError: (error: any) => {
              toast({ variant: "destructive", title: "Payment Failed", description: "Please try again." })
            },
            onClose: () => {
              setCheckoutLoading(false)
            }
          })
        } else {
          toast({ variant: "destructive", title: "Error", description: "Payment system not ready." })
          setCheckoutLoading(false)
        }
      } else {
        throw new Error(data.error || "Checkout failed")
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
      setCheckoutLoading(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!planData) {
    return null
  }

  const subtotal = interval === "year" ? planData.yearlyPrice : planData.priceAmount
  const ppn = Math.round(subtotal * 0.11)
  const total = subtotal + ppn

  return (
    <div className="max-w-8xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-20">
      
      <div className="flex items-center gap-4 border-b border-border pb-6">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/dashboard/billing">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Checkout</h2>
          <p className="text-sm text-muted-foreground mt-1">Review your subscription details and complete payment.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Order Summary */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Order Summary</h3>
          <Card className="shadow-sm">
            <CardHeader className="bg-muted/30 border-b border-border">
              <CardTitle className="text-xl flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" /> {planData.name} Plan
              </CardTitle>
              <CardDescription className="capitalize">{interval} Billing</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="text-foreground font-medium">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>PPN (11%)</span>
                <span className="text-foreground font-medium">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(ppn)}</span>
              </div>
              <div className="border-t border-border mt-4 pt-4 flex justify-between items-end">
                <span className="text-base font-bold">Total Due</span>
                <span className="text-3xl font-black text-primary tracking-tight">
                  {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(total)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Payment Details</h3>
          <Card className="shadow-sm border-primary/20 bg-primary/5">
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <p className="text-sm">
                  You will be redirected to Midtrans secure payment gateway. Multiple payment methods are supported including Virtual Accounts, GoPay, QRIS, and Credit Card.
                </p>
                <p className="text-xs text-muted-foreground">
                  By confirming your purchase, you allow SaCMS to charge you for future payments in accordance with their terms. You can always cancel your subscription.
                </p>
              </div>

              <Button 
                className="w-full h-12 text-base font-bold"
                onClick={handleCheckoutProcess}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CreditCard className="mr-2 h-5 w-5" />}
                {checkoutLoading ? "Processing Secure Payment..." : "Pay Now"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <CheckoutContent />
    </Suspense>
  )
}
