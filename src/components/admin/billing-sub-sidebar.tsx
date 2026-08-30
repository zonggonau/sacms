"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  TrendingUp,
  Receipt,
  PieChart,
  Layers,
  ArrowLeft,
  DollarSign,
  ShieldCheck
} from "lucide-react"

const billingNavItems = [
  { 
    title: "Ringkasan Eksekutif", 
    href: "/admin/billing", 
    icon: LayoutDashboard, 
    exact: true,
    description: "Overview pendapatan, MRR & performa tagihan"
  },
  { 
    title: "Laporan Laba & Rugi", 
    href: "/admin/billing/laba-rugi", 
    icon: TrendingUp,
    description: "Analisis Gross Profit, COGS Server & Net Margin"
  },
  { 
    title: "Margin Keuntungan Paket", 
    href: "/admin/billing/margin-keuntungan", 
    icon: PieChart,
    description: "Unit economics per paket VPS, VDS & Cloud"
  },
  { 
    title: "Unit Economics Tenant", 
    href: "/admin/billing/tenant-economics", 
    icon: Layers,
    description: "Profitabilitas per workspace aktif"
  },
  { 
    title: "Riwayat Transaksi", 
    href: "/admin/billing/transactions", 
    icon: Receipt,
    description: "Semua log pembayaran Midtrans & faktur"
  },
]

export function BillingSubSidebar() {
  const pathname = usePathname()

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-64 border-r border-border/80 bg-card/60 backdrop-blur flex flex-col h-full shrink-0 sticky top-0">
      {/* Header */}
      <div className="p-4 border-b border-border/70 space-y-3">
        <Link 
          href="/admin"
          className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 text-primary" />
          <span>Kembali ke Admin Hub</span>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <h2 className="text-base font-black tracking-tight text-foreground">Keuangan & Billing</h2>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">Laporan margin laba, COGS & transaksi</p>
        </div>
      </div>

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
          Menu Laporan Keuangan
        </p>
        {billingNavItems.map((item) => {
          const active = isActive(item.href, item.exact)
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex flex-col gap-0.5 px-3 py-2.5 rounded-xl transition-all",
                  active
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <item.icon className={cn("h-4 w-4 shrink-0", active ? "text-primary-foreground" : "text-muted-foreground")} />
                  <span className="text-xs font-bold truncate">{item.title}</span>
                </div>
                <span className={cn("text-[10px] pl-6.5 truncate", active ? "text-primary-foreground/80" : "text-muted-foreground/70")}>
                  {item.description}
                </span>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Footer Info Badge */}
      <div className="p-3 border-t border-border/70 bg-muted/20">
        <div className="p-2.5 rounded-xl bg-card border border-border/80 shadow-xs space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Margin Terlindungi</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-snug">
            Target margin laba VPS & VDS 500% aktif pada semua transaksi appliance.
          </p>
        </div>
      </div>
    </aside>
  )
}
