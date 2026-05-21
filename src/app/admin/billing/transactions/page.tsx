"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Loader2, CreditCard, Search, Filter, RefreshCw, 
  CheckCircle2, XCircle, Clock, ArrowLeft, Building2,
  Calendar, Download, ChevronLeft, ChevronRight, ExternalLink
} from "lucide-react"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface Transaction {
  id: string
  orderId: string
  amount: number
  status: string
  paymentType: string | null
  createdAt: string
  transactionId: string | null
  subscription?: {
    tenant: {
      name: string
      slug: string
    }
  } | null
}

export default function AdminTransactionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  
  // Filters
  const [statusFilter, setStatusFilter] = useState("all")
  const [search, setSearch] = useState("")

  const fetchTransactions = async (p: number = 1) => {
    setRefreshing(true)
    try {
      let url = `/api/admin/billing/transactions?page=${p}&limit=20`
      if (statusFilter !== "all") url += `&status=${statusFilter}`
      if (search) url += `&search=${search}`
      
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setTransactions(data.transactions || [])
        setTotalPages(data.pagination.totalPages)
        setPage(data.pagination.page)
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if (session?.user?.role === "super_admin") fetchTransactions(1)
  }, [session, statusFilter])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "success":
      case "settlement":
      case "capture":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-[10px] font-black uppercase">Success</Badge>
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 text-[10px] font-black uppercase">Pending</Badge>
      case "failed":
      case "expire":
      case "deny":
        return <Badge variant="destructive" className="text-[10px] font-black uppercase">Failed</Badge>
      default:
        return <Badge variant="outline" className="text-[10px] font-black uppercase">{status}</Badge>
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex">
<div className="flex-1 min-h-screen flex items-center justify-center flex-col w-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col w-full">
<div className="flex-1 flex-col w-full">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push("/admin/billing")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">Platform Transactions</h1>
                <p className="text-muted-foreground">Full history of all payments and checkout attempts.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="bg-card" onClick={() => fetchTransactions(page)}>
                <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} /> Refresh
              </Button>
              <Button className="bg-primary hover:bg-primary/90 font-bold shadow-lg shadow-primary/20">
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </div>
          </div>

          {/* Filter Bar */}
          <Card className="border-none shadow-sm bg-card">
            <CardContent className="p-4 flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by Order ID, Transaction ID, or Tenant Name..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchTransactions(1)}
                  className="pl-10 h-10 bg-muted/30 border-none focus-visible:ring-primary" 
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] h-10 bg-muted/30 border-none">
                  <Filter className="h-3.5 w-3.5 mr-2" />
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card className="border-none shadow-sm overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest pl-6">Order Info</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Tenant Workspace</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Payment Method</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Amount</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Status</TableHead>
                    <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest pr-6">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-24 text-muted-foreground">
                        <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-10" />
                        <p className="font-bold text-lg">No transactions found</p>
                        <p className="text-sm">Try adjusting your filters or search terms.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((tx) => (
                      <TableRow key={tx.id} className="hover:bg-muted/5 transition-colors group">
                        <TableCell className="pl-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-foreground">{tx.orderId}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">TX: {tx.transactionId || 'not-started'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary border border-primary/10">
                              <Building2 className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold truncate max-w-[150px]">{tx.subscription?.tenant.name || "System"}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">/{tx.subscription?.tenant.slug}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-bold uppercase bg-muted/20 border-none">
                            {tx.paymentType || "Unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-black text-foreground">{formatCurrency(tx.amount)}</span>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(tx.status)}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-medium">{new Date(tx.createdAt).toLocaleDateString()}</span>
                            <span className="text-[10px] text-muted-foreground">{new Date(tx.createdAt).toLocaleTimeString()}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            <div className="p-4 bg-muted/10 border-t flex items-center justify-between">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                Showing Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => fetchTransactions(page - 1)} 
                  disabled={page === 1 || refreshing}
                  className="h-8 rounded-lg"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => fetchTransactions(page + 1)} 
                  disabled={page === totalPages || refreshing}
                  className="h-8 rounded-lg"
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
