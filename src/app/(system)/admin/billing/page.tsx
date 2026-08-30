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
  CheckCircle2, XCircle, PieChart, ShieldCheck, Server, Layers,
  Receipt, ArrowUpRight
} from "lucide-react"
import Link from "next/link"
import { formatRupiah } from "@/lib/utils"

export default function AdminBillingOverviewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/billing/reports")
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (error) {
      console.error("Failed to fetch billing reports:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === "super_admin" || session?.user?.role === "admin") {
      fetchReports()
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
        fetchReports()
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
      <div className="flex flex-1 min-h-[80vh] items-center justify-center flex-col w-full bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground mt-3 font-semibold">Memuat Ringkasan Keuangan Platform...</p>
      </div>
    )
  }

  if (session?.user?.role !== "super_admin" && session?.user?.role !== "admin") {
    router.push("/dashboard")
    return null
  }

  const s = data?.summary || {}
  const growth = s.revenueGrowthPercent || 0

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">Ringkasan Eksekutif Keuangan</h1>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold rounded-full">
              P&L & Margin Live
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ikhtisar performa pendapatan, laba kotor (*Gross Margin*), estimasi biaya server COGS, dan arus kas langganan.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button 
            variant="outline" 
            onClick={fetchReports} 
            size="sm"
            className="rounded-xl h-9 text-xs font-bold shadow-xs border-border/80"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh Data
          </Button>
          <Button 
            variant="outline" 
            onClick={handleGenerateInvoices} 
            disabled={generating}
            size="sm"
            className="rounded-xl h-9 text-xs font-bold shadow-xs border-border/80"
          >
            {generating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CreditCard className="mr-1.5 h-3.5 w-3.5" />}
            Siklus Tagihan
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs" asChild>
            <Link href="/admin/billing/laba-rugi">
              Laporan Laba Rugi <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Top Level Metric Cards (4 Pillars) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Monthly Revenue */}
        <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-5">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pendapatan Bulan Ini</CardTitle>
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-black text-foreground tracking-tight">{formatRupiah(s.thisMonthRevenue || 0)}</div>
            <div className="flex items-center mt-1">
              {growth >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500 mr-1" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-rose-500 mr-1" />
              )}
              <span className={`text-xs font-bold ${growth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {Math.abs(growth)}%
              </span>
              <span className="text-[10px] text-muted-foreground ml-1">vs bulan lalu ({formatRupiah(s.lastMonthRevenue || 0)})</span>
            </div>
          </CardContent>
        </Card>

        {/* 2. MRR (Monthly Recurring Revenue) */}
        <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-5">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">MRR Berjalan</CardTitle>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-black text-foreground tracking-tight">{formatRupiah(s.mrr || 0)}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">ARR Bersih: {formatRupiah(s.arr || 0)} / thn</p>
          </CardContent>
        </Card>

        {/* 3. Estimasi Laba Kotor & Margin */}
        <Card className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-card to-emerald-500/[0.03] shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-5">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Laba Kotor Bulanan (Gross)</CardTitle>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
              {s.grossMarginPercent || 0}%
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">{formatRupiah(s.monthlyGrossProfit || 0)}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">
              Margin Laba: <span className="font-bold text-emerald-600 dark:text-emerald-400">{s.grossMarginPercent}%</span> (COGS: {formatRupiah(s.estimatedMonthlyCogs || 0)})
            </p>
          </CardContent>
        </Card>

        {/* 4. Active Subscriptions */}
        <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-5">
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Workspace Berbayar</CardTitle>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-2xl font-black text-foreground tracking-tight">{s.activeSubCount || 0} Tenant</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Total Akumulasi: {formatRupiah(s.totalLifetimeRevenue || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown & Navigation Cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Category Contribution */}
        <Card className="rounded-2xl border border-border/80 shadow-xs bg-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Kontribusi Lini Produk</h3>
            </div>
            <Button variant="ghost" size="sm" asChild className="h-7 text-xs font-bold text-primary p-0">
              <Link href="/admin/billing/margin-keuntungan">Lihat Semua</Link>
            </Button>
          </div>

          <div className="space-y-3">
            {/* VPS */}
            <div className="p-3 rounded-xl border border-border/70 bg-muted/20 space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="flex items-center gap-1.5 text-foreground">
                  <Server className="h-3.5 w-3.5 text-primary" /> Dedicated Cloud VPS
                </span>
                <span className="text-foreground">{formatRupiah(data?.categoryStats?.vps?.mrr || 0)}/bln</span>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{data?.categoryStats?.vps?.count || 0} Server Aktif</span>
                <span className="text-emerald-600 font-bold">Laba: {formatRupiah(data?.categoryStats?.vps?.profit || 0)}</span>
              </div>
            </div>

            {/* VDS */}
            <div className="p-3 rounded-xl border border-border/70 bg-muted/20 space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="flex items-center gap-1.5 text-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-500" /> Gov & Enterprise VDS
                </span>
                <span className="text-foreground">{formatRupiah(data?.categoryStats?.vds?.mrr || 0)}/bln</span>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{data?.categoryStats?.vds?.count || 0} Core Fisik Lock</span>
                <span className="text-emerald-600 font-bold">Laba: {formatRupiah(data?.categoryStats?.vds?.profit || 0)}</span>
              </div>
            </div>

            {/* Cloud Shared */}
            <div className="p-3 rounded-xl border border-border/70 bg-muted/20 space-y-1.5">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="flex items-center gap-1.5 text-foreground">
                  <Layers className="h-3.5 w-3.5 text-blue-500" /> Cloud Shared SaaS
                </span>
                <span className="text-foreground">{formatRupiah(data?.categoryStats?.cloud?.mrr || 0)}/bln</span>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{data?.categoryStats?.cloud?.count || 0} Tenant Pro/Biz</span>
                <span className="text-emerald-600 font-bold">Laba: {formatRupiah(data?.categoryStats?.cloud?.profit || 0)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Report Access Cards */}
        <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
          {/* Laba Rugi Link */}
          <Link href="/admin/billing/laba-rugi" className="group">
            <Card className="rounded-2xl border border-border/80 shadow-xs bg-card p-5 h-full flex flex-col justify-between hover:border-primary/60 transition-all">
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                  Laporan Laba & Rugi (P&L) <ArrowUpRight className="h-4 w-4 opacity-50 group-hover:opacity-100" />
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Laporan finansial lengkap dengan rincian pendapatan kotor, potongan modal server Contabo, biaya gateway Midtrans, dan laba bersih.
                </p>
              </div>
              <span className="text-[11px] font-bold text-primary mt-4 inline-block">Buka Laporan P&L &rarr;</span>
            </Card>
          </Link>

          {/* Margin Keuntungan Link */}
          <Link href="/admin/billing/margin-keuntungan" className="group">
            <Card className="rounded-2xl border border-border/80 shadow-xs bg-card p-5 h-full flex flex-col justify-between hover:border-primary/60 transition-all">
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <PieChart className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                  Katalog Margin Paket <ArrowUpRight className="h-4 w-4 opacity-50 group-hover:opacity-100" />
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Tabel unit economics seluruh paket VPS (12jt-39.5jt) & VDS (50jt-150jt) lengkap dengan kalkulasi modal EUR vs kurs IDR.
                </p>
              </div>
              <span className="text-[11px] font-bold text-primary mt-4 inline-block">Buka Katalog Margin &rarr;</span>
            </Card>
          </Link>

          {/* Tenant Unit Economics Link */}
          <Link href="/admin/billing/tenant-economics" className="group">
            <Card className="rounded-2xl border border-border/80 shadow-xs bg-card p-5 h-full flex flex-col justify-between hover:border-primary/60 transition-all">
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                  Unit Economics per Tenant <ArrowUpRight className="h-4 w-4 opacity-50 group-hover:opacity-100" />
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Pantau margin profit dan efisiensi biaya server untuk setiap workspace aktif untuk menghindari resource hogging.
                </p>
              </div>
              <span className="text-[11px] font-bold text-primary mt-4 inline-block">Buka Laporan Tenant &rarr;</span>
            </Card>
          </Link>

          {/* Riwayat Transaksi Link */}
          <Link href="/admin/billing/transactions" className="group">
            <Card className="rounded-2xl border border-border/80 shadow-xs bg-card p-5 h-full flex flex-col justify-between hover:border-primary/60 transition-all">
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Receipt className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                  Log Transaksi Midtrans <ArrowUpRight className="h-4 w-4 opacity-50 group-hover:opacity-100" />
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Daftar transaksi real-time gateway Midtrans, audit log pembayaran, status settlement faktur, dan ekspor CSV.
                </p>
              </div>
              <span className="text-[11px] font-bold text-primary mt-4 inline-block">Buka Transaksi &rarr;</span>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}
