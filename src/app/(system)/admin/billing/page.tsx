"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Loader2, DollarSign, TrendingUp, Users, Package, RefreshCw,
  Download, CreditCard, ArrowUpRight, CheckCircle2, XCircle,
  Clock, ArrowRight, TrendingDown, Shield
} from "lucide-react"
import Link from "next/link"

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
  }, [session])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const handleGenerateInvoices = async () => {
    if (!confirm("Are you sure you want to generate invoices for all eligible subscriptions?")) return
    setGenerating(true)
    try {
      const res = await fetch("/api/admin/billing/generate-invoices", {
        method: "POST",
      })
      if (res.ok) {
        alert("Invoices generated successfully!")
        fetchStats()
      } else {
        const err = await res.json()
        alert(`Error: ${err.error || "Failed to generate invoices"}`)
      }
    } catch (error) {
      console.error("Failed to generate invoices:", error)
      alert("Failed to generate invoices")
    } finally {
      setGenerating(false)
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

  if (session?.user?.role !== "super_admin") {
    router.push("/dashboard")
    return null
  }

  const growth = stats?.growth.revenueGrowth || 0

  return (
    <div className="flex flex-1 flex-col w-full">
<div className="flex-1 flex-col w-full">
        <div className="p-6 lg:p-8 w-full space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Billing & Revenue</h1>
              <p className="text-muted-foreground">Platform financial overview and subscription management</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleGenerateInvoices} disabled={generating}>
                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Run Billing Cycle
              </Button>
              <Button className="bg-primary hover:bg-primary/90">
                <Download className="mr-2 h-4 w-4" /> Export Financials
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Monthly Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-violet-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats?.overview.monthlyRevenue || 0)}</div>
                <div className="flex items-center mt-1">
                  {growth >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-emerald-500 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                  )}
                  <span className={`text-xs font-bold ${growth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {Math.abs(growth)}%
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-1">vs last month</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Current MRR</CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats?.overview.mrr || 0)}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Expected recurring revenue</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Active Subs</CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.subscriptions.active || 0}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Paying workspaces</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground">Total Revenue</CardTitle>
                <CreditCard className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats?.overview.totalRevenue || 0)}</div>
                <p className="text-[10px] text-muted-foreground mt-1">Lifetime platform earnings</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Recent Transactions */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">Recent Transactions</CardTitle>
                  <CardDescription className="text-xs">Latest payments via Midtrans</CardDescription>
                </div>
                <Link href="/admin/billing/transactions">
                  <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-muted-foreground hover:text-primary">
                    VIEW ALL <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-0 border-t">
                {(!stats?.payments.recent || stats.payments.recent.length === 0) ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No recent transaction data</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {stats.payments.recent.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                            tx.status === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                            tx.status === "pending" ? "bg-amber-50 border-amber-100 text-amber-600" :
                            "bg-red-50 border-red-100 text-red-600"
                          }`}>
                            {tx.status === "success" ? <CheckCircle2 className="h-5 w-5" /> : 
                             tx.status === "pending" ? <Clock className="h-5 w-5" /> : 
                             <XCircle className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold leading-none truncate">
                              {tx.subscription?.tenant.name || "System Payment"}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">
                              ID: {tx.orderId} &middot; {tx.paymentType || 'unknown'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black">{formatCurrency(tx.amount)}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Plan Distribution */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Platform Tiers</CardTitle>
                  <CardDescription className="text-xs uppercase font-bold tracking-tight">Active Plan Limits</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { name: "Starter", price: "500K", color: "bg-blue-500" },
                    { name: "Pro", price: "2M", color: "bg-violet-500" },
                    { name: "Enterprise", price: "Custom", color: "bg-slate-900" },
                  ].map((plan) => (
                    <div key={plan.name} className="flex items-center justify-between p-3 border rounded-xl bg-card hover:border-primary/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-8 rounded-full ${plan.color}`} />
                        <div>
                          <p className="text-sm font-bold">{plan.name}</p>
                          <p className="text-[10px] text-muted-foreground">Starting Rp {plan.price}/mo</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-black">ACTIVE</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Billing Quick Tip */}
              <Card className="bg-primary/5 border-primary/10">
                <CardContent className="p-4 flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-primary">Automated Invoicing</h4>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                      Billing cycles run every month. Click 'Run Billing Cycle' to manually trigger invoice generation for overdue subscriptions.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
