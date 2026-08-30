"use client"

import { useState, useEffect } from "react"
import { 
  History, Clock, RotateCcw, User, 
  CheckCircle2, FileText, AlertCircle, Loader2,
  ChevronRight, Calendar, ArrowLeft, GitCompare
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import ReactDiffViewer from "react-diff-viewer-continued"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface Version {
  id: string
  version: number
  changeType: string
  changedBy: string | null
  changeSummary: string | null
  createdAt: string
  publishedAt: string | null
}

interface ContentHistorySidebarProps {
  tenantSlug: string
  contentTypeSlug: string
  entryId: string
  currentData?: any
  onRestoreSuccess: (newData: any) => void
}

export function ContentHistorySidebar({
  tenantSlug,
  contentTypeSlug,
  entryId,
  currentData = {},
  onRestoreSuccess
}: ContentHistorySidebarProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [diffVersionId, setDiffVersionId] = useState<string | null>(null)
  const [diffData, setDiffData] = useState<any>(null)
  const [loadingDiff, setLoadingDiff] = useState(false)

  const fetchVersions = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/entries/${entryId}/versions`)
      if (res.ok) {
        const data = await res.json()
        setVersions(data.versions || [])
      }
    } catch (error) {
      console.error("Error fetching versions:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) fetchVersions()
  }, [open, entryId])

  const handleRestore = async (versionId: string) => {
    if (!confirm("Apakah Anda yakin ingin mengembalikan versi ini? Perubahan yang belum disimpan akan tertimpa.")) return
    
    setRestoring(versionId)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/entries/${entryId}/versions/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      })
      
      if (res.ok) {
        const data = await res.json()
        toast({ 
          title: "✨ Versi Berhasil Dipulihkan", 
          description: "Data konten telah dikembalikan ke revisi yang dipilih.",
        })
        onRestoreSuccess(data.entry.data)
        setOpen(false)
        setDiffVersionId(null)
      } else {
        toast({ variant: "destructive", title: "Gagal Memulihkan Versi" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Terjadi kesalahan saat memulihkan versi." })
    } finally {
      setRestoring(null)
    }
  }

  const handleDiff = async (versionId: string) => {
    setLoadingDiff(true)
    setDiffVersionId(versionId)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/entries/${entryId}/versions/${versionId}`)
      if (res.ok) {
        const data = await res.json()
        setDiffData(data.version.data)
      }
    } catch (error) {
      console.error("Error fetching version data for diff:", error)
      toast({ variant: "destructive", title: "Gagal memuat perbandingan versi" })
      setDiffVersionId(null)
    } finally {
      setLoadingDiff(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-9 px-3.5 rounded-xl text-xs font-bold border-border/80 hover:bg-muted transition-all text-muted-foreground hover:text-foreground cursor-pointer gap-1.5 shadow-xs"
        >
          <History className="h-3.5 w-3.5 text-primary" />
          History
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[740px] p-0 overflow-hidden border border-border/80 shadow-2xl rounded-2xl bg-card text-card-foreground">
        {/* Header with SaCMS Gradient Banner */}
        <DialogHeader className="p-5 pb-4 border-b border-border/70 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pr-12 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shrink-0 shadow-xs">
                {diffVersionId ? <GitCompare className="h-5 w-5" /> : <History className="h-5 w-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base font-bold text-foreground">
                    {diffVersionId ? "Perbandingan Versi (Diff)" : "Riwayat Revisi Konten"}
                  </DialogTitle>
                  <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/25 rounded-full px-2.5 py-0.5">
                    {versions.length} Versi
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  {diffVersionId 
                    ? "Membandingkan data revisi lama dengan data formulir saat ini." 
                    : "Lihat jejak perubahan, bandingkan perbedaan, dan pulihkan versi sebelumnya."}
                </DialogDescription>
              </div>
            </div>

            {diffVersionId && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setDiffVersionId(null)} 
                className="rounded-xl border-border/80 h-8 text-xs font-bold cursor-pointer gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Kembali
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="p-0 bg-card">
          <ScrollArea className="h-[520px]">
            {diffVersionId ? (
              <div className="p-4 space-y-4">
                {loadingDiff ? (
                  <div className="flex flex-col items-center justify-center h-[400px] gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Memuat perbandingan versi...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border/80 overflow-hidden bg-background">
                      <ReactDiffViewer 
                        oldValue={JSON.stringify(diffData || {}, null, 2)} 
                        newValue={JSON.stringify(currentData || {}, null, 2)} 
                        splitView={true}
                        leftTitle={`Versi Arsip`}
                        rightTitle={`Data Saat Ini`}
                        useDarkTheme={false}
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                      <Button
                        variant="outline"
                        onClick={() => setDiffVersionId(null)}
                        className="rounded-xl border-border/80 h-9 text-xs font-bold cursor-pointer"
                      >
                        Tutup Diff
                      </Button>
                      <Button 
                        onClick={() => handleRestore(diffVersionId)}
                        disabled={!!restoring}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-9 px-4 text-xs font-bold shadow-xs cursor-pointer gap-1.5"
                      >
                        {restoring === diffVersionId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        Pulihkan Versi Ini
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : loading ? (
              <div className="flex flex-col items-center justify-center h-[400px] gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Memuat riwayat revisi...</p>
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <div className="w-12 h-12 rounded-2xl border border-border bg-muted/40 flex items-center justify-center">
                  <Clock className="h-6 w-6 opacity-40 text-primary" />
                </div>
                <p className="font-bold text-sm text-foreground">Belum ada riwayat revisi.</p>
                <p className="text-xs text-muted-foreground max-w-xs text-center">
                  Setiap kali Anda menyimpan pembaruan konten, versi baru akan tercatat di sini secara otomatis.
                </p>
              </div>
            ) : (
              <div className="p-5 space-y-3">
                {versions.map((v, i) => (
                  <div 
                    key={v.id} 
                    className={cn(
                      "relative p-4 rounded-2xl border transition-all duration-200",
                      i === 0 
                        ? "border-primary/40 bg-primary/5 shadow-xs" 
                        : "border-border/80 bg-muted/20 hover:border-border hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge 
                            variant={i === 0 ? "default" : "outline"} 
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg",
                              i === 0 
                                ? "bg-primary text-primary-foreground" 
                                : "text-muted-foreground border-border/80"
                            )}
                          >
                            v{v.version} {i === 0 && "• Versi Aktif"}
                          </Badge>
                          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-primary/70" /> {new Date(v.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-foreground mt-1">
                          {v.changeSummary || (v.changeType === 'created' ? 'Pembuatan Awal Konten' : v.changeType === 'restored' ? 'Versi Dipulihkan' : 'Pembaruan Konten')}
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                          <User className="h-3 w-3 text-muted-foreground/70" />
                          <span>Pengubah: <strong className="text-foreground">{v.changedBy ? v.changedBy.substring(0, 12) : 'Sistem'}</strong></span>
                        </div>
                      </div>
                      
                      {i !== 0 && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleDiff(v.id)}
                            className="h-8 rounded-xl border-border/80 bg-background text-xs font-semibold hover:bg-muted transition-all cursor-pointer gap-1"
                          >
                            <FileText className="h-3 w-3 text-primary" />
                            Bandingkan
                          </Button>
                          <Button 
                            size="sm" 
                            variant="secondary" 
                            disabled={!!restoring}
                            onClick={() => handleRestore(v.id)}
                            className="h-8 rounded-xl text-xs font-semibold hover:bg-primary/10 hover:text-primary transition-all cursor-pointer gap-1"
                          >
                            {restoring === v.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3 w-3" />
                            )}
                            Pulihkan
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
