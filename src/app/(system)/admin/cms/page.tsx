"use client"

import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Loader2,
  Save,
  Plus,
  Trash2,
  ExternalLink,
  Newspaper,
  BookOpen,
  Monitor,
  Download,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { getCmsLandingDataAction, updateCmsLandingSectionAction } from "@/actions/cms-frontend"
import { CMS_SECTIONS } from "./cms-section-config"
import { CmsFieldInput } from "./cms-field-input"

type SectionData = Record<string, any>

export default function AdminCmsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SectionData>({})
  const [activeKey, setActiveKey] = useState(CMS_SECTIONS[0].key)
  const [saving, setSaving] = useState(false)
  const [savingAll, setSavingAll] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  const isAdmin = session?.user?.role === "super_admin"

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if (!isAdmin) return
    ;(async () => {
      const res = await getCmsLandingDataAction()
      if ("error" in res) {
        toast({ variant: "destructive", title: "Gagal", description: res.error })
      } else {
        setData(res.data)
      }
      setLoading(false)
    })()
  }, [isAdmin])

  const activeSection = CMS_SECTIONS.find((s) => s.key === activeKey)!

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await updateCmsLandingSectionAction(activeKey, data[activeKey])
      if ("error" in res && res.error) {
        toast({ variant: "destructive", title: "Gagal Menyimpan", description: res.error })
      } else {
        toast({ title: "Berhasil", description: `Section "${activeSection.label}" tersimpan dan langsung tampil di website.` })
      }
    } catch {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Terjadi kesalahan jaringan" })
    } finally {
      setSaving(false)
    }
  }

  const updateObjectField = (fieldKey: string, value: unknown) => {
    setData((prev) => ({ ...prev, [activeKey]: { ...prev[activeKey], [fieldKey]: value } }))
  }

  const updateArrayItemField = (index: number, fieldKey: string, value: unknown) => {
    setData((prev) => {
      const items = [...(prev[activeKey] || [])]
      items[index] = { ...items[index], [fieldKey]: value }
      return { ...prev, [activeKey]: items }
    })
  }

  const addArrayItem = () => {
    setData((prev) => ({ ...prev, [activeKey]: [...(prev[activeKey] || []), {}] }))
  }

  const removeArrayItem = (index: number) => {
    setData((prev) => {
      const items = [...(prev[activeKey] || [])]
      items.splice(index, 1)
      return { ...prev, [activeKey]: items }
    })
  }

  /** Export every section combined into one JSON file — keyed by each
   *  CMS_SECTIONS section's own `key`, so a round-trip import (below) can
   *  split it back out per section automatically. */
  const handleExport = () => {
    const payload: SectionData = {}
    for (const s of CMS_SECTIONS) {
      payload[s.key] = data[s.key] ?? (s.kind === "array" ? [] : {})
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "cms-landing-page.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)

      if (Array.isArray(parsed) || typeof parsed !== "object" || parsed === null) {
        toast({ variant: "destructive", title: "Format Salah", description: "File harus berupa satu object JSON berisi semua section (hasil Export)." })
        return
      }

      const updates: SectionData = {}
      const skipped: string[] = []

      for (const s of CMS_SECTIONS) {
        if (!(s.key in parsed)) continue
        const value = parsed[s.key]
        const validShape = s.kind === "array" ? Array.isArray(value) : (typeof value === "object" && value !== null && !Array.isArray(value))
        if (!validShape) {
          skipped.push(s.label)
          continue
        }
        updates[s.key] = value
      }

      if (Object.keys(updates).length === 0) {
        toast({ variant: "destructive", title: "Tidak Ada Section Dikenali", description: "File tidak berisi key section yang cocok (hero, features, faqs, dst)." })
        return
      }

      setData((prev) => ({ ...prev, ...updates }))
      const count = Object.keys(updates).length
      toast({
        title: "Import Berhasil",
        description: skipped.length > 0
          ? `${count} section diperbarui dari file. Dilewati (format salah): ${skipped.join(", ")}. Klik Simpan Semua untuk menerapkannya ke website.`
          : `${count} section diperbarui dari file. Klik Simpan Semua untuk menerapkannya ke website.`,
      })
    } catch {
      toast({ variant: "destructive", title: "Gagal Import", description: "File bukan JSON yang valid." })
    }
  }

  const handleSaveAll = async () => {
    setSavingAll(true)
    try {
      const failed: string[] = []
      for (const s of CMS_SECTIONS) {
        const res = await updateCmsLandingSectionAction(s.key, data[s.key])
        if ("error" in res && res.error) failed.push(s.label)
      }
      if (failed.length > 0) {
        toast({ variant: "destructive", title: "Sebagian Gagal Disimpan", description: `Gagal: ${failed.join(", ")}` })
      } else {
        toast({ title: "Semua Section Tersimpan", description: "Seluruh section tersimpan dan langsung tampil di website." })
      }
    } catch {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Terjadi kesalahan jaringan" })
    } finally {
      setSavingAll(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-center text-muted-foreground p-6">
        <p>Akses dibatasi khusus untuk Super Administrator.</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 border-b border-border bg-card px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shrink-0" asChild>
            <Link href="/admin/tenants"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0">
            <p className="text-sm font-black tracking-tight truncate">CMS Frontend</p>
            <p className="text-[10px] text-muted-foreground truncate">Kelola konten halaman publik SaCMS</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild className="h-8 rounded-lg text-[11px] font-bold border-border/80">
            <a href="/" target="_blank" rel="noreferrer">
              <Monitor className="h-3.5 w-3.5 mr-1.5" /> Lihat Website
            </a>
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImportFile(file)
              e.target.value = ""
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => importInputRef.current?.click()}
            className="h-8 rounded-lg text-[11px] font-bold border-border/80"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Import JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="h-8 rounded-lg text-[11px] font-bold border-border/80">
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveAll}
            disabled={savingAll}
            className="h-8 rounded-lg text-[11px] font-bold border-border/80"
          >
            {savingAll ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
            Simpan Semua
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 rounded-lg text-[11px] font-bold">
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Simpan
          </Button>
        </div>
      </div>

      {/* Body: section nav + editor, no route change between sections (SPA) */}
      <div className="flex-1 flex min-h-0">
        <nav className="w-60 shrink-0 border-r border-border bg-card/40 overflow-y-auto py-3 px-2.5 space-y-0.5">
          {CMS_SECTIONS.map((s) => {
            const Icon = s.icon
            const active = s.key === activeKey
            return (
              <button
                key={s.key}
                onClick={() => setActiveKey(s.key)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-colors text-left",
                  active ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{s.label}</span>
              </button>
            )
          })}

          <div className="pt-2 mt-2 border-t border-border/60 space-y-0.5">
            <a
              href="/admin/cms/blog"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-colors text-left text-muted-foreground hover:text-foreground hover:bg-muted/60"
            >
              <Newspaper className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate flex-1">Blog</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
            </a>
            <a
              href="/docs"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-colors text-left text-muted-foreground hover:text-foreground hover:bg-muted/60"
            >
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate flex-1">Dokumentasi</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
            </a>
          </div>
        </nav>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-6 space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">{activeSection.label}</h2>
                <Badge variant="outline" className="text-[9px] font-bold rounded-full">
                  {activeSection.kind === "array" ? `${(data[activeKey] || []).length} item` : "1 section"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{activeSection.description}</p>
            </div>

            {activeSection.kind === "object" ? (
              <Card className="rounded-2xl border border-border/80 shadow-xs">
                <CardContent className="p-5 space-y-4">
                  {activeSection.fields.map((f) => (
                    <CmsFieldInput
                      key={f.key}
                      field={f}
                      value={data[activeKey]?.[f.key]}
                      onChange={(v) => updateObjectField(f.key, v)}
                    />
                  ))}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {(data[activeKey] || []).map((item: any, idx: number) => (
                  <Card key={idx} className="rounded-2xl border border-border/80 shadow-xs">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px] font-bold rounded-full">
                          {activeSection.itemLabelField && item[activeSection.itemLabelField]
                            ? item[activeSection.itemLabelField]
                            : `Item ${idx + 1}`}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeArrayItem(idx)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {activeSection.fields.map((f) => (
                        <CmsFieldInput
                          key={f.key}
                          field={f}
                          value={item[f.key]}
                          onChange={(v) => updateArrayItemField(idx, f.key, v)}
                        />
                      ))}
                    </CardContent>
                  </Card>
                ))}

                <Button
                  variant="outline"
                  onClick={addArrayItem}
                  className="w-full h-10 rounded-xl text-xs font-bold border-dashed border-border"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Item
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
