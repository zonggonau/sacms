"use client"

import { useEffect, useState, useMemo } from "react"
import { useSafeSession } from "@/hooks/use-safe-session"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import {
  Loader2, Zap, CreditCard, CheckCircle2, ShieldCheck, Crown, Receipt, Clock, RefreshCw, Database, Download, Cloud, Save, Sparkles,
  Eye, EyeOff, Search, XCircle, Calendar, ArrowUpRight, FileText, Check, Copy, Building2, Server
} from "lucide-react"
import { getTransactionHistoryAction, checkTransactionStatusAction } from "@/actions/billing"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { EnterpriseLicenseBanner } from "@/components/dashboard/enterprise-license-banner"
import { generateInvoicePDF } from "@/lib/pdf-generator"
import { InvoiceDetailDialog, TransactionInvoiceItem } from "@/components/dashboard/invoice-detail-dialog"
import { VpsStatusList } from "@/components/dashboard/vps-status-list"

export default function BillingClient({
  initialAccountPlans,
  initialActiveWorkspacesCount,
  initialUsage,
  initialAiCreditUsage,
  initialTransactions,
  initialTransactionsTotalPages,
  isAccountEnterpriseLicensed,
  initialVpsOfferings
}: {
  initialAccountPlans: any[]
  initialActiveWorkspacesCount: number
  initialUsage: any
  initialAiCreditUsage?: { used: number, total: number, remaining: number, isUnlimited: boolean }
  initialTransactions: any[]
  initialTransactionsTotalPages?: number
  /** Account-level license (isEnterpriseTenant(userId) — see license.ts).
   *  When active, the yearly account-plan grid is hidden — see section 2
   *  below. The "Database & Storage" infra override this account grants
   *  now lives on its own page at /dashboard/infrastructure. */
  isAccountEnterpriseLicensed?: boolean
  /** Sellable VPS catalog (VpsOffering rows) — bought here as account-shared
   *  infrastructure, usable by every workspace this account owns. */
  initialVpsOfferings?: any[]
}) {
  const { data: session, status, update } = useSafeSession()
  const router = useRouter()

  const [accountPlans, setAccountPlans] = useState<any[]>(initialAccountPlans)
  const [updatingPlanId, setUpdatingPlanId] = useState<string | null>(null)
  const [activeWorkspacesCount, setActiveWorkspacesCount] = useState(initialActiveWorkspacesCount)
  const [usage, setUsage] = useState<{current: number, max: number | null, allowed: boolean, plan: string} | null>(initialUsage)
  const [aiUsage, setAiUsage] = useState(initialAiCreditUsage || null)
  const [transactions, setTransactions] = useState<any[]>(initialTransactions)
  const [transactionsPage, setTransactionsPage] = useState(1)
  const [transactionsTotalPages, setTransactionsTotalPages] = useState(initialTransactionsTotalPages || 1)
  const [loadingMoreTx, setLoadingMoreTx] = useState(false)
  const [checkingOrderId, setCheckingOrderId] = useState<string | null>(null)

  // Invoice Modal & Filter State
  const [selectedInvoice, setSelectedInvoice] = useState<TransactionInvoiceItem | null>(null)
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
  const [historySearchQuery, setHistorySearchQuery] = useState("")
  const [debouncedHistorySearch, setDebouncedHistorySearch] = useState("")
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | "paid" | "pending" | "cancelled">("all")

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedHistorySearch(historySearchQuery), 300)
    return () => clearTimeout(handler)
  }, [historySearchQuery])

  const handleLoadMoreTransactions = async () => {
    setLoadingMoreTx(true)
    try {
      const nextPage = transactionsPage + 1
      const result = await getTransactionHistoryAction(nextPage, 50)
      setTransactions(prev => [...prev, ...result.transactions])
      setTransactionsPage(nextPage)
      setTransactionsTotalPages(result.totalPages)
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal memuat riwayat transaksi berikutnya." })
    } finally {
      setLoadingMoreTx(false)
    }
  }

  // Helper status checkers
  const isPaidStatus = (s: string) => {
    const st = (s || "").toLowerCase()
    return st === "success" || st === "settlement" || st === "paid"
  }
  const isPendingStatus = (s: string) => {
    const st = (s || "").toLowerCase()
    return st === "pending" || st === "draft" || st === "unpaid"
  }
  const isCancelledStatus = (s: string) => {
    const st = (s || "").toLowerCase()
    return st === "cancel" || st === "cancelled" || st === "expire" || st === "expired" || st === "deny" || st === "failed"
  }

  // Summary Metrics
  const historyMetrics = useMemo(() => {
    const total = transactions.length
    const paidList = transactions.filter(t => isPaidStatus(t.status))
    const pendingList = transactions.filter(t => isPendingStatus(t.status))
    const cancelledList = transactions.filter(t => isCancelledStatus(t.status))
    const totalPaidAmount = paidList.reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

    return {
      total,
      paidCount: paidList.length,
      pendingCount: pendingList.length,
      cancelledCount: cancelledList.length,
      totalPaidAmount
    }
  }, [transactions])

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Status Filter
      if (historyStatusFilter === "paid" && !isPaidStatus(t.status)) return false
      if (historyStatusFilter === "pending" && !isPendingStatus(t.status)) return false
      if (historyStatusFilter === "cancelled" && !isCancelledStatus(t.status)) return false

      // Search Query
      if (debouncedHistorySearch.trim()) {
        const q = debouncedHistorySearch.toLowerCase()
        const orderId = (t.orderId || "").toLowerCase()
        const plan = (t.purchasedLabel || t.subscription?.plan || "").toLowerCase()
        const tenantName = (t.subscription?.tenant?.name || "").toLowerCase()
        return orderId.includes(q) || plan.includes(q) || tenantName.includes(q)
      }

      return true
    })
  }, [transactions, historyStatusFilter, debouncedHistorySearch])

  const handlePayNow = (tx: any) => {
    // `purchasedId` (resolved server-side from rawResponse — see
    // resolvePurchaseLabel) is the real item this pending order was for: an
    // addon id, or the plan slug being bought. Using subscription.plan here
    // instead used to resume ACC-/SUB- orders at whatever plan the
    // subscription CURRENTLY happens to be on (wrong after a later plan
    // change), and had no equivalent at all for ADD- (addon) orders — those
    // fell to the "unrecognized" error below no matter what.
    const purchasedId = tx.purchasedId || tx.subscription?.plan
    if (tx.orderId.startsWith("ACC-")) {
      router.push(`/dashboard/billing/checkout?plan=${purchasedId || "starter"}&type=account&interval=year`)
      return
    }

    // SUB- (plan change), ADD- (addon), AIC- (AI credit pack), and VPS- all
    // resume through the same tenant checkout page — it already resolves
    // any of these generically by id from /subscriptions/plans (see
    // checkout/page.tsx: isAiPack = plan.id?.startsWith("ai_pack_") ||
    // plan.type === "ai_plan"; VPS offerings are included there too). An
    // AI-credit subscription, or an account-scoped VPS purchase, is never
    // tied to one tenant (checkout always creates those with tenantId:
    // null), so any tenant the user owns works just to reach the checkout
    // page from.
    const isAccountScopedOrder = tx.orderId.startsWith("AIC-") || tx.rawResponse?.type === "ai_credits"
      || (tx.orderId.startsWith("VPS-") && !tx.subscription?.tenant)
    const tenantSlug = tx.subscription?.tenant?.slug
      || (isAccountScopedOrder ? (session?.user?.tenants?.[0]?.slug || session?.user?.tenants?.[0]?.id) : null)
    if (!tenantSlug) {
      toast({
        variant: "destructive",
        title: "Tidak Dapat Melanjutkan Pembayaran",
        description: "Jenis transaksi ini tidak dikenali. Silakan hubungi dukungan pelanggan.",
      })
      return
    }
    router.push(`/dashboard/${tenantSlug}/subscriptions/checkout?plan=${purchasedId || "pro"}&interval=year`)
  }

  const handleCheckStatus = async (orderId: string) => {
    setCheckingOrderId(orderId)
    try {
      const result = await checkTransactionStatusAction(orderId)
      if (result.success) {
        const statusLabel = result.status === "success" ? "Berhasil (Lunas)" : result.status === "pending" ? "Menunggu Pembayaran" : result.status
        toast({ title: "Status Transaksi", description: `Status pesanan: ${statusLabel}` })
        setTransactions(prev => prev.map(t => t.orderId === orderId ? { ...t, status: result.status } : t))
        if (result.status === "success") {
          await update?.()
          router.refresh()
        }
      } else {
        toast({ variant: "destructive", title: "Gagal", description: result.error })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Gagal memeriksa status pembayaran" })
    } finally {
      setCheckingOrderId(null)
    }
  }

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
          toast({ title: "Paket Akun Diperbarui", description: "Akun Anda kini berada pada paket Gratis." })
          router.refresh()
        }
      } else {
        router.push(`/dashboard/billing/checkout?plan=${planId}&type=account&interval=year`)
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Gagal memulai proses pembayaran." })
    } finally {
      setUpdatingPlanId(null)
    }
  }

  const handleBuyVps = (offeringId: string) => {
    // No account-level VPS catalog page of its own — reuses the tenant
    // checkout page (any owned tenant works to reach it) with
    // ?scope=account, which checkout/page.tsx reads to send tenantId: null
    // so the resulting VpsInstance is account-scoped, not tied to that
    // tenant (see checkout/page.tsx's isAccountScopedVps).
    const tenantSlug = session?.user?.tenants?.[0]?.slug || session?.user?.tenants?.[0]?.id
    if (!tenantSlug) {
      toast({ variant: "destructive", title: "Tidak Dapat Melanjutkan", description: "Anda perlu memiliki minimal satu workspace untuk membeli VPS." })
      return
    }
    router.push(`/dashboard/${tenantSlug}/subscriptions/checkout?plan=${offeringId}&scope=account`)
  }

  if (status === "loading") {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">Billing & Quota Akun</h2>
        <p className="text-xs text-muted-foreground mt-1">Kelola kapasitas total akun dan langganan workspace.</p>
      </div>

      <Tabs defaultValue="plans" className="w-full">
        <TabsList className={cn(
          "grid w-full p-1 bg-muted/40 border border-border/80 rounded-2xl h-auto gap-1 grid-cols-2 max-w-[400px]"
        )}>
          <TabsTrigger value="plans" className="rounded-xl font-bold text-xs py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground">
            Subscription Plans
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-xl font-bold text-xs py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground">
            Transaction History
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="plans" className="space-y-6 mt-6">
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Workspace Quota Card */}
            <Card className="border border-border/80 bg-card rounded-2xl shadow-xs">
              <CardHeader className="p-5 pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold">Kapasitas Workspace</CardTitle>
                    <CardDescription className="text-xs">Jumlah workspace aktif yang dimiliki akun Anda</CardDescription>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Database className="h-4 w-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-1">
                <div className="flex items-baseline gap-1.5 mt-1">
                  <h3 className="text-2xl lg:text-3xl font-black text-foreground">{usage ? usage.current : activeWorkspacesCount}</h3>
                  <span className="text-xs text-muted-foreground font-semibold">
                    / {usage ? (usage.max === null || usage.max > 9000 ? 'Unlimited' : `${usage.max} Workspace`) : (session?.user?.plan === 'free' ? '1 Workspace' : 'Unlimited')}
                  </span>
                </div>
                <div className="mt-3 w-full bg-muted h-2 rounded-full overflow-hidden">
                  {(!usage && session?.user?.plan === 'free') || (usage && usage.max !== null) ? (
                     <div 
                       className={cn("h-full transition-all rounded-full", (usage && !usage.allowed) ? "bg-destructive" : "bg-primary")} 
                       style={{ width: `${Math.min(((usage?.current || activeWorkspacesCount) / (usage?.max || 1)) * 100, 100)}%` }} 
                     />
                  ) : (
                     <div className="h-full w-full bg-primary rounded-full" />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Account AI Credits Card */}
            <Card className="border border-border/80 bg-card rounded-2xl shadow-xs">
              <CardHeader className="p-5 pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold">Saldo AI Frontend Credits</CardTitle>
                    <CardDescription className="text-xs">Dikelola melalui Workspace Subscriptions</CardDescription>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Zap className="h-4 w-4 fill-amber-500" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-1">
                <div className="flex items-baseline justify-between gap-1.5 mt-1">
                  <div className="flex items-baseline gap-1.5">
                    <h3 className="text-2xl lg:text-3xl font-black text-foreground">{aiUsage ? aiUsage.remaining.toLocaleString() : "50"}</h3>
                    <span className="text-xs text-muted-foreground font-semibold">
                      / {aiUsage?.isUnlimited ? 'Unlimited' : (aiUsage ? `${aiUsage.total.toLocaleString()} Credits` : '50 Credits')}
                    </span>
                  </div>
                  {session?.user?.tenants?.[0] && (
                    <Button asChild size="sm" variant="ghost" className="h-7 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 px-2 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20">
                      <Link href={`/dashboard/${session.user.tenants[0].slug || session.user.tenants[0].id}/subscriptions?tab=ai-plans`}>
                        Beli di Workspace &rarr;
                      </Link>
                    </Button>
                  )}
                </div>
                <div className="mt-3 w-full bg-muted h-2 rounded-full overflow-hidden">
                  {aiUsage && !aiUsage.isUnlimited ? (
                    <div 
                      className="h-full bg-amber-500 transition-all rounded-full"
                      style={{ width: `${Math.max(0, Math.min(100, (aiUsage.remaining / Math.max(1, aiUsage.total)) * 100))}%` }} 
                    />
                  ) : (
                    <div className="h-full w-full bg-amber-500 rounded-full" />
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ── 1. ENTERPRISE LICENSE ──
              scope="user": account-level, same as workspace-manager.tsx's
              /dashboard card — activates via /api/user/license/activate
              (keyed by session.user.id, not a tenant), which unlocks
              enforceUserPlanLimit()'s "workspaces" bypass and the pooled
              storage grant (see plan-enforcement.ts). This used to point at
              the GLOBAL tenant's status instead (read-only, activate button
              hidden) — that POST always 403'd "You are not a member of this
              workspace" since the global tenant deliberately has no real
              members, so the button was dropped rather than fixed. Now that
              activation is account-scoped, not tenant-scoped, there's
              nothing left to 403 against; shown here too (not just
              /dashboard) since this is also an account-level page and a
              billing page is a natural place to redeem/upgrade a license. */}
          <div>
            <h3 className="text-xl font-bold mb-4">Enterprise License</h3>
            {session?.user?.id && (
              <EnterpriseLicenseBanner scope="user" />
            )}
          </div>

          {/* ── 2. ACCOUNT PLANS (YEARLY PRICING) ──
              Hidden entirely when an account-level Enterprise License is
              active: that license already grants unlimited workspaces and
              a pooled storage pool (see EnterpriseLicenseBanner above), so
              "buy more workspace quota" plans don't apply to this account. */}
          {!isAccountEnterpriseLicensed && (
          <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold tracking-tight text-foreground">Paket Akun (Langganan Tahunan)</h3>
                  <p className="text-xs text-muted-foreground">Tingkatkan kapasitas total workspace akun Anda.</p>
                </div>
                <Badge className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                  Billing Tahunan (Hemat 2 Bulan)
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {accountPlans.map((plan) => {
                  const isActive = session?.user?.plan === plan.id
                  return (
                    <Card 
                      key={plan.id} 
                      className={cn(
                        "flex flex-col relative rounded-2xl transition-all duration-200 border bg-card shadow-xs hover:shadow-md", 
                        isActive 
                          ? "border-primary ring-2 ring-primary/20 bg-primary/[0.02]" 
                          : plan.popular
                          ? "border-primary/50 hover:border-primary"
                          : "border-border hover:border-muted-foreground/40"
                      )}
                    >
                      {isActive ? (
                        <div className="absolute top-3.5 right-3.5 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                          <CheckCircle2 className="h-3 w-3 stroke-[3]" /> Aktif
                        </div>
                      ) : plan.popular ? (
                        <div className="absolute top-3.5 right-3.5 bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Populer
                        </div>
                      ) : null}

                      <CardHeader className="p-4 pb-2 space-y-2">
                        <div>
                          <CardTitle className="text-base font-bold text-foreground">{plan.name}</CardTitle>
                          {plan.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{plan.description}</p>
                          )}
                        </div>

                        <div className="pt-1">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-foreground">{plan.price}</span>
                            <span className="text-xs font-semibold text-muted-foreground">/tahun</span>
                          </div>
                          {plan.monthlyPrice && plan.priceAmount > 0 && (
                            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                              Setara {plan.monthlyPrice}/bln
                            </p>
                          )}
                        </div>

                        <div className="p-2 rounded-xl bg-muted/40 border border-border/60 text-[11px] font-semibold text-foreground flex items-center justify-between">
                          <span className="text-muted-foreground">Kapasitas:</span>
                          <span className="font-bold">{plan.workspaces === "Unlimited" ? "Unlimited Workspaces" : `Maks ${plan.workspaces} Workspace`}</span>
                        </div>
                      </CardHeader>

                      <CardContent className="p-4 pt-1 flex flex-col justify-between flex-1 space-y-4">
                        <div className="space-y-1.5">
                          {plan.features.map((f: string, i: number) => (
                            <div key={i} className="flex items-start text-xs text-foreground/80 leading-snug">
                              <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /> 
                              <span>{f}</span>
                            </div>
                          ))}
                        </div>

                        <Button 
                          variant={isActive ? "outline" : "default"} 
                          disabled={isActive || updatingPlanId === plan.id}
                          onClick={() => handleUpdateUserPlan(plan.id)}
                          className={cn(
                            "w-full h-9 font-bold rounded-xl text-xs transition-all shadow-xs",
                            isActive 
                              ? "bg-primary/10 text-primary cursor-default border border-primary/30 hover:bg-primary/10" 
                              : "bg-primary hover:bg-primary/90 text-primary-foreground"
                          )}
                        >
                          {updatingPlanId === plan.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
                          {isActive ? "Paket Aktif" : (plan.id === "free" ? "Gunakan Paket Gratis" : `Pilih ${plan.name}`)}
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
          </section>
          )}

          {/* ── 3. VPS (BIZNET GIO) — ACCOUNT-SHARED INFRASTRUCTURE ──
              A VPS bought here is account-scoped (tenantId: null on its
              VpsInstance row), meant as shared infrastructure every
              workspace this account owns can use. A workspace that wants
              its OWN dedicated VPS instead buys one from its own
              Storage tab (/dashboard/[tenant]/subscriptions?tab=storage). */}
          {initialVpsOfferings && initialVpsOfferings.length > 0 && (
          <section className="space-y-3">
            <div>
              <h3 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" /> Virtual Private Server (VPS)
              </h3>
              <p className="text-xs text-muted-foreground">Infrastruktur bersama untuk seluruh workspace akun Anda — disiapkan otomatis setelah pembayaran berhasil.</p>
            </div>

            <VpsStatusList scope="account" />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {initialVpsOfferings.map((offering) => (
                <Card key={offering.id} className="border border-border/80 bg-card rounded-2xl shadow-xs flex flex-col">
                  <CardHeader className="p-5 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold">{offering.name}</CardTitle>
                      <div className="w-8 h-8 rounded-lg border border-primary/20 bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Server className="h-4 w-4" />
                      </div>
                    </div>
                    <CardDescription className="text-xs">
                      {offering.description || `${offering.cpuCores} vCPU · ${(offering.memoryMb / 1024).toFixed(1)} GB RAM · ${offering.diskGb} GB SSD · ${offering.osLabel}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 pt-1 flex flex-col flex-1 justify-between gap-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-black text-foreground">
                        {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(offering.priceMonthlyIdr)}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-semibold">/bulan</span>
                    </div>
                    <Button size="sm" className="w-full h-9 font-bold rounded-xl text-xs" onClick={() => handleBuyVps(offering.id)}>
                      Sewa VPS Ini
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6 space-y-6">

            {/* Header & Metrics Summary */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Riwayat Transaksi & Invoice
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Riwayat pembayaran akun, invoice, dan add-on AI booster.
                </p>
              </div>
            </div>

            {/* Metrics Overview Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Paid Summary */}
              <Card className="border border-border/80 shadow-xs rounded-2xl bg-card overflow-hidden">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Transaksi Lunas</p>
                    <p className="text-xl font-black text-foreground tracking-tight">
                      Rp {historyMetrics.totalPaidAmount.toLocaleString("id-ID")}
                    </p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {historyMetrics.paidCount} Pembayaran Berhasil
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              {/* Pending Summary */}
              <Card className="border border-border/80 shadow-xs rounded-2xl bg-card overflow-hidden">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Menunggu Pembayaran</p>
                    <p className="text-xl font-black text-foreground tracking-tight">
                      {historyMetrics.pendingCount} <span className="text-xs font-normal text-muted-foreground">Tagihan</span>
                    </p>
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {historyMetrics.pendingCount > 0 ? "Menunggu proses transfer" : "Tidak ada tagihan tertunda"}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Clock className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

              {/* Cancelled Summary */}
              <Card className="border border-border/80 shadow-xs rounded-2xl bg-card overflow-hidden">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Dibatalkan / Expired</p>
                    <p className="text-xl font-black text-foreground tracking-tight">
                      {historyMetrics.cancelledCount} <span className="text-xs font-normal text-muted-foreground">Transaksi</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <XCircle className="h-3 w-3 text-rose-500" />
                      Kadaluarsa atau Dibatalkan
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <XCircle className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              
              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl border border-border/60 overflow-x-auto text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all text-xs font-bold whitespace-nowrap",
                    historyStatusFilter === "all" 
                      ? "bg-background text-foreground shadow-xs" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Semua ({historyMetrics.total})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter("paid")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all text-xs font-bold whitespace-nowrap flex items-center gap-1.5",
                    historyStatusFilter === "paid" 
                      ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Lunas ({historyMetrics.paidCount})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter("pending")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all text-xs font-bold whitespace-nowrap flex items-center gap-1.5",
                    historyStatusFilter === "pending" 
                      ? "bg-background text-amber-600 dark:text-amber-400 shadow-xs" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Menunggu ({historyMetrics.pendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter("cancelled")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all text-xs font-bold whitespace-nowrap flex items-center gap-1.5",
                    historyStatusFilter === "cancelled" 
                      ? "bg-background text-rose-600 dark:text-rose-400 shadow-xs" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Dibatalkan ({historyMetrics.cancelledCount})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Cari Order ID / Paket..." 
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="pl-8 h-9 text-xs rounded-xl border-border/80 bg-background shadow-xs"
                />
              </div>

            </div>

            {/* Invoices List / Table */}
            <Card className="border border-border/80 shadow-xs rounded-2xl bg-card overflow-hidden">
              <CardContent className="p-0">
                {filteredTransactions.length === 0 ? (
                  <div className="text-center py-16 px-4 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                      <Receipt className="h-6 w-6 opacity-60" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground text-sm">Tidak ada transaksi ditemukan</p>
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-sm mx-auto">
                        {historySearchQuery ? "Tidak ada riwayat transaksi yang cocok dengan pencarian Anda." : "Belum ada transaksi pada akun ini."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {filteredTransactions.map((tx) => {
                      const isPaid = isPaidStatus(tx.status)
                      const isPending = isPendingStatus(tx.status)
                      const isCancelled = isCancelledStatus(tx.status)

                      // Determine title — purchasedLabel is resolved server-side
                      // from the transaction's rawResponse (see
                      // resolvePurchaseLabel), not from subscription.plan, so an
                      // addon/storage purchase shows its real name instead of
                      // always falling back to a generic subscription label.
                      let itemTitle = tx.purchasedLabel || "Langganan Paket SaCMS Cloud"
                      if (tx.orderId.startsWith("ACC-") && !tx.purchasedLabel) {
                        const rawPlan = tx.subscription?.plan || "Starter"
                        itemTitle = `Paket Akun SaaS (${rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1)})`
                      } else if (tx.orderId.startsWith("SUB-") && !tx.purchasedLabel) {
                        const wsName = tx.subscription?.tenant?.name || "Workspace"
                        const rawPlan = tx.subscription?.plan || "Pro"
                        itemTitle = `Workspace ${wsName} (${rawPlan.toUpperCase()})`
                      }

                      return (
                        <div 
                          key={tx.id} 
                          className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
                        >
                          {/* Order Info & Service */}
                          <div className="flex items-start gap-3.5">
                            <div className={cn(
                              "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs mt-0.5",
                              isPaid 
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                                : isPending 
                                ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400" 
                                : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                            )}>
                              {isPaid ? <CheckCircle2 className="h-5 w-5" /> : isPending ? <Clock className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-foreground">
                                  #{tx.orderId}
                                </span>
                                <Badge 
                                  variant="outline" 
                                  className="text-[10px] font-mono py-0 px-2 rounded-md bg-muted/60 border-border/80 text-muted-foreground font-medium"
                                >
                                  {tx.paymentType || tx.paymentMethod || "Midtrans Snap"}
                                </Badge>
                              </div>

                              <p className="text-xs font-semibold text-foreground">
                                {itemTitle}
                              </p>

                              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" />
                                {new Date(tx.createdAt).toLocaleDateString("id-ID", {
                                  day: "numeric", 
                                  month: "short", 
                                  year: "numeric", 
                                  hour: "2-digit", 
                                  minute: "2-digit"
                                })}
                              </p>
                            </div>
                          </div>

                          {/* Amount, Status Badge & Actions */}
                          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between md:justify-end gap-3.5 pt-2 md:pt-0 border-t md:border-t-0 border-border/60">
                            
                            {/* Price & Status */}
                            <div className="text-left md:text-right">
                              <p className="font-black text-sm text-foreground">
                                Rp {Number(tx.amount).toLocaleString("id-ID")}
                              </p>
                              <div className="mt-1">
                                {isPaid ? (
                                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-none gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Lunas
                                  </Badge>
                                ) : isPending ? (
                                  <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-none gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    Menunggu Pembayaran
                                  </Badge>
                                ) : (
                                  <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-none gap-1">
                                    <XCircle className="h-3 w-3" />
                                    Dibatalkan
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1.5">
                              
                              {/* Open Detail Modal */}
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedInvoice(tx)
                                  setIsInvoiceModalOpen(true)
                                }}
                                className="h-8 px-2.5 text-xs font-bold rounded-xl border-border/80 gap-1"
                                title="Lihat Detail Invoice"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Lihat</span>
                              </Button>

                              {/* Download PDF directly */}
                              <Button 
                                variant="outline" 
                                size="icon"
                                className="h-8 w-8 rounded-xl border-border/80 hover:bg-muted text-foreground shadow-2xs"
                                title="Unduh PDF Invoice"
                                onClick={() => generateInvoicePDF({
                                  orderId: tx.orderId,
                                  amount: Number(tx.amount),
                                  status: tx.status,
                                  date: new Date(tx.createdAt).toLocaleDateString("id-ID", {
                                    day: "numeric", month: "short", year: "numeric"
                                  }),
                                  customerName: session?.user?.name || "Customer",
                                  customerEmail: session?.user?.email || "",
                                  description: itemTitle,
                                  paymentMethod: tx.paymentType || tx.paymentMethod || "Midtrans Gateway"
                                })}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>

                              {/* Action if Pending */}
                              {isPending && (
                                <>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    disabled={checkingOrderId === tx.orderId}
                                    onClick={() => handleCheckStatus(tx.orderId)}
                                    className="h-8 px-2.5 text-xs font-bold rounded-xl border-border/80 gap-1"
                                    title="Periksa Status Pembayaran ke Gateway"
                                  >
                                    <RefreshCw className={cn("h-3 w-3", checkingOrderId === tx.orderId && "animate-spin")} />
                                    <span className="hidden lg:inline">Cek Status</span>
                                  </Button>

                                  <Button 
                                    size="sm"
                                    onClick={() => handlePayNow(tx)}
                                    className="h-8 px-3 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1"
                                  >
                                    <CreditCard className="h-3 w-3" />
                                    Bayar
                                  </Button>
                                </>
                              )}

                            </div>

                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {transactionsPage < transactionsTotalPages && !debouncedHistorySearch.trim() && historyStatusFilter === "all" && (
                  <div className="p-4 border-t border-border/60 flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadMoreTransactions}
                      disabled={loadingMoreTx}
                      className="h-9 rounded-xl text-xs font-bold gap-1.5"
                    >
                      {loadingMoreTx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Muat Riwayat Lainnya
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

        </TabsContent>

      </Tabs>

      {/* Interactive Invoice Detail Modal */}
      <InvoiceDetailDialog 
        open={isInvoiceModalOpen}
        onOpenChange={setIsInvoiceModalOpen}
        invoice={selectedInvoice}
        customerName={session?.user?.name || "Pelanggan SaCMS"}
        customerEmail={session?.user?.email || "-"}
        onCheckStatus={handleCheckStatus}
        onPayNow={handlePayNow}
      />
    </div>
  )
}
