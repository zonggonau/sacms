"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { formatIdr } from "@/components/admin/nocode-links"
import { useNocodeSummary } from "@/hooks/admin/use-nocode-summary"

/**
 * Consolidated view of SaCMS + SaCMS nocode for the finance pages (nocode ADR-016).
 *
 * The two figures are NOT the same kind of number: SaCMS reports live MRR from
 * active subscriptions, nocode reports a 30-day estimate (plan price × current
 * users). They are shown side by side and summed with that caveat spelled out,
 * rather than silently folded into the SaCMS P&L.
 */
export function NocodeFinanceSection({
  sacmsMonthlyRevenue,
  sacmsMonthlyGrossProfit,
}: {
  sacmsMonthlyRevenue?: number
  sacmsMonthlyGrossProfit?: number
}) {
  const { result, loading, forbidden } = useNocodeSummary()

  if (forbidden) return null

  const sacmsRevenue = sacmsMonthlyRevenue ?? 0
  const sacmsGross = sacmsMonthlyGrossProfit ?? 0

  return (
    <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
      <CardHeader className="p-5 pb-4 border-b border-border/60 bg-muted/20">
        <CardTitle className="text-sm font-bold text-foreground">Konsolidasi dengan SaCMS nocode</CardTitle>
        <CardDescription className="text-[11px] text-muted-foreground">
          SaCMS memakai MRR dari langganan aktif; nocode memakai estimasi 30 hari (harga paket × pengguna saat ini).
          Jumlahnya indikatif, bukan laporan keuangan resmi.{" "}
          <Link href="/admin/nocode" className="font-medium text-primary hover:underline">
            Detail nocode
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading && !result && (
          <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat angka nocode…
          </div>
        )}

        {!loading && !result && (
          <p className="p-5 text-sm text-muted-foreground">Angka nocode gagal dimuat.</p>
        )}

        {result && !result.ok && <p className="p-5 text-sm text-muted-foreground">{result.message}</p>}

        {result?.ok && (() => {
          const f = result.summary.finance30Days
          const rows = [
            { label: "SaCMS (MRR)", revenue: sacmsRevenue, gross: sacmsGross },
            { label: "SaCMS nocode (30 hari)", revenue: f.revenueIdr, gross: f.marginIdr },
            { label: "Gabungan", revenue: sacmsRevenue + f.revenueIdr, gross: sacmsGross + f.marginIdr },
          ]
          return (
            <div className="grid grid-cols-1 divide-y divide-border/60 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {rows.map((r) => (
                <div key={r.label} className="p-5 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{r.label}</p>
                  <div>
                    <p className="text-xs text-muted-foreground">Pendapatan / bulan</p>
                    <p className="text-lg font-bold tabular-nums">{formatIdr(r.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Laba kotor / bulan</p>
                    <p className={`text-lg font-bold tabular-nums ${r.gross < 0 ? "text-destructive" : ""}`}>
                      {formatIdr(r.gross)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
      </CardContent>
    </Card>
  )
}
