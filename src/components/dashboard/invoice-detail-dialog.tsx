"use client"

import { useState } from "react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Download, 
  CreditCard, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Building2, 
  Calendar, 
  Receipt,
  FileText,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  Loader2,
  ExternalLink
} from "lucide-react"
import { generateInvoicePDF, InvoiceData } from "@/lib/pdf-generator"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export interface TransactionInvoiceItem {
  id: string
  orderId: string
  amount: number
  status: string
  paymentType?: string | null
  paymentMethod?: string | null
  transactionId?: string | null
  createdAt: string | Date
  subscription?: {
    plan?: string
    status?: string
    tenant?: {
      name?: string
      slug?: string
    } | null
  } | null
  rawResponse?: any
}

interface InvoiceDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: TransactionInvoiceItem | null
  customerName?: string
  customerEmail?: string
  onCheckStatus?: (orderId: string) => Promise<void>
  onPayNow?: (invoice: TransactionInvoiceItem) => void
}

export function InvoiceDetailDialog({
  open,
  onOpenChange,
  invoice,
  customerName = "Pelanggan",
  customerEmail = "-",
  onCheckStatus,
  onPayNow
}: InvoiceDetailDialogProps) {
  const [copied, setCopied] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  if (!invoice) return null

  const st = (invoice.status || "").toLowerCase()
  const isPaid = st === "success" || st === "settlement" || st === "paid"
  const isPending = st === "pending" || st === "draft" || st === "unpaid"
  const isCancelled = st === "cancel" || st === "cancelled" || st === "expire" || st === "expired" || st === "deny" || st === "failed"

  const total = Number(invoice.amount) || 0
  const subtotal = Math.round(total / 1.11)
  const ppn = total - subtotal

  const formattedDate = new Date(invoice.createdAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })

  // Detect plan or service item name
  let serviceName = "Langganan Paket SaCMS Cloud"
  if (invoice.orderId.startsWith("ACC-")) {
    const rawPlan = invoice.subscription?.plan || "Starter"
    serviceName = `Paket Akun SaaS (${rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1)}) — Langganan Tahunan`
  } else if (invoice.orderId.startsWith("SUB-")) {
    const wsName = invoice.subscription?.tenant?.name || "Workspace"
    const rawPlan = invoice.subscription?.plan || "Pro"
    serviceName = `Workspace ${wsName} (${rawPlan.toUpperCase()}) — Langganan Tahunan`
  } else if (invoice.orderId.startsWith("AI-")) {
    serviceName = "Paket Booster AI Frontend & Schema Builder Credits"
  } else if (invoice.rawResponse?.type === "ai_credits") {
    serviceName = `${invoice.rawResponse.credits || "Booster"} AI Frontend Credits Pack`
  }

  const handleCopyOrderId = () => {
    navigator.clipboard.writeText(invoice.orderId)
    setCopied(true)
    toast({ title: "Order ID Disalin", description: invoice.orderId })
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadPDF = () => {
    generateInvoicePDF({
      orderId: invoice.orderId,
      amount: total,
      status: invoice.status,
      date: new Date(invoice.createdAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }),
      customerName,
      customerEmail,
      description: serviceName,
      paymentMethod: invoice.paymentType || invoice.paymentMethod || "Midtrans Gateway"
    })
    toast({ title: "Invoice Diunduh", description: `File PDF Invoice #${invoice.orderId} telah dibuat.` })
  }

  const handleCheck = async () => {
    if (!onCheckStatus) return
    setIsChecking(true)
    try {
      await onCheckStatus(invoice.orderId)
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden rounded-3xl border-border/80 bg-card shadow-2xl max-h-[92vh] flex flex-col">
        
        {/* Invoice Header */}
        <div className="p-6 pb-5 bg-muted/30 border-b border-border/70 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-lg text-foreground tracking-tight">INVOICE</h3>
                  <button 
                    type="button" 
                    onClick={handleCopyOrderId}
                    className="inline-flex items-center gap-1 text-xs font-mono font-bold text-muted-foreground hover:text-foreground bg-muted/80 px-2 py-0.5 rounded-md transition-colors"
                    title="Salin Order ID"
                  >
                    #{invoice.orderId}
                    {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> {formattedDate}
                </p>
              </div>
            </div>

            {/* Status Badge */}
            <div>
              {isPaid ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold px-3 py-1 rounded-full gap-1.5 shadow-none">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  LUNAS (PAID)
                </Badge>
              ) : isPending ? (
                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold px-3 py-1 rounded-full gap-1.5 shadow-none">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  MENUNGGU PEMBAYARAN
                </Badge>
              ) : (
                <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold px-3 py-1 rounded-full gap-1.5 shadow-none">
                  <XCircle className="h-3.5 w-3.5" />
                  DIBATALKAN / KADALUARSA
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Invoice Body (Scrollable) */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          
          {/* 2-Column Meta Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Tagihan Kepada */}
            <div className="p-4 rounded-2xl border border-border/80 bg-background/50 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tagihan Kepada</p>
              <div>
                <p className="font-bold text-sm text-foreground">{customerName}</p>
                <p className="text-muted-foreground mt-0.5 font-mono">{customerEmail}</p>
              </div>
            </div>

            {/* Informasi Pembayaran */}
            <div className="p-4 rounded-2xl border border-border/80 bg-background/50 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Informasi Pembayaran</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Metode:</span>
                  <span className="font-semibold text-foreground capitalize">
                    {invoice.paymentType || invoice.paymentMethod || "Midtrans Snap Gateway"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gateway:</span>
                  <span className="font-semibold text-foreground">Midtrans Secure (QRIS / VA / CC)</span>
                </div>
              </div>
            </div>

          </div>

          {/* Rincian Item Tagihan */}
          <div className="rounded-2xl border border-border/80 overflow-hidden bg-card">
            <div className="p-3.5 px-4 bg-muted/40 border-b border-border/70 flex justify-between font-bold text-muted-foreground text-[11px] uppercase tracking-wider">
              <span>Rincian Layanan / Paket</span>
              <span>Jumlah</span>
            </div>
            
            <div className="p-4 flex justify-between items-start border-b border-border/60">
              <div className="space-y-1 pr-4">
                <p className="font-bold text-foreground text-xs sm:text-sm">{serviceName}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Layanan Headless CMS Multi-Tenant, API First Engine, Dedicated Database, dan Media Storage.
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-foreground">
                  Rp {subtotal.toLocaleString("id-ID")}
                </p>
                <p className="text-[10px] text-muted-foreground">1 Unit</p>
              </div>
            </div>

            {/* Breakdown Biaya */}
            <div className="p-4 bg-muted/10 space-y-2.5">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal (DPP)</span>
                <span className="font-medium text-foreground">Rp {subtotal.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>PPN 11% (Pajak Pertambahan Nilai)</span>
                <span className="font-medium text-foreground">Rp {ppn.toLocaleString("id-ID")}</span>
              </div>
              <div className="border-t border-border/70 pt-2.5 mt-2 flex justify-between items-baseline">
                <span className="font-bold text-sm text-foreground">Total Tagihan</span>
                <span className="font-black text-xl text-primary tracking-tight">
                  Rp {total.toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          </div>

          {/* Catatan / Security Guarantee */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-primary/[0.03] border border-primary/15 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <span>Dokumen invoice ini diterbitkan otomatis dan sah secara sistematis tanpa tanda tangan basah.</span>
          </div>

        </div>

        {/* Dialog Footer Actions */}
        <div className="p-4 sm:px-6 bg-muted/20 border-t border-border/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={handleDownloadPDF} 
            className="rounded-xl text-xs font-bold gap-1.5 h-9 w-full sm:w-auto border-border/80"
          >
            <Download className="h-3.5 w-3.5" />
            Unduh PDF Invoice
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {isPending && onCheckStatus && (
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={handleCheck}
                disabled={isChecking}
                className="rounded-xl text-xs font-bold gap-1.5 h-9 border-border/80"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isChecking && "animate-spin")} />
                Cek Status
              </Button>
            )}

            {isPending && onPayNow && (
              <Button 
                type="button" 
                size="sm" 
                onClick={() => onPayNow(invoice)}
                className="rounded-xl text-xs font-bold gap-1.5 h-9 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
              >
                <CreditCard className="h-3.5 w-3.5" />
                Bayar Sekarang
              </Button>
            )}

            <Button 
              type="button" 
              variant="secondary" 
              size="sm" 
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs font-bold h-9"
            >
              Tutup
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  )
}
