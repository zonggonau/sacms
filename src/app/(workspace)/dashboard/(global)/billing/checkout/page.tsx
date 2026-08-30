"use client"

import { useEffect, useState, Suspense } from "react"
import { useSafeSession } from "@/hooks/use-safe-session"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, CreditCard, ArrowLeft, Building2, CheckCircle2, ShieldCheck, Lock, Check, Sparkles, Layers
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { getAccountPricingAction } from "@/actions/billing"

function CheckoutContent() {
  const { data: session, status } = useSafeSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const planId = searchParams.get("plan")
  const initialInterval = (searchParams.get("interval") as "month" | "year") || "year"
  
  const [interval, setInterval] = useState<"month" | "year">(initialInterval)
  const [planData, setPlanData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (status === "authenticated" && planId) {
      getAccountPricingAction(planId)
        .then(plan => {
          if (plan) {
            setPlanData(plan)
          } else {
            toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Paket langganan tidak ditemukan." })
            router.push("/dashboard/billing")
          }
        })
        .catch(err => {
          console.error("Failed to fetch plan:", err)
          toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Terjadi kesalahan jaringan." })
        })
        .finally(() => setLoading(false))
    }
  }, [session, status, planId, router])

  // Reliable Midtrans Snap Loader
  const ensureSnapLoaded = (): Promise<any> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined") return resolve(null)
      if ((window as any).snap && typeof (window as any).snap.pay === "function") {
        return resolve((window as any).snap)
      }

      const snapScript = process.env.NEXT_PUBLIC_MIDTRANS_SNAP_URL || "https://app.sandbox.midtrans.com/snap/snap.js"
      const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "SB-Mid-client-iJwnVpDaskjQe2Z2"

      let script = document.getElementById("midtrans-snap-script") as HTMLScriptElement
      if (!script) {
        script = document.createElement("script")
        script.id = "midtrans-snap-script"
        script.src = snapScript
        script.setAttribute("data-client-key", clientKey)
        script.async = true
        document.head.appendChild(script)
      }

      script.onload = () => {
        resolve((window as any).snap)
      }
      script.onerror = () => {
        console.warn("Midtrans Snap script failed to load via CDN.")
        resolve(null)
      }

      // Safety timeout after 2.5s
      setTimeout(() => {
        resolve((window as any).snap)
      }, 2500)
    })
  }

  // Pre-load Midtrans Snap Script on mount
  useEffect(() => {
    ensureSnapLoaded()
  }, [])

  const handleCheckoutProcess = async () => {
    if (!planData || checkoutLoading) return
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

      if (!res.ok) {
        throw new Error(data.error || "Gagal memproses transaksi checkout")
      }

      if (data.token) {
        const snap = await ensureSnapLoaded()
        
        if (snap && typeof snap.pay === "function") {
          try {
            snap.pay(data.token, {
              onSuccess: () => {
                setCheckoutLoading(false)
                toast({ title: "Pembayaran Berhasil!", description: "Akun Anda telah berhasil di-upgrade." })
                router.push("/dashboard/billing")
                router.refresh()
              },
              onPending: () => {
                setCheckoutLoading(false)
                toast({ title: "Menunggu Pembayaran", description: "Silakan selesaikan transaksi pembayaran Anda." })
                router.push("/dashboard/billing")
                router.refresh()
              },
              onError: () => {
                setCheckoutLoading(false)
                toast({ variant: "destructive", title: "Pembayaran Gagal", description: "Silakan coba kembali pembayaran Anda." })
              },
              onClose: () => {
                setCheckoutLoading(false)
              }
            })

            // Automatically reset button loading state once popup is active
            setTimeout(() => {
              setCheckoutLoading(false)
            }, 2000)
          } catch (snapErr) {
            console.warn("snap.pay error, redirecting to hosted payment page:", snapErr)
            if (data.redirect_url) {
              window.location.href = data.redirect_url
            } else {
              throw snapErr
            }
          }
        } else if (data.redirect_url) {
          // If Snap CDN is blocked by client adblock/network, redirect directly to Midtrans
          toast({ title: "Membuka Halaman Pembayaran...", description: "Mengalihkan Anda ke gerbang Midtrans resmi." })
          window.location.href = data.redirect_url
        } else {
          throw new Error("Sistem pembayaran belum siap. Silakan muat ulang halaman.")
        }
      } else {
        throw new Error(data.error || "Token pembayaran tidak valid.")
      }
    } catch (err: any) {
      console.error("Checkout process error:", err)
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: err.message || "Gagal memproses pembayaran" })
      setCheckoutLoading(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="w-full max-w-5xl mx-auto p-4 md:p-6 lg:p-8 space-y-6 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-muted" />
          <div className="space-y-1.5">
            <div className="h-6 w-48 rounded-lg bg-muted" />
            <div className="h-3.5 w-72 rounded-md bg-muted" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="rounded-2xl border border-border/80 bg-card p-6 space-y-4">
              <div className="h-6 w-40 rounded-md bg-muted" />
              <div className="h-20 w-full rounded-xl bg-muted" />
              <div className="h-28 w-full rounded-xl bg-muted" />
            </Card>
          </div>
          <div className="space-y-4">
            <Card className="rounded-2xl border border-border/80 bg-card p-6 space-y-4">
              <div className="h-5 w-32 rounded-md bg-muted" />
              <div className="h-10 w-full rounded-xl bg-muted" />
              <div className="h-12 w-full rounded-xl bg-muted" />
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (!planData) {
    return null
  }

  const subtotal = interval === "year" 
    ? (planData.yearlyPrice !== undefined ? planData.yearlyPrice : planData.yearlyPriceAmount || planData.priceAmount * 10) 
    : (planData.monthlyPriceAmount !== undefined ? planData.monthlyPriceAmount : planData.priceAmount)
  const ppn = Math.round(subtotal * 0.11)
  const total = subtotal + ppn

  const features = Array.isArray(planData.features) ? planData.features : []

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-20">
      
      {/* Header with Back Button and Interval Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="icon" 
            asChild 
            className="rounded-xl h-9 w-9 border-border/80 shadow-xs hover:bg-muted"
          >
            <Link href="/dashboard/billing">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Checkout Paket Akun</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Tinjau rincian langganan akun dan selesaikan pembayaran dengan aman.</p>
          </div>
        </div>

        {/* Interval Toggle Switcher */}
        <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/60 w-fit">
          <button
            type="button"
            onClick={() => setInterval("month")}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              interval === "month"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Bulanan
          </button>
          <button
            type="button"
            onClick={() => setInterval("year")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
              interval === "year"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Tahunan</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-black">Hemat</span>
          </button>
        </div>
      </div>
      
      {/* 2-Column Responsive Grid matching other checkout pages */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Order Summary & Features */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-xs border border-border/80 rounded-2xl overflow-hidden bg-card">
            <CardHeader className="bg-muted/20 border-b border-border/60 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2 font-bold text-foreground">
                    <Building2 className="h-5 w-5 text-primary" /> {planData.name}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {planData.description || "Tingkatkan kuota workspace & kemampuan akun Anda."}
                  </CardDescription>
                </div>
                <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs font-bold px-2.5 py-1 rounded-lg">
                  {interval === "year" ? "Billing Tahunan" : "Billing Bulanan"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              {/* Workspace Allowance Highlight */}
              <div className="p-4 rounded-xl bg-primary/[0.03] border border-primary/15 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Batas Kuota Workspace</p>
                    <p className="text-[11px] text-muted-foreground">Kapasitas workspace mandiri yang dapat aktif bersamaan</p>
                  </div>
                </div>
                <Badge variant="secondary" className="font-mono font-bold text-xs px-2.5 py-1">
                  {planData.workspaces || planData.max_workspaces || 3} Workspace
                </Badge>
              </div>

              {/* Features Checklist */}
              {features.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fitur & Keuntungan Akun</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {features.map((feat: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-foreground/90 font-medium">
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cost Breakdown */}
              <div className="space-y-3 pt-4 border-t border-border/60">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Harga Langganan ({interval === "year" ? "1 Tahun" : "1 Bulan"})</span>
                  <span className="text-foreground font-semibold">
                    {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>PPN (11%)</span>
                  <span className="text-foreground font-semibold">
                    {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(ppn)}
                  </span>
                </div>
                <div className="border-t border-border/80 mt-3 pt-3 flex justify-between items-baseline">
                  <div>
                    <span className="text-sm font-bold text-foreground">Total Tagihan</span>
                    <p className="text-[10px] text-muted-foreground">Sudah termasuk pajak PPN 11%</p>
                  </div>
                  <span className="text-2xl font-black text-primary tracking-tight">
                    {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(total)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Payment Actions & Security */}
        <div className="space-y-6">
          <Card className="shadow-xs border border-primary/25 bg-card rounded-2xl overflow-hidden">
            <CardHeader className="bg-primary/[0.04] border-b border-primary/10 p-5">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <CreditCard className="h-4 w-4 text-primary" /> Pembayaran Aman
              </CardTitle>
              <CardDescription className="text-xs">
                Didukung oleh Midtrans Payment Gateway
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              
              <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                <p>
                  Mendukung seluruh metode pembayaran lokal: <strong>QRIS, GoPay, OVO, ShopeePay, Virtual Account Bank</strong>, dan <strong>Kartu Kredit</strong>.
                </p>
                <div className="flex items-center gap-2 pt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>Enkripsi 256-bit & Verifikasi Otomatis Instant</span>
                </div>
              </div>

              <Button 
                className="w-full h-11 text-sm font-bold rounded-xl shadow-xs gap-2"
                onClick={handleCheckoutProcess}
                disabled={checkoutLoading}
              >
                {checkoutLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Menghubungkan Midtrans...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    <span>Bayar Sekarang ({new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(total)})</span>
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground text-center pt-1">
                <Lock className="h-3 w-3" />
                <span>Transaksi terlindungi. Batalkan langganan kapan saja.</span>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}
