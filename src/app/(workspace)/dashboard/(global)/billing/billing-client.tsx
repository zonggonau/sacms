"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Loader2, Zap, CreditCard, CheckCircle2, ShieldCheck, Crown, Receipt, Clock, RefreshCw, Database, Download, Cloud, Save, Sparkles
} from "lucide-react"
import { getTransactionHistoryAction, checkTransactionStatusAction } from "@/actions/billing"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { EnterpriseLicenseBanner } from "@/components/dashboard/enterprise-license-banner"
import { generateInvoicePDF } from "@/lib/pdf-generator"

export default function BillingClient({
  initialAccountPlans,
  initialAiCreditPacks,
  initialActiveWorkspacesCount,
  initialUsage,
  initialAiCreditUsage,
  initialTransactions,
  isEnterpriseMode,
  initialMasterInfra
}: {
  initialAccountPlans: any[]
  initialAiCreditPacks?: any[]
  initialActiveWorkspacesCount: number
  initialUsage: any
  initialAiCreditUsage?: { used: number, total: number, remaining: number, isUnlimited: boolean }
  initialTransactions: any[]
  isEnterpriseMode?: boolean
  initialMasterInfra?: { databaseUrl: string, storageConfig: any }
}) {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  
  const [accountPlans, setAccountPlans] = useState<any[]>(initialAccountPlans)
  const [aiCreditPacks, setAiCreditPacks] = useState<any[]>(initialAiCreditPacks || [])
  const [updatingPlanId, setUpdatingPlanId] = useState<string | null>(null)
  const [activeWorkspacesCount, setActiveWorkspacesCount] = useState(initialActiveWorkspacesCount)
  const [usage, setUsage] = useState<{current: number, max: number | null, allowed: boolean, plan: string} | null>(initialUsage)
  const [aiUsage, setAiUsage] = useState(initialAiCreditUsage || null)
  const [transactions, setTransactions] = useState<any[]>(initialTransactions)
  const [checkingOrderId, setCheckingOrderId] = useState<string | null>(null)

  const [infra, setInfra] = useState({
    databaseUrl: initialMasterInfra?.databaseUrl || "",
    s3Bucket: initialMasterInfra?.storageConfig?.bucket || "",
    s3Region: initialMasterInfra?.storageConfig?.region || "",
    s3AccessKey: initialMasterInfra?.storageConfig?.accessKeyId || "",
    s3SecretKey: initialMasterInfra?.storageConfig?.secretAccessKey || "",
  })
  const [savingInfra, setSavingInfra] = useState(false)

  const handleCheckStatus = async (orderId: string) => {
    setCheckingOrderId(orderId)
    try {
      const result = await checkTransactionStatusAction(orderId)
      if (result.success) {
        toast({ title: "Status Updated", description: `Transaction status is now ${result.status}` })
        setTransactions(prev => prev.map(t => t.orderId === orderId ? { ...t, status: result.status } : t))
        if (result.status === "success") {
          await update()
          router.refresh()
        }
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to check status" })
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
          toast({ title: "Account Plan Updated", description: "You are now on the Free plan." })
          router.refresh()
        }
      } else {
        router.push(`/dashboard/billing/checkout?plan=${planId}&type=account&interval=year`)
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to initiate checkout." })
    } finally {
      setUpdatingPlanId(null)
    }
  }

  const handleBuyAiCredits = (packId: string) => {
    router.push(`/dashboard/billing/checkout?plan=${packId}&type=ai_credits`)
  }

  const handleSaveInfra = async () => {
    setSavingInfra(true)
    try {
      const res = await fetch("/api/admin/infra", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(infra)
      })
      if (res.ok) {
        toast({ title: "Infrastructure Saved", description: "Database & Storage endpoints have been successfully updated." })
      } else {
        const error = await res.json()
        toast({ variant: "destructive", title: "Error", description: error.error || "Failed to save settings" })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save infrastructure settings." })
    } finally {
      setSavingInfra(false)
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
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">Billing & Quota Akun</h2>
        <p className="text-xs text-muted-foreground mt-1">Kelola kapasitas workspace akun Anda dan isi ulang kuota AI Frontend builder.</p>
      </div>

      <Tabs defaultValue="plans" className="w-full">
        <TabsList className={cn("grid w-full", isEnterpriseMode ? "grid-cols-2 max-w-[400px]" : "grid-cols-2 max-w-[400px]")}>
          <TabsTrigger value="plans">Subscription Plans</TabsTrigger>
          {!isEnterpriseMode && <TabsTrigger value="history">Transaction History</TabsTrigger>}
          {isEnterpriseMode && <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>}
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
                    <CardDescription className="text-xs">Kuota pembuatan schema, UI builder & iterasi frontend</CardDescription>
                  </div>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <Zap className="h-4 w-4 fill-amber-500" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-1">
                <div className="flex items-baseline gap-1.5 mt-1">
                  <h3 className="text-2xl lg:text-3xl font-black text-foreground">{aiUsage ? aiUsage.remaining.toLocaleString() : "50"}</h3>
                  <span className="text-xs text-muted-foreground font-semibold">
                    / {aiUsage?.isUnlimited ? 'Unlimited' : (aiUsage ? `${aiUsage.total.toLocaleString()} Credits` : '50 Credits')}
                  </span>
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

          {/* ── 1. ACCOUNT PLANS (YEARLY PRICING) ── */}
          {!isEnterpriseMode && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold tracking-tight text-foreground">Paket Akun (Langganan Tahunan)</h3>
                  <p className="text-xs text-muted-foreground">Tingkatkan kapasitas total workspace yang dapat dibuat oleh akun Anda.</p>
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

          {/* ── 2. AI PLAN CREDIT PACKS (DIBAWAH AKUN PLAN) ── */}
          <section className="space-y-3 pt-2 border-t border-border/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <h3 className="text-base font-bold tracking-tight text-foreground">AI Plan (Frontend Builder Credits)</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Paket credit AI sekali pakai (never expire) untuk generate Next.js frontend, schema, dan iterasi di semua workspace.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full text-amber-600 dark:text-amber-400 shrink-0 font-medium">
                <Zap className="h-3.5 w-3.5 fill-amber-500" />
                <span>Saldo Anda: <strong>{aiUsage ? aiUsage.remaining.toLocaleString() : "50"} Credits</strong></span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {aiCreditPacks.map((pack) => {
                return (
                  <Card 
                    key={pack.id} 
                    className={cn(
                      "flex flex-col relative rounded-2xl transition-all duration-200 border bg-card shadow-xs hover:shadow-md", 
                      pack.badge 
                        ? "border-amber-500/40 ring-1 ring-amber-500/20" 
                        : "border-border hover:border-amber-500/40"
                    )}
                  >
                    {pack.badge && (
                      <div className="absolute top-3.5 right-3.5 bg-amber-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                        {pack.badge}
                      </div>
                    )}
                    <CardHeader className="p-4 pb-2 space-y-2">
                      <div className="flex items-center gap-1.5 text-amber-500">
                        <Zap className="h-3.5 w-3.5 fill-amber-500" />
                        <span className="text-xs font-bold uppercase tracking-wider">{pack.name}</span>
                      </div>
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-foreground">Rp {pack.price_idr.toLocaleString('id-ID')}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                          ${pack.price_usd} USD • Sekali Beli
                        </p>
                      </div>
                      <div className="pt-1">
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px] font-bold rounded-lg px-2 py-0.5">
                          +{pack.credits.toLocaleString()} AI Credits
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-1 flex flex-col justify-between flex-1 space-y-4">
                      <div className="space-y-1.5 pt-2 border-t border-border/60">
                        {pack.features?.map((f: string, i: number) => (
                          <div key={i} className="flex items-start text-xs text-foreground/80 leading-snug">
                            <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" /> 
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                      <Button 
                        onClick={() => handleBuyAiCredits(pack.id)}
                        className="w-full h-9 font-bold rounded-xl text-xs bg-amber-500 hover:bg-amber-600 text-black shadow-xs transition-all"
                      >
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                        Top Up {pack.name.split(" ")[0]}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <div className="p-3.5 bg-muted/40 border border-border/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground">
              <div>
                <strong className="text-foreground">Biaya AI:</strong> 25 Cr / Full Next.js Frontend Gen • 5 Cr / Chat Iterasi • 5 Cr / Schema Auto-Gen
              </div>
              <div className="text-muted-foreground text-[11px]">
                *Credit tidak memiliki masa kedaluwarsa dan dapat digunakan kapan saja.
              </div>
            </div>
          </section>

          {/* ── 3. ENTERPRISE LICENSE ── */}
          <div className="mt-6">
            <h3 className="text-xl font-bold mb-4">Enterprise License</h3>
            {session?.user?.id && (
              <EnterpriseLicenseBanner tenantId={session.user.id} hideActivation={false} />
            )}
          </div>
        </TabsContent>

        {!isEnterpriseMode && (
          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>View your past payments and invoices.</CardDescription>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No transactions found.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg gap-4">
                        <div>
                          <p className="font-medium text-sm break-all">{tx.orderId}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(tx.createdAt).toLocaleDateString("id-ID", {
                              day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-bold">Rp {tx.amount.toLocaleString("id-ID")}</p>
                            <Badge 
                              variant={tx.status === 'success' ? 'default' : tx.status === 'failed' ? 'destructive' : 'secondary'}
                              className="mt-1 capitalize"
                            >
                              {tx.status}
                            </Badge>
                          </div>
                          {tx.status === 'pending' && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              disabled={checkingOrderId === tx.orderId}
                              onClick={() => handleCheckStatus(tx.orderId)}
                            >
                              {checkingOrderId === tx.orderId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check Status"}
                            </Button>
                          )}
                          <Button 
                            variant="secondary" 
                            size="icon"
                            title="Download Invoice"
                            onClick={() => generateInvoicePDF({
                              orderId: tx.orderId,
                              amount: tx.amount,
                              status: tx.status,
                              date: new Date(tx.createdAt).toLocaleDateString("id-ID", {
                                day: "numeric", month: "short", year: "numeric"
                              }),
                              customerName: session?.user?.name || "Customer",
                              customerEmail: session?.user?.email || "",
                            })}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isEnterpriseMode && (
          <TabsContent value="infrastructure" className="mt-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold">Master Infrastructure Override</h3>
                <p className="text-sm text-muted-foreground">
                  Configure default database and S3 credentials for all new workspaces created under this account.
                </p>
              </div>
              <Button onClick={handleSaveInfra} disabled={savingInfra}>
                {savingInfra ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Settings
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <Card className="border-none shadow-sm">
                <CardHeader className="pb-4 border-b bg-muted/20">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    Master Database Override
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-2">
                    <Label htmlFor="masterDatabaseUrl">PostgreSQL Connection URL</Label>
                    <Input 
                      id="masterDatabaseUrl" 
                      value={infra.databaseUrl} 
                      onChange={(e) => setInfra({ ...infra, databaseUrl: e.target.value })}
                      placeholder="postgresql://user:password@host:port/database"
                      type="password"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader className="pb-4 border-b bg-muted/20">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Cloud className="h-4 w-4 text-primary" />
                    Master S3 Storage Override
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="masterS3Bucket">Bucket Name</Label>
                      <Input 
                        id="masterS3Bucket" 
                        value={infra.s3Bucket} 
                        onChange={(e) => setInfra({ ...infra, s3Bucket: e.target.value })}
                        placeholder="my-enterprise-bucket"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="masterS3Region">Region</Label>
                      <Input 
                        id="masterS3Region" 
                        value={infra.s3Region} 
                        onChange={(e) => setInfra({ ...infra, s3Region: e.target.value })}
                        placeholder="ap-southeast-1 (or auto for R2)"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="masterS3AccessKey">Access Key ID</Label>
                      <Input 
                        id="masterS3AccessKey" 
                        value={infra.s3AccessKey} 
                        onChange={(e) => setInfra({ ...infra, s3AccessKey: e.target.value })}
                        type="password"
                        placeholder="Enter access key"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="masterS3SecretKey">Secret Access Key</Label>
                      <Input 
                        id="masterS3SecretKey" 
                        value={infra.s3SecretKey} 
                        onChange={(e) => setInfra({ ...infra, s3SecretKey: e.target.value })}
                        type="password"
                        placeholder="Enter secret key"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
