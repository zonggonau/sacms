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
  ArrowLeft, Zap, Lock, AlertCircle, Info, Check, Shield
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { getGlobalWorkspaceIdAction } from "@/actions/tenant"

export default function CheckoutPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  const tenantSlug = params?.tenant as string
  const planId = searchParams.get("plan")
  const interval = (searchParams.get("interval") as 'month' | 'year') || 'year'

  const [plan, setPlan] = useState<any>(null)
  const [proration, setProration] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [loadingTenants, setLoadingTenants] = useState(true)
  const [snapToken, setSnapToken] = useState<string | null>(null)
  const [liveTenants, setLiveTenants] = useState<any[]>([])
  const [globalTenantId, setGlobalTenantId] = useState<string | null>(null)
  const [usage, setUsage] = useState<any[]>([])

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
        const [plansRes, prorateRes, usageRes, globalId] = await Promise.all([
          fetch(`/api/tenant/${tenantSlug}/subscriptions/plans`),
          fetch(`/api/tenant/${tenantSlug}/subscription/prorate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newPlan: planId })
          }),
          fetch(`/api/tenant/${tenantSlug}/billing/usage`),
          getGlobalWorkspaceIdAction(),
        ])

        if (plansRes.ok) {
          const plansData = await plansRes.json()
          const selectedPlan = plansData.plans?.find((p: any) => p.id === planId || p.slug === planId)
          setPlan(selectedPlan)
        }
        
        if (prorateRes.ok) {
          const prorateData = await prorateRes.json()
          setProration(prorateData)
        }

        if (usageRes.ok) {
          const usageData = await usageRes.json()
          setUsage(usageData.usage || [])
        }

        setGlobalTenantId(globalId)
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
    const isAccount = tenantSlug === "account"
    const isSystemTenant = tenantSlug === globalTenantId
    if (!currentTenant && !isAccount && !isSystemTenant) {
      toast({ variant: "destructive", title: "Error", description: "Informasi workspace tidak ditemukan." })
      return
    }
    if (!plan) {
      toast({ variant: "destructive", title: "Error", description: "Paket langganan tidak ditemukan." })
      return
    }
    
    setLoading(true)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          tenantId: isAccount ? null : (currentTenant?.id || tenantSlug),
          interval: interval,
          type: isAccount ? "account" : "workspace"
        }),
      })

      const data = await res.json()

      if (res.ok && data.token) {
        setSnapToken(data.token)
        
        if (typeof window !== 'undefined' && (window as any).snap) {
          (window as any).snap.pay(data.token, {
            onSuccess: (result: any) => {
              toast({ title: "Pembayaran Berhasil!", description: "Paket workspace Anda telah diperbarui." })
              router.push(`/dashboard/${tenantSlug}/subscriptions`)
            },
            onPending: (result: any) => {
              toast({ title: "Menunggu Pembayaran", description: "Silakan selesaikan pembayaran Anda." })
              router.push(`/dashboard/${tenantSlug}/subscriptions`)
            },
            onError: (error: any) => {
              toast({ variant: "destructive", title: "Pembayaran Gagal", description: "Silakan coba lagi." })
            },
            onClose: () => {
              setLoading(false)
            }
          })
        } else {
          toast({ variant: "destructive", title: "Sistem Pembayaran Belum Siap", description: "Silakan muat ulang halaman." })
          setLoading(false)
        }
      } else {
        throw new Error(data.error || "Inisialisasi checkout gagal.")
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Checkout", description: err.message })
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
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const basePrice = interval === 'year' ? (plan.yearlyPrice !== undefined ? plan.yearlyPrice : plan.price * 10) : plan.price
  const credit = proration?.credit || 0
  const subtotal = Math.max(0, basePrice - credit)
  const tax = Math.round(subtotal * 0.11)
  const total = subtotal + tax

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-5xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => router.back()} 
              className="rounded-xl h-9 w-9 border-border/80"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">Checkout Langganan</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Tinjau rincian paket dan selesaikan pembayaran dengan aman.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left: Order Review */}
            <div className="lg:col-span-2 space-y-4">
              {/* Downgrade / Capacity Warning Banner if applicable */}
              {(() => {
                const entriesUsage = usage.find((u) => u.unit === "entries")?.current || 0
                const schemasUsage = usage.find((u) => u.unit === "schemas")?.current || 0
                const isEntriesOver = plan.maxContentEntries && entriesUsage > plan.maxContentEntries
                const isSchemasOver = plan.maxContentTypes && schemasUsage > plan.maxContentTypes

                if (isEntriesOver || isSchemasOver) {
                  return (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300 animate-in fade-in duration-200">
                      <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold">Peringatan Kapasitas Paket Terpilih</p>
                        <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300/90">
                          Penggunaan Anda saat ini ({entriesUsage.toLocaleString()} entri / {schemasUsage} model) melebihi batas kuota paket ini ({plan.maxContentEntries?.toLocaleString()} entri / {plan.maxContentTypes} model). Data yang sudah ada tetap aman dan dapat diakses, namun Anda tidak dapat menambah konten baru sampai batas kuota disesuaikan.
                        </p>
                      </div>
                    </div>
                  )
                }
                return null
              })()}

              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Rincian Pesanan
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] font-bold uppercase rounded-full bg-primary/10 text-primary border-primary/20">
                    Billing {interval === 'year' ? 'Tahunan' : 'Bulanan'}
                  </Badge>
                </CardHeader>

                <CardContent className="p-5 space-y-5">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/60">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                        <Zap className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-base text-foreground">{plan.name}</p>
                        <p className="text-[11px] text-muted-foreground">{interval === 'year' ? 'Periode Tagihan Tahunan' : 'Periode Tagihan Bulanan'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-foreground">{formatPrice(basePrice)}</p>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between font-medium text-muted-foreground">
                      <span>Harga Paket</span>
                      <span className="text-foreground font-bold">{formatPrice(basePrice)}</span>
                    </div>
                    
                    {credit > 0 && (
                      <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400">
                        <span className="flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5" /> Kredit Sisa Periode ({proration.currentPlan})
                        </span>
                        <span>-{formatPrice(credit)}</span>
                      </div>
                    )}

                    <div className="flex justify-between font-medium text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="text-foreground font-bold">{formatPrice(subtotal)}</span>
                    </div>

                    <div className="flex justify-between font-medium text-muted-foreground">
                      <span>PPN (11%)</span>
                      <span className="text-foreground font-bold">{formatPrice(tax)}</span>
                    </div>
                    
                    <Separator className="my-2" />
                    
                    <div className="flex justify-between items-baseline pt-1">
                      <div>
                        <span className="text-sm font-bold text-foreground">Total Tagihan</span>
                        {credit > 0 && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Prorasi otomatis diterapkan</p>}
                      </div>
                      <span className="text-2xl font-black text-primary tracking-tight">{formatPrice(total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Security Hint */}
              <div className="p-4 bg-muted/20 border border-border/60 rounded-xl flex items-center gap-3 text-xs text-muted-foreground">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                <p className="leading-relaxed">
                  Transaksi diproses secara aman menggunakan payment gateway <strong>Midtrans</strong>. Kredensial kartu atau akun finansial Anda terlindungi dengan enkripsi standar industri.
                </p>
              </div>
            </div>

            {/* Right: Payment Action Box */}
            <div className="space-y-4">
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Ringkasan Pembayaran
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-5 space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Workspace Tujuan</p>
                    <p className="font-bold text-sm text-foreground truncate">
                      {tenantSlug === "account" ? session?.user?.name || "Personal Account" : currentTenant?.name}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Paket Dipilih</p>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold text-xs rounded-lg">
                      {plan.name}
                    </Badge>
                  </div>
                  
                  <Separator />
                  
                  <Button 
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl shadow-xs"
                    onClick={handleCheckout}
                    disabled={loading || (proration?.isDowngrade && proration?.isActive)}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <><CreditCard className="mr-2 h-4 w-4" /> BAYAR SEKARANG</>
                    )}
                  </Button>
                  
                  <p className="text-[10px] text-center text-muted-foreground leading-relaxed">
                    Dengan mengklik "Bayar Sekarang", Anda menyetujui Ketentuan Layanan SaCMS.
                  </p>
                </CardContent>
              </Card>

              <div className="flex flex-col items-center gap-2 p-3 text-center">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Metode Pembayaran Didukung</p>
                <p className="text-xs text-muted-foreground font-medium">QRIS, GoPay, OVO, ShopeePay, Virtual Account BCA/Mandiri/BNI/BRI, Kartu Kredit.</p>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  )
}
