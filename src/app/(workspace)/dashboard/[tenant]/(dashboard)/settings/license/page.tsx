"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import {
  Copy,
  Check,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  KeyRound,
  Loader2,
} from "lucide-react"

import { useParams } from "next/navigation"

export default function CustomerLicensePage() {
  const { tenant } = useParams() as { tenant: string }
  const { toast } = useToast()
  const [license, setLicense] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showActivate, setShowActivate] = useState(false)
  const [licenseKeyInput, setLicenseKeyInput] = useState("")
  const [activating, setActivating] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/tenant/${tenant}/license/status`)
      if (res.ok) {
        const data = await res.json()
        setLicense(data)
      } else {
        setLicense(null)
      }
    } catch {
      setLicense(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault()
    setActivating(true)

    try {
      const res = await fetch(`/api/tenant/${tenant}/license/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: licenseKeyInput }),
      })

      const data = await res.json()

      if (res.ok) {
        setShowActivate(false)
        setLicenseKeyInput("")
        toast({
          title: "Lisensi Berhasil Diaktifkan",
          description: `Mode Enterprise aktif. Sisa ${data.daysRemaining} hari masa berlaku.`,
        })
        await fetchStatus()
      } else {
        toast({
          title: "Aktivasi Gagal",
          description: data.error || "Kunci lisensi tidak valid",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Terjadi Kesalahan",
        description: "Gagal mengaktifkan lisensi. Silakan coba kembali.",
        variant: "destructive",
      })
    } finally {
      setActivating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Checking license status...</p>
        </div>
      </div>
    )
  }

  // No License / Not Activated
  if (!license || !license.valid) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="border border-border/80 bg-card rounded-2xl shadow-xs">
          <CardHeader className="text-center pb-2">
            <div className="w-14 h-14 mx-auto bg-muted rounded-2xl flex items-center justify-center mb-3 border border-border/60">
              <ShieldAlert className="w-7 h-7 text-muted-foreground" />
            </div>
            <CardTitle className="text-xl font-bold">Mode Standar (Standard Mode)</CardTitle>
            <CardDescription className="text-xs max-w-md mx-auto mt-1">
              Workspace ini berjalan dalam mode standar dengan batasan kuota paket. Untuk akses tanpa batas dan dukungan mandiri (Self-Hosted), <strong>silakan hubungi Administrator</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {!showActivate ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="mailto:admin@sacms.cloud?subject=Permintaan%20Lisensi%20Enterprise%20SaCMS"
                  className="flex-1"
                >
                  <Button
                    variant="outline"
                    className="w-full h-10 rounded-xl font-semibold text-xs border-border"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-2" />
                    Hubungi Administrator
                  </Button>
                </a>
                <Button
                  className="flex-1 h-10 rounded-xl font-bold text-xs bg-primary text-primary-foreground"
                  onClick={() => setShowActivate(true)}
                >
                  <KeyRound className="w-3.5 h-3.5 mr-2" />
                  Aktivasi Serial Key
                </Button>
              </div>
            ) : (
              <form onSubmit={handleActivate} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground">Serial Key Lisensi Enterprise</label>
                  <Input
                    value={licenseKeyInput}
                    onChange={(e) => setLicenseKeyInput(e.target.value)}
                    placeholder="Tempelkan serial key SACMS-... di sini"
                    className="font-mono text-xs min-h-[80px] rounded-xl"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Masukkan serial key yang Anda peroleh dari Administrator sistem.
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <Button
                    type="submit"
                    disabled={activating || !licenseKeyInput.trim()}
                    className="flex-1 h-10 rounded-xl font-bold text-xs bg-primary text-primary-foreground"
                  >
                    {activating ? (
                      <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Mengaktifkan...</>
                    ) : (
                      <>Aktifkan Lisensi</>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowActivate(false)}
                    className="h-10 px-5 rounded-xl text-xs font-semibold"
                  >
                    Batal
                  </Button>
                </div>
              </form>
            )}

            <div className="text-center pt-3 border-t border-border/60">
              <p className="text-xs text-muted-foreground">
                Butuh bantuan implementasi atau konsultasi SLA khusus?{" "}
                <a
                  href="mailto:admin@sacms.cloud?subject=Konsultasi%20Enterprise%20SaCMS"
                  className="text-primary font-semibold hover:underline inline-flex items-center gap-1"
                >
                  Hubungi Admin <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Active License
  const daysRemaining = license.daysRemaining || 0
  const progressPct = license.totalDays
    ? Math.round(((license.totalDays - daysRemaining) / license.totalDays) * 100)
    : 50
  const isExpiring = daysRemaining < 30 && daysRemaining > 0
  const isExpired = daysRemaining <= 0

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* License Active Card */}
      <Card className={`border rounded-2xl shadow-xs bg-card overflow-hidden ${
        isExpired ? "border-rose-500/30" :
        isExpiring ? "border-amber-500/30" :
        "border-emerald-500/30"
      }`}>
        <CardHeader className={`${
          isExpired ? "bg-rose-500/5" :
          isExpiring ? "bg-amber-500/5" :
          "bg-emerald-500/5"
        } p-5 border-b border-border/60`}>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {isExpired ? (
                  <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30 font-bold text-[10px] rounded-full">
                    <ShieldAlert className="w-3 h-3 mr-1" /> Kadaluarsa
                  </Badge>
                ) : isExpiring ? (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 font-bold text-[10px] rounded-full">
                    <ShieldAlert className="w-3 h-3 mr-1" /> Segera Berakhir
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold text-[10px] rounded-full">
                    <ShieldCheck className="w-3 h-3 mr-1" /> Aktif
                  </Badge>
                )}
                <Badge variant="secondary" className="uppercase text-[10px] font-bold rounded-full">
                  {license.type}
                </Badge>
              </div>
              <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <Shield className="w-4 h-4 text-primary" />
                Lisensi Enterprise Terverifikasi
              </CardTitle>
            </div>
            <ShieldCheck className={`w-8 h-8 ${
              isExpired ? "text-rose-500" :
              isExpiring ? "text-amber-500" :
              "text-emerald-500"
            }`} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-5">
          {/* Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-semibold">Nama Pemegang</p>
              <p className="text-xs font-bold text-foreground">{license.customerName}</p>
            </div>
            {license.organization && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-semibold">Organisasi / PT</p>
                <p className="text-xs font-bold text-foreground">{license.organization}</p>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-semibold">Diterbitkan</p>
              <p className="text-xs font-bold text-foreground">
                {license.issuedAt ? new Date(license.issuedAt).toLocaleDateString() : "-"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-semibold">Masa Berlaku</p>
              <p className={`text-xs font-bold ${isExpiring || isExpired ? "text-destructive" : "text-foreground"}`}>
                {license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : "-"}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className={`font-bold ${
                isExpired ? "text-destructive" :
                isExpiring ? "text-amber-600" :
                "text-emerald-600 dark:text-emerald-400"
              }`}>
                {isExpired
                  ? "Lisensi Telah Berakhir"
                  : `Tersisa ${daysRemaining} hari`
                }
              </span>
              <span className="text-muted-foreground text-[11px]">
                {Math.round(progressPct)}% terpakai
              </span>
            </div>
            <Progress
              value={Math.min(progressPct, 100)}
              className={`h-2 rounded-full ${
                isExpired ? "bg-rose-500/20" :
                isExpiring ? "bg-amber-500/20" :
                "bg-emerald-500/20"
              }`}
            />
          </div>

          {/* Features */}
          {license.features && license.features.length > 0 && (
            <div className="pt-4 border-t border-border/60 space-y-2.5">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                Fitur Enterprise Termasuk
              </p>
              <div className="flex flex-wrap gap-2">
                {license.features.map((f: string) => (
                  <Badge key={f} variant="secondary" className="text-xs rounded-full font-medium">
                    ✅ {f.replace(/-/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row gap-3">
            {isExpiring || isExpired ? (
              <a
                href="mailto:admin@sacms.cloud?subject=Pembaruan%20Lisensi%20Enterprise"
                className="flex-1"
              >
                <Button className="w-full h-9 rounded-xl text-xs font-bold bg-primary text-primary-foreground">
                  Perpanjang Lisensi
                </Button>
              </a>
            ) : null}
            <Button
              variant="outline"
              onClick={() => fetchStatus()}
              className={`h-9 rounded-xl text-xs font-bold ${isExpiring || isExpired ? "" : "flex-1"}`}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Perbarui Status
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
