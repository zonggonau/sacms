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
  Loader2, Layers, Search, Download, RefreshCw,
  Building2, Server, ShieldCheck, FileSpreadsheet, User
} from "lucide-react"
import { formatRupiah } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

export default function TenantEconomicsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

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
      console.error("Failed to fetch tenant economics:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === "super_admin" || session?.user?.role === "admin") {
      fetchReports()
    }
  }, [session?.user?.id, session?.user?.role])

  const tenants = data?.tenantBreakdown || []

  const filteredTenants = tenants.filter((t: any) => {
    return (
      t.tenantName.toLowerCase().includes(search.toLowerCase()) ||
      t.tenantSlug.toLowerCase().includes(search.toLowerCase()) ||
      t.userEmail.toLowerCase().includes(search.toLowerCase()) ||
      t.planName.toLowerCase().includes(search.toLowerCase())
    )
  })

  const exportTenantCSV = () => {
    if (tenants.length === 0) return
    const headers = ["Tenant Name", "Tenant Slug", "Owner Email", "Plan Name", "Monthly Revenue (IDR)", "Monthly COGS (IDR)", "Monthly Profit (IDR)", "Margin %", "Status"]
    const rows = tenants.map((t: any) => [
      `"${t.tenantName}"`,
      t.tenantSlug,
      t.userEmail,
      `"${t.planName}"`,
      t.monthlyRevenue,
      t.monthlyCogs,
      t.monthlyGrossProfit,
      `${t.marginPercent}%`,
      t.status
    ])

    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map((e: any) => e.join(",")).join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `tenant_unit_economics_sacms_${new Date().toISOString().split("T")[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast({ title: "Data Tenant Diekspor", description: "File CSV Unit Economics per Tenant telah diunduh" })
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex flex-1 min-h-[80vh] items-center justify-center flex-col w-full bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground mt-3 font-semibold">Memuat Unit Economics Tenant Aktif...</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">Unit Economics per Tenant Workspace</h1>
            <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[10px] font-bold">
              Account-Level Profitability
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Analisis laba bersih dan efisiensi biaya server untuk masing-masing workspace pelanggan aktif.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={fetchReports} className="rounded-xl h-9 text-xs font-bold shadow-xs">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
          <Button onClick={exportTenantCSV} size="sm" className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-9 rounded-xl shadow-xs">
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Unduh CSV
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input 
            placeholder="Cari nama tenant, slug, atau email owner..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="pl-9 h-8 text-xs rounded-xl border-border/80"
          />
        </div>
        <div className="text-xs text-muted-foreground font-semibold">
          Total: <span className="text-foreground font-bold">{filteredTenants.length}</span> Workspace Aktif
        </div>
      </div>

      {/* Tenant Profit Table */}
      <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
        <CardHeader className="p-5 pb-4 border-b border-border/60 bg-muted/20">
          <CardTitle className="text-sm font-bold text-foreground">Rincian Finansial Tiap Workspace</CardTitle>
          <CardDescription className="text-[11px] text-muted-foreground">
            Memetakan biaya server riil per instance terhadap pendapatan bulanan.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredTenants.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Layers className="h-10 w-10 mx-auto mb-2 opacity-20" />
              <p className="text-xs font-bold text-foreground">Tidak ada data workspace langganan aktif yang cocok</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-xs font-bold text-foreground py-3">Tenant & Pemilik</TableHead>
                  <TableHead className="text-xs font-bold text-foreground py-3">Paket Langganan</TableHead>
                  <TableHead className="text-xs font-bold text-right text-foreground py-3">Pendapatan / Bln</TableHead>
                  <TableHead className="text-xs font-bold text-right text-foreground py-3">Beban Server (COGS)</TableHead>
                  <TableHead className="text-xs font-bold text-right text-foreground py-3">Laba Bersih / Bln</TableHead>
                  <TableHead className="text-xs font-bold text-right text-foreground py-3">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/60 text-xs">
                {filteredTenants.map((t: any) => (
                  <TableRow key={t.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="py-3.5">
                      <div className="font-bold text-foreground flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-primary" /> {t.tenantName}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                        <User className="h-3 w-3" /> {t.userEmail} ({t.tenantSlug})
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-bold rounded-full border-border/80">
                        {t.planName}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-foreground">
                      {formatRupiah(t.monthlyRevenue)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-rose-500">
                      {formatRupiah(t.monthlyCogs)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatRupiah(t.monthlyGrossProfit)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {t.marginPercent}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
