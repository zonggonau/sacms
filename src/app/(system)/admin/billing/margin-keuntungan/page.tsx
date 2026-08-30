"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import {
  Loader2, PieChart, Search, Download, RefreshCw,
  Server, ShieldCheck, Layers, FileSpreadsheet, ArrowUpRight
} from "lucide-react"
import { formatRupiah } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

export default function MarginKeuntunganPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")

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
      console.error("Failed to fetch margin reports:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === "super_admin" || session?.user?.role === "admin") {
      fetchReports()
    }
  }, [session?.user?.id, session?.user?.role])

  const catalog = data?.unitEconomicsCatalog || []

  const filteredCatalog = catalog.filter((item: any) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.slug.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const exportMarginCSV = () => {
    if (catalog.length === 0) return
    const headers = ["Nama Paket", "Slug", "Kategori", "Harga Bulanan (IDR)", "Harga Tahunan (IDR)", "Biaya Modal EUR", "Biaya Modal IDR", "Laba Kotor IDR", "Gross Margin %", "Net Margin %"]
    const rows = catalog.map((i: any) => [
      `"${i.name}"`,
      i.slug,
      i.category,
      i.monthlyPrice,
      i.yearlyPrice,
      i.estimatedMonthlyCogsEur,
      i.estimatedMonthlyCogsIdr,
      i.monthlyGrossProfitIdr,
      `${i.grossProfitMarginPercent}%`,
      `${i.netProfitMarginPercent}%`
    ])

    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map((e: any) => e.join(",")).join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `katalog_margin_keuntungan_sacms_${new Date().toISOString().split("T")[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast({ title: "Katalog Margin Berhasil Diekspor", description: "File CSV unit economics telah diunduh" })
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex flex-1 min-h-[80vh] items-center justify-center flex-col w-full bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground mt-3 font-semibold">Memuat Unit Economics Seluruh Paket...</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">Margin Keuntungan per Paket Layanan</h1>
            <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px] font-bold">
              Unit Economics Catalog
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Transparansi biaya pokok Contabo (EUR), kurs konversi, margin laba kotor 500%, dan laba bersih per tier paket.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={fetchReports} className="rounded-xl h-9 text-xs font-bold shadow-xs">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
          <Button onClick={exportMarginCSV} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs">
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Unduh CSV
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant={categoryFilter === "all" ? "default" : "outline"} 
            size="sm" 
            onClick={() => setCategoryFilter("all")} 
            className="rounded-xl text-xs font-bold h-8"
          >
            Semua ({catalog.length})
          </Button>
          <Button 
            variant={categoryFilter === "vps" ? "default" : "outline"} 
            size="sm" 
            onClick={() => setCategoryFilter("vps")} 
            className="rounded-xl text-xs font-bold h-8"
          >
            <Server className="h-3.5 w-3.5 mr-1 text-purple-400" /> Cloud VPS
          </Button>
          <Button 
            variant={categoryFilter === "storage" ? "default" : "outline"} 
            size="sm" 
            onClick={() => setCategoryFilter("storage")} 
            className="rounded-xl text-xs font-bold h-8"
          >
            <Layers className="h-3.5 w-3.5 mr-1 text-emerald-500" /> VPS Storage
          </Button>
          <Button 
            variant={categoryFilter === "vds" ? "default" : "outline"} 
            size="sm" 
            onClick={() => setCategoryFilter("vds")} 
            className="rounded-xl text-xs font-bold h-8"
          >
            <ShieldCheck className="h-3.5 w-3.5 mr-1 text-amber-500" /> Cloud VDS
          </Button>
          <Button 
            variant={categoryFilter === "cloud" ? "default" : "outline"} 
            size="sm" 
            onClick={() => setCategoryFilter("cloud")} 
            className="rounded-xl text-xs font-bold h-8"
          >
            <Layers className="h-3.5 w-3.5 mr-1 text-blue-400" /> Cloud SaaS
          </Button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input 
            placeholder="Cari nama paket..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-9 h-8 text-xs rounded-xl border-border/80"
          />
        </div>
      </div>

      {/* Pricing & Margin Table */}
      <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
        <CardHeader className="p-5 pb-4 border-b border-border/60 bg-muted/20">
          <CardTitle className="text-sm font-bold text-foreground">Daftar Lengkap Harga Jual & Struktur Biaya Modal</CardTitle>
          <CardDescription className="text-[11px] text-muted-foreground">
            Harga tahunan dihitung 10x harga bulanan (Bonus 2 Bulan Gratis untuk Pelanggan).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-bold text-foreground py-3">Nama Paket & Tier</TableHead>
                <TableHead className="text-xs font-bold text-foreground py-3">Kategori</TableHead>
                <TableHead className="text-xs font-bold text-right text-foreground py-3">Harga Jual / Bln</TableHead>
                <TableHead className="text-xs font-bold text-right text-foreground py-3">Harga Tahunan</TableHead>
                <TableHead className="text-xs font-bold text-right text-foreground py-3">Modal Server (COGS)</TableHead>
                <TableHead className="text-xs font-bold text-right text-foreground py-3">Laba Kotor / Bln</TableHead>
                <TableHead className="text-xs font-bold text-right text-foreground py-3">Gross Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/60 text-xs">
              {filteredCatalog.map((item: any) => (
                <TableRow key={item.slug} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="py-3.5">
                    <div className="font-bold text-foreground">{item.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{item.slug}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] font-bold rounded-full uppercase ${
                      item.category === "vds" ? "bg-amber-500/10 text-amber-600 border-amber-500/30" :
                      item.category === "storage" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" :
                      item.category === "vps" ? "bg-primary/10 text-primary border-primary/30" :
                      "bg-blue-500/10 text-blue-600 border-blue-500/30"
                    }`}>
                      {item.category === "storage" ? "VPS STORAGE" : item.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-foreground">
                    {formatRupiah(item.monthlyPrice)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-foreground">
                    {formatRupiah(item.yearlyPrice)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-rose-500">
                    <div>{formatRupiah(item.estimatedMonthlyCogsIdr)}</div>
                    {item.estimatedMonthlyCogsEur > 0 && (
                      <div className="text-[10px] text-muted-foreground">€ {item.estimatedMonthlyCogsEur.toFixed(2)}/bln</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatRupiah(item.monthlyGrossProfitIdr)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {item.grossProfitMarginPercent}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
