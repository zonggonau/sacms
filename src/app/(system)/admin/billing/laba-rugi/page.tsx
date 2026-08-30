"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
  Loader2, TrendingUp, TrendingDown, DollarSign, Download,
  RefreshCw, ArrowLeft, ShieldCheck, Server, AlertCircle, FileSpreadsheet
} from "lucide-react"
import Link from "next/link"
import { formatRupiah } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

export default function LabaRugiPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
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
      console.error("Failed to fetch reports:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === "super_admin" || session?.user?.role === "admin") {
      fetchReports()
    }
  }, [session?.user?.id, session?.user?.role])

  const exportFinancialStatement = () => {
    if (!data) return
    const s = data.summary
    const rows = [
      ["KOMPONEN LAPORAN LABA RUGI", "BULANAN (IDR)", "TAHUNAN PROYEKSI (IDR)"],
      ["1. PENDAPATAN KOTOR (GROSS REVENUE)", s.mrr, s.arr],
      ["   - Cloud VPS Dedicated Appliance", data.categoryStats.vps.mrr, data.categoryStats.vps.mrr * 12],
      ["   - Gov & Enterprise VDS", data.categoryStats.vds.mrr, data.categoryStats.vds.mrr * 12],
      ["   - Shared SaaS Cloud", data.categoryStats.cloud.mrr, data.categoryStats.cloud.mrr * 12],
      ["", "", ""],
      ["2. BIAYA POKOK INFRASTRUKTUR (COGS)", s.estimatedMonthlyCogs, s.estimatedYearlyCogs],
      ["   - Dedicated Server Contabo (EUR)", s.estimatedMonthlyCogs, s.estimatedYearlyCogs],
      ["", "", ""],
      ["3. LABA KOTOR (GROSS PROFIT)", s.monthlyGrossProfit, s.yearlyGrossProfit],
      ["   - Gross Profit Margin (%)", `${s.grossMarginPercent}%`, `${s.grossMarginPercent}%`],
      ["", "", ""],
      ["4. BIAYA PEMBAYARAN GATEWAY (MIDTRANS EST 1.5%)", Math.round(s.mrr * 0.015), Math.round(s.arr * 0.015)],
      ["", "", ""],
      ["5. LABA BERSIH OPERASIONAL (NET PROFIT)", s.monthlyNetProfit, s.yearlyNetProfit],
      ["   - Net Profit Margin (%)", `${s.netMarginPercent}%`, `${s.netMarginPercent}%`],
    ]

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `laporan_laba_rugi_sacms_${new Date().toISOString().split("T")[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast({ title: "Laporan Berhasil Diunduh", description: "File CSV Laporan Laba Rugi telah tersimpan" })
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex flex-1 min-h-[80vh] items-center justify-center flex-col w-full bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground mt-3 font-semibold">Menghitung Laporan Laba Rugi...</p>
      </div>
    )
  }

  const s = data?.summary || {}

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">Laporan Laba & Rugi (Income Statement)</h1>
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold">
              Standard GAAP/PSAK
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Laporan finansial real-time yang memperhitungkan Gross Revenue, Beban Pokok Server (COGS), dan Laba Bersih.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={fetchReports} className="rounded-xl h-9 text-xs font-bold shadow-xs">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
          <Button onClick={exportFinancialStatement} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 rounded-xl shadow-xs">
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Unduh Laporan (CSV)
          </Button>
        </div>
      </div>

      {/* P&L Statement Card */}
      <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
        <CardHeader className="p-5 pb-4 border-b border-border/60 bg-muted/20">
          <CardTitle className="text-sm font-bold text-foreground">Laporan Laba Rugi Komprehensif Platform SaCMS</CardTitle>
          <CardDescription className="text-[11px] text-muted-foreground">
            Kurs Acuan Perhitungan: € 1 = Rp {s.eurExchangeRate?.toLocaleString("id-ID")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-bold text-foreground py-3">Uraian / Akun Finansial</TableHead>
                <TableHead className="text-xs font-bold text-right text-foreground py-3">Bulan Berjalan</TableHead>
                <TableHead className="text-xs font-bold text-right text-foreground py-3">Proyeksi Tahunan</TableHead>
                <TableHead className="text-xs font-bold text-right text-foreground py-3">Rasio Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/60 text-xs">
              {/* Gross Revenue */}
              <TableRow className="bg-muted/10 font-bold">
                <TableCell className="py-3 text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  1. PENDAPATAN KOTOR (GROSS REVENUE / MRR)
                </TableCell>
                <TableCell className="text-right font-mono text-foreground font-black">{formatRupiah(s.mrr || 0)}</TableCell>
                <TableCell className="text-right font-mono text-foreground font-black">{formatRupiah(s.arr || 0)}</TableCell>
                <TableCell className="text-right font-bold text-emerald-600">100.0%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8 text-muted-foreground">- Dedicated Cloud VPS Appliance</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{formatRupiah(data?.categoryStats?.vps?.mrr || 0)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{formatRupiah((data?.categoryStats?.vps?.mrr || 0) * 12)}</TableCell>
                <TableCell className="text-right text-muted-foreground">-</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8 text-muted-foreground">- Gov & Enterprise Dedicated VDS</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{formatRupiah(data?.categoryStats?.vds?.mrr || 0)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{formatRupiah((data?.categoryStats?.vds?.mrr || 0) * 12)}</TableCell>
                <TableCell className="text-right text-muted-foreground">-</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8 text-muted-foreground">- Shared Cloud SaaS (Pro / Business)</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{formatRupiah(data?.categoryStats?.cloud?.mrr || 0)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{formatRupiah((data?.categoryStats?.cloud?.mrr || 0) * 12)}</TableCell>
                <TableCell className="text-right text-muted-foreground">-</TableCell>
              </TableRow>

              {/* COGS */}
              <TableRow className="bg-rose-500/[0.03] font-bold text-rose-600 dark:text-rose-400">
                <TableCell className="py-3 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-rose-500" />
                  2. BEBAN POKOK INFRASTRUKTUR (COGS / SERVER COST)
                </TableCell>
                <TableCell className="text-right font-mono font-black">({formatRupiah(s.estimatedMonthlyCogs || 0)})</TableCell>
                <TableCell className="text-right font-mono font-black">({formatRupiah(s.estimatedYearlyCogs || 0)})</TableCell>
                <TableCell className="text-right font-bold text-rose-600">
                  {s.mrr > 0 ? ((s.estimatedMonthlyCogs / s.mrr) * 100).toFixed(1) : 0}%
                </TableCell>
              </TableRow>

              {/* Gross Profit */}
              <TableRow className="bg-emerald-500/[0.06] font-black text-emerald-700 dark:text-emerald-300 text-sm">
                <TableCell className="py-3.5">
                  3. LABA KOTOR (GROSS PROFIT)
                </TableCell>
                <TableCell className="text-right font-mono">{formatRupiah(s.monthlyGrossProfit || 0)}</TableCell>
                <TableCell className="text-right font-mono">{formatRupiah(s.yearlyGrossProfit || 0)}</TableCell>
                <TableCell className="text-right font-black text-emerald-600 dark:text-emerald-400">
                  {s.grossMarginPercent}%
                </TableCell>
              </TableRow>

              {/* Operating Expenses */}
              <TableRow className="bg-muted/10 font-bold">
                <TableCell className="py-3 text-muted-foreground">
                  4. ESTIMASI BIAYA GATEWAY (MIDTRANS FEE ~1.5%)
                </TableCell>
                <TableCell className="text-right font-mono text-rose-500">
                  ({formatRupiah(Math.round((s.mrr || 0) * 0.015))})
                </TableCell>
                <TableCell className="text-right font-mono text-rose-500">
                  ({formatRupiah(Math.round((s.arr || 0) * 0.015))})
                </TableCell>
                <TableCell className="text-right text-muted-foreground">1.5%</TableCell>
              </TableRow>

              {/* Net Profit */}
              <TableRow className="bg-emerald-500/[0.12] font-black text-emerald-800 dark:text-emerald-200 text-base">
                <TableCell className="py-4">
                  5. LABA BERSIH OPERASIONAL (NET PROFIT)
                </TableCell>
                <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">{formatRupiah(s.monthlyNetProfit || 0)}</TableCell>
                <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">{formatRupiah(s.yearlyNetProfit || 0)}</TableCell>
                <TableCell className="text-right font-black text-emerald-600 dark:text-emerald-400">
                  {s.netMarginPercent}%
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Financial Health Insights */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl border border-border/80 shadow-xs bg-card p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-600">
            <ShieldCheck className="h-5 w-5" />
            <h3 className="text-sm font-bold text-foreground">Analisis Efisiensi Biaya Pokok</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Dengan margin laba kotor sebesar <strong className="text-foreground">{s.grossMarginPercent}%</strong>, SaCMS memiliki bantalan kas yang sangat sehat untuk menopang beban SLA 99.9%, penggantian hardware darurat, dan tim engineering on-call.
          </p>
        </Card>

        <Card className="rounded-2xl border border-border/80 shadow-xs bg-card p-5 space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <AlertCircle className="h-5 w-5" />
            <h3 className="text-sm font-bold text-foreground">Rekomendasi Manajemen Kas</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Disarankan untuk mengalokasikan <strong className="text-foreground">10% - 15% dari Net Profit</strong> ke cadangan kas hedging kurs valuta asing (EUR/USD) untuk mengantisipasi fluktuasi tagihan Contabo & Cloudflare.
          </p>
        </Card>
      </div>
    </div>
  )
}
