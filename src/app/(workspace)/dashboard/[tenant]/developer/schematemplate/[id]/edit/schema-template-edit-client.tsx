"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowLeft, Wand2, Save, Loader2, DatabaseIcon, FileText, Puzzle, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface DraftItem {
  slug: string
  name: string
}

interface SchemaTemplateEditClientProps {
  tenantSlug: string
  template: {
    id: string
    name: string
    category: string
    icon: string
    description: string | null
    published: boolean
  }
  isMaterialized: boolean
  draftContentTypes: DraftItem[]
  draftSingleTypes: DraftItem[]
  draftComponents: DraftItem[]
}

function DraftList({
  title,
  icon: Icon,
  items,
  hrefFor,
}: {
  title: string
  icon: typeof DatabaseIcon
  items: DraftItem[]
  hrefFor: (slug: string) => string
}) {
  if (items.length === 0) return null
  return (
    <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-primary" /> {title} ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-1.5">
        {items.map((item) => (
          <Link
            key={item.slug}
            href={hrefFor(item.slug)}
            target="_blank"
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-muted/30 hover:bg-primary/10 hover:text-primary text-xs font-semibold text-foreground transition-colors"
          >
            <span>{item.name}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

export function SchemaTemplateEditClient({
  tenantSlug,
  template,
  isMaterialized,
  draftContentTypes,
  draftSingleTypes,
  draftComponents,
}: SchemaTemplateEditClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isMaterializing, setIsMaterializing] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const handleMaterialize = async () => {
    setIsMaterializing(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/schema-templates/${template.id}/materialize`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Gagal menyiapkan detail schema")
      toast({ title: "Siap Diedit", description: "Content Type/Single Type/Component dari template ini sudah dibuat sebagai draft — klik untuk edit detailnya." })
      router.refresh()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message })
    } finally {
      setIsMaterializing(false)
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/schema-templates/${template.id}/sync`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan perubahan ke template")
      toast({ title: "Template Diperbarui", description: "Perubahan detail schema sudah disimpan ke template." })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message })
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-4 w-full max-w-full">
      <Link
        href={`/dashboard/${tenantSlug}/developer/schematemplate`}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors shrink-0"
      >
        <ArrowLeft className="h-3 w-3" /> Kembali ke Daftar Template
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{template.icon}</span>
            <h1 className="text-2xl font-black tracking-tight text-foreground">{template.name}</h1>
            <Badge variant="outline" className="text-[10px] font-bold">{template.category}</Badge>
            <Badge className={template.published ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold" : "bg-muted text-muted-foreground text-[10px] font-bold"}>
              {template.published ? "Published" : "Draft"}
            </Badge>
          </div>
          {template.description && <p className="text-xs text-muted-foreground mt-1">{template.description}</p>}
        </div>
        {isMaterialized && (
          <Button onClick={handleSync} disabled={isSyncing} className="h-9 gap-1.5 font-bold text-xs rounded-xl shadow-xs shrink-0">
            {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Simpan ke Template
          </Button>
        )}
      </div>

      {!isMaterialized ? (
        <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
          <CardContent className="p-8 text-center space-y-3">
            <Wand2 className="h-8 w-8 mx-auto text-primary/60" />
            <CardTitle className="text-sm font-bold">Siapkan Detail untuk Diedit</CardTitle>
            <CardDescription className="text-xs max-w-md mx-auto">
              Supaya bisa memastikan relasi dan tipe field benar-benar siap dipakai, template ini perlu dibuat sebagai Content Type/Single Type/Component sungguhan (hanya terlihat di sini, tidak muncul di daftar schema utama) — lalu Anda edit lewat halaman builder yang biasa dipakai.
            </CardDescription>
            <Button onClick={handleMaterialize} disabled={isMaterializing} className="h-9 gap-1.5 font-bold text-xs rounded-xl shadow-xs">
              {isMaterializing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Mulai Edit Detail
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DraftList
            title="Content Types"
            icon={DatabaseIcon}
            items={draftContentTypes}
            hrefFor={(slug) => `/dashboard/${tenantSlug}/developer/conten-type/edit/${slug}`}
          />
          <DraftList
            title="Single Types"
            icon={FileText}
            items={draftSingleTypes}
            hrefFor={(slug) => `/dashboard/${tenantSlug}/developer/single-type/${slug}/edit`}
          />
          <DraftList
            title="Components"
            icon={Puzzle}
            items={draftComponents}
            hrefFor={(slug) => `/dashboard/${tenantSlug}/developer/component/${slug}/edit`}
          />
        </div>
      )}
    </div>
  )
}
