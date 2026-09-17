"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, RefreshCw, ShieldAlert } from "lucide-react"
import { NocodeAdminLink, formatIdr } from "@/components/admin/nocode-links"
import { useNocodeSummary } from "@/hooks/admin/use-nocode-summary"

const QUICK_LINKS = [
  { label: "Pengguna", path: "/admin/pengguna" },
  { label: "Project", path: "/admin/project" },
  { label: "Build gagal", path: "/admin/build?status=FAILED" },
  { label: "Paket", path: "/admin/paket" },
  { label: "AI & biaya", path: "/admin/ai" },
  { label: "Sistem", path: "/admin/sistem" },
  { label: "Insiden", path: "/admin/insiden" },
  { label: "Audit", path: "/admin/audit" },
]

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
      <CardContent className="p-5 space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function SystemFlag({ label, on, onMeansTrouble }: { label: string; on: boolean; onMeansTrouble: boolean }) {
  const trouble = on === onMeansTrouble
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-foreground">{label}</span>
      <Badge variant={trouble ? "destructive" : "secondary"}>{on ? "Aktif" : "Mati"}</Badge>
    </div>
  )
}

export default function NocodeAdminPage() {
  const { result, loading, forbidden, reload } = useNocodeSummary()

  if (loading && !result) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const baseUrl = result?.adminBaseUrl ?? ""

  return (
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">SaCMS nocode</h1>
          <p className="text-sm text-muted-foreground">
            Ringkasan hanya-baca dari aplikasi nocode. Semua tindakan dikerjakan di panel admin nocode.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Muat ulang
          </Button>
          {baseUrl && (
            <Button asChild size="sm">
              <a href={`${baseUrl}/admin`} target="_blank" rel="noopener noreferrer">
                Buka admin nocode
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {forbidden && (
        <Card className="rounded-2xl border border-border/80">
          <CardContent className="flex items-start gap-3 p-5">
            <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm text-foreground">Ringkasan nocode hanya untuk super admin dan admin.</p>
          </CardContent>
        </Card>
      )}

      {!forbidden && !result && (
        <Card className="rounded-2xl border border-border/80">
          <CardContent className="flex items-start gap-3 p-5">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm text-foreground">Ringkasan gagal dimuat. Coba muat ulang.</p>
          </CardContent>
        </Card>
      )}

      {result && !result.ok && (
        <Card className="rounded-2xl border border-border/80">
          <CardContent className="flex items-start gap-3 p-5">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Ringkasan nocode tidak tersedia</p>
              <p className="text-sm text-muted-foreground">{result.message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {result?.ok && (() => {
        const s = result.summary
        const f = s.finance30Days
        return (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Pengguna" value={s.users.total.toLocaleString("id-ID")} hint={`+${s.users.newLast7Days} dalam 7 hari`} />
              <Stat label="Project" value={s.projects.total.toLocaleString("id-ID")} hint={`+${s.projects.newLast7Days} dalam 7 hari`} />
              <Stat
                label="Build hari ini"
                value={s.builds.finishedToday.toLocaleString("id-ID")}
                hint={`${s.builds.failedToday} gagal · ${s.builds.successRatePercent === null ? "belum ada yang selesai" : `${s.builds.successRatePercent}% sukses`} · ${s.builds.runningNow} berjalan`}
              />
              <Stat label="Kredit terpakai bulan ini" value={s.creditsUsedThisMonth.toLocaleString("id-ID")} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
                <CardHeader className="p-5 pb-2">
                  <CardTitle className="text-sm font-bold">Perlu perhatian</CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-2">
                  {s.attention.length === 0 ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4" /> Tidak ada yang perlu perhatian.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {s.attention.map((item) => (
                        <li key={`${item.path}-${item.message}`} className="text-sm">
                          <NocodeAdminLink baseUrl={baseUrl} path={item.path}>{item.message}</NocodeAdminLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
                <CardHeader className="p-5 pb-2">
                  <CardTitle className="text-sm font-bold">Status sistem</CardTitle>
                  <CardDescription className="text-[11px]">
                    Diubah di <NocodeAdminLink baseUrl={baseUrl} path="/admin/sistem">admin nocode → Sistem</NocodeAdminLink>
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0 divide-y divide-border/60">
                  <SystemFlag label="Kill switch pembuatan website" on={s.system.killSwitch} onMeansTrouble />
                  <SystemFlag label="Mode pemeliharaan" on={s.system.maintenance} onMeansTrouble />
                  <SystemFlag label="Pendaftaran pengguna baru" on={s.system.signupEnabled} onMeansTrouble={false} />
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
              <CardHeader className="p-5 pb-4 border-b border-border/60 bg-muted/20">
                <CardTitle className="text-sm font-bold">Keuangan 30 hari</CardTitle>
                <CardDescription className="text-[11px]">
                  Pendapatan adalah estimasi harga paket × pengguna saat ini, belum dari pembayaran tercatat.
                  {f.unreconciledEvents > 0 &&
                    ` Biaya AI belum final: ${f.unreconciledEvents} event belum direkonsiliasi.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-1 divide-y divide-border/60 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  <div className="p-5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pendapatan</p>
                    <p className="text-lg font-bold tabular-nums">{formatIdr(f.revenueIdr)}</p>
                  </div>
                  <div className="p-5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Biaya AI</p>
                    <p className="text-lg font-bold tabular-nums">{formatIdr(f.aiCostIdr)}</p>
                  </div>
                  <div className="p-5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Margin</p>
                    <p className={`text-lg font-bold tabular-nums ${f.marginIdr < 0 ? "text-destructive" : ""}`}>
                      {formatIdr(f.marginIdr)}
                    </p>
                  </div>
                </div>
                {f.plans.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Paket</TableHead>
                        <TableHead className="text-right">Pengguna</TableHead>
                        <TableHead className="text-right">Pendapatan</TableHead>
                        <TableHead className="text-right">Biaya AI</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {f.plans.map((p) => (
                        <TableRow key={p.name}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{p.users.toLocaleString("id-ID")}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatIdr(p.revenueIdr)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatIdr(p.costIdr)}</TableCell>
                          <TableCell className={`text-right tabular-nums ${p.marginIdr < 0 ? "text-destructive" : ""}`}>
                            {formatIdr(p.marginIdr)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-sm font-bold">Buka di admin nocode</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-x-5 gap-y-2 p-5 pt-2 text-sm">
                {QUICK_LINKS.map((l) => (
                  <NocodeAdminLink key={l.path} baseUrl={baseUrl} path={l.path}>{l.label}</NocodeAdminLink>
                ))}
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              Diperbarui {new Date(s.generatedAt).toLocaleString("id-ID")} · sumber {baseUrl}
            </p>
          </>
        )
      })()}
    </div>
  )
}
