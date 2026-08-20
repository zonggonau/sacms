"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Loader2, DollarSign, TrendingUp, Users, RefreshCw,
  Download, CreditCard, ArrowRight, TrendingDown, Clock,
  CheckCircle2, XCircle
} from "lucide-react"
import Link from "next/link"
import { formatRupiah } from "@/lib/utils"

interface Transaction {
  id: string
  orderId: string
  amount: number
  status: string
  paymentType: string | null
  createdAt: string
  subscription?: {
    tenant: {
      name: string
      slug: string
    }
  } | null
}

interface BillingStats {
  overview: {
    totalRevenue: number
    monthlyRevenue: number
    mrr: number
  }
  subscriptions: {
    active: number
  }
  payments: {
    recent: Transaction[]
  }
  growth: {
    revenueGrowth: number
  }
}

export default function AdminBillingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<BillingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/billing/stats")
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Failed to fetch billing stats:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === "super_admin") {
      fetchStats()
    }
  }, [session?.user?.id, session?.user?.role])

  const handleGenerateInvoices = async () => {
    if (!confirm("Apakah Anda yakin ingin menjalankan siklus billing dan menghasilkan faktur untuk semua langganan aktif?")) return
    setGenerating(true)
    try {
      const res = await fetch("/api/admin/billing/generate-invoices", {
        method: "POST",
      })
      if (res.ok) {
        alert("Faktur tagihan berhasil diproses!")
        fetchStats()
      } else {
        const err = await res.json()
        alert(`Error: ${err.error || "Gagal memproses faktur tagihan"}`)
      }
    } catch (error) {
      console.error("Failed to generate invoices:", error)
      alert("Gagal memproses faktur tagihan")
    } finally {
      setGenerating(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex flex-1 flex-col w-full">
        <div className="flex-1 min-h-[80vh] flex items-center justify-center flex-col w-full bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (session?.user?.role !== "super_admin") {
    router.push("/dashboard")
    return null
  }

  const growth = stats?.growth.revenueGrowth || 0

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">Billing & Pendapatan</h1>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold rounded-full">
                  Keuangan Platform
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ringkasan pendapatan platform, MRR, dan manajemen langganan tenant workspace.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <Button 
                variant="outline" 
                onClick={handleGenerateInvoices} 
                disabled={generating}
                className="rounded-xl h-9 text-xs font-bold shadow-xs border-border/80"
              >
                {generating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                Jalankan Siklus Tagihan
              </Button>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs" asChild>
                <Link href="/admin/billing/transactions">
                  Lihat Transaksi
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-5">
                <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pendapatan Bulanan</CardTitle>
                <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="text-2xl font-black text-foreground tracking-tight">{formatRupiah(stats?.overview.monthlyRevenue || 0)}</div>
                <div className="flex items-center mt-1">
                  {growth >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-rose-500 mr-1" />
                  )}
                  <span className={`text-xs font-bold ${growth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {Math.abs(growth)}%
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-1">vs bulan lalu</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-5">
                <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">MRR Berjalan</CardTitle>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <DollarSign className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="text-2xl font-black text-foreground tracking-tight">{formatRupiah(stats?.overview.mrr || 0)}</div>
                <p className="text-[10px] text-muted-foreground mt-1 font-medium">Estimasi pendapatan berulang</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-5">
                <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Langganan Aktif</CardTitle>
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="text-2xl font-black text-foreground tracking-tight">{stats?.subscriptions.active || 0}</div>
                <p className="text-[10px] text-muted-foreground mt-1 font-medium">Workspace berbayar</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-5">
                <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Pendapatan</CardTitle>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <CreditCard className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="text-2xl font-black text-foreground tracking-tight">{formatRupiah(stats?.overview.totalRevenue || 0)}</div>
                <p className="text-[10px] text-muted-foreground mt-1 font-medium">Total pendapatan sepanjang masa</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Recent Transactions */}
            <Card className="lg:col-span-2 rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between p-5 pb-4 border-b border-border/60 bg-muted/20">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">Transaksi Pembayaran Terbaru</CardTitle>
                  <CardDescription className="text-[11px] text-muted-foreground mt-0.5">Pembayaran terkini yang diproses via gateway Midtrans</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs font-bold text-primary hover:text-primary/80 px-2 rounded-lg" asChild>
                  <Link href="/admin/billing/transactions">
                    Lihat Semua <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {(!stats?.payments.recent || stats.payments.recent.length === 0) ? (
                  <div className="text-center py-14 text-muted-foreground">
                    <Clock className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p className="text-xs font-bold text-foreground">Belum ada riwayat transaksi</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {stats.payments.recent.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-4 px-5 hover:bg-muted/20 transition-colors">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                            tx.status === "success" || tx.status === "settlement" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                            tx.status === "pending" ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400" :
                            "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                          }`}>
                            {tx.status === "success" || tx.status === "settlement" ? <CheckCircle2 className="h-4 w-4" /> : 
                             tx.status === "pending" ? <Clock className="h-4 w-4" /> : 
                             <XCircle className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">
                              {tx.subscription?.tenant?.name || "Pembayaran Sistem"}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                              ID: {tx.orderId} &middot; {tx.paymentType || 'midtrans'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-black text-foreground font-mono">{formatRupiah(tx.amount)}</p>
                          <Badge className={`text-[9px] font-bold px-2 py-0 mt-0.5 rounded-full border shadow-none ${
                            tx.status === "success" || tx.status === "settlement" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
                            tx.status === "pending" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
                            "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                          }`}>
                            {tx.status === "success" || tx.status === "settlement" ? "Sukses" : tx.status === "pending" ? "Menunggu" : "Gagal"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions & Notes */}
            <Card className="rounded-2xl border border-border/80 shadow-xs bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Integrasi Midtrans</h3>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Sistem pembayaran menggunakan integrasi webhook otomatis Midtrans Snap untuk verifikasi QRIS, Virtual Account, dan Kartu Kredit secara instan.
              </p>
              <div className="pt-2 border-t border-border/60">
                <Button variant="outline" className="w-full rounded-xl text-xs font-bold h-9 shadow-xs" asChild>
                  <Link href="/admin/billing/transactions">
                    Lihat Semua Transaksi
                  </Link>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
