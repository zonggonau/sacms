"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Copy, Loader2, Save } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function ApiConfiguration({ tenantSlug }: { tenantSlug: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // API settings
  const [apiKey, setApiKey] = useState("")
  const [generatingApiKey, setGeneratingApiKey] = useState(false)
  const [apiVersion, setApiVersion] = useState("v1")
  const [rateLimiting, setRateLimiting] = useState(true)
  const [requestsPerMinute, setRequestsPerMinute] = useState("60")
  const [burstLimit, setBurstLimit] = useState("100")
  const [corsOrigins, setCorsOrigins] = useState("")

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/tenant/${tenantSlug}/settings`)
        if (res.ok) {
          const data = await res.json()
          const settings = data.settings
          setApiKey(settings.apiKey || "")
          setApiVersion(settings.apiVersion || "v1")
          setRateLimiting(settings.rateLimiting ?? true)
          setRequestsPerMinute(String(settings.requestsPerMinute || 60))
          setBurstLimit(String(settings.burstLimit || 100))
          setCorsOrigins(settings.corsOrigins || "")
        }
      } catch (error) {
        console.error("Failed to fetch API settings:", error)
      } finally {
        setLoading(false)
      }
    }

    if (tenantSlug) {
      fetchData()
    }
  }, [tenantSlug])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiVersion,
          rateLimiting,
          requestsPerMinute: parseInt(requestsPerMinute),
          burstLimit: parseInt(burstLimit),
          corsOrigins,
        }),
      })

      if (res.ok) {
        toast({
          title: "Pengaturan Disimpan",
          description: "Konfigurasi API berhasil diperbarui",
        })
      } else {
        const data = await res.json()
        toast({
          title: "Gagal Menyimpan",
          description: data.error || "Gagal menyimpan konfigurasi",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to save:", error)
      toast({
        title: "Terjadi Kesalahan",
        description: "Gagal menyimpan konfigurasi",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateApiKey = async () => {
    if (!confirm("Apakah Anda yakin ingin membuat kunci API baru? Kunci lama tidak akan dapat digunakan lagi untuk integrasi baru.")) return
    
    setGeneratingApiKey(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/api-keys`, {
        method: "POST",
      })

      if (res.ok) {
        const data = await res.json()
        setApiKey(data.apiKey)
        toast({
          title: "Berhasil",
          description: "Kunci API baru berhasil dibuat",
        })
      } else {
        const data = await res.json()
        toast({
          title: "Gagal Membuat Kunci API",
          description: data.error || "Gagal membuat kunci API",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to generate API key:", error)
      toast({
        title: "Terjadi Kesalahan",
        description: "Gagal membuat kunci API",
        variant: "destructive",
      })
    } finally {
      setGeneratingApiKey(false)
    }
  }

  const handleCopyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey)
      toast({
        title: "Tersalin",
        description: "Kunci API berhasil disalin ke clipboard",
      })
    }
  }

  if (loading) {
    return (
      <Card className="rounded-2xl border-border/80">
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl border-border/80 shadow-xs">
      <CardHeader>
        <CardTitle className="text-base font-bold">Konfigurasi API</CardTitle>
        <CardDescription className="text-xs">
          Kelola pengaturan API untuk workspace Anda
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Kunci API Utama</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type="text"
                value={apiKey || "Belum ada kunci API yang dibuat"}
                readOnly
                className="pr-10 font-mono text-xs rounded-xl h-9 border-border/80"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
                onClick={handleCopyApiKey}
                disabled={!apiKey}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button 
              variant="secondary" 
              onClick={handleGenerateApiKey}
              disabled={generatingApiKey}
              className="rounded-xl h-9 text-xs font-semibold"
            >
              {generatingApiKey ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : null}
              Generate Kunci
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Gunakan kunci ini untuk mengotentikasi integrasi dan aplikasi eksternal.
          </p>
        </div>
        <Separator />
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Versi API</Label>
          <Select value={apiVersion} onValueChange={setApiVersion}>
            <SelectTrigger className="w-48 h-9 text-xs rounded-xl border-border/80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border">
              <SelectItem value="v1">v1 (Stabil)</SelectItem>
              <SelectItem value="v2">v2 (Beta)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs font-semibold">Rate Limiting</Label>
            <p className="text-xs text-muted-foreground">
              Aktifkan pembatasan laju permintaan untuk API
            </p>
          </div>
          <Switch checked={rateLimiting} onCheckedChange={setRateLimiting} />
        </div>
        {rateLimiting && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Permintaan per Menit</Label>
              <Input
                type="number"
                value={requestsPerMinute}
                onChange={(e) => setRequestsPerMinute(e.target.value)}
                className="h-9 text-xs rounded-xl border-border/80"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Batas Burst</Label>
              <Input
                type="number"
                value={burstLimit}
                onChange={(e) => setBurstLimit(e.target.value)}
                className="h-9 text-xs rounded-xl border-border/80"
              />
            </div>
          </div>
        )}
        <Separator />
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Domain Diizinkan (CORS)</Label>
          <Textarea
            placeholder="Masukkan domain yang diizinkan, satu per baris&#10;https://contoh.com&#10;https://app.contoh.com"
            rows={4}
            value={corsOrigins}
            onChange={(e) => setCorsOrigins(e.target.value)}
            className="text-xs rounded-xl border-border/80 font-mono"
          />
          <p className="text-[10px] text-muted-foreground">
            Masukkan nama domain, satu per baris. Gunakan * untuk semua origin (tidak disarankan untuk lingkungan produksi).
          </p>
        </div>
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={saving} className="rounded-xl h-9 text-xs font-bold shadow-xs">
            {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Simpan Konfigurasi
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
