"use client"

import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Plus, MoreVertical, Edit, Trash2, FileText, Database,
  Globe, Layout, Loader2, Search, CheckCircle2, AlertCircle, Sparkles
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

import { deleteContentTypeAction } from "@/actions/content-types"

interface ContentType {
  id: string
  name: string
  slug: string
  description: string | null
  isPublished: boolean
  isGlobal: boolean
  fields: any[]
  entryCount: number
}

interface ContentTypesClientProps {
  initialContentTypes: ContentType[]
  tenantSlug: string
  limit?: number
  current?: number
  isGlobalTenant?: boolean
}

export function ContentTypesClient({ initialContentTypes, tenantSlug, limit = 3, current = 0, isGlobalTenant = false }: ContentTypesClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [searchQuery, setSearchQuery] = useState("")


  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; contentType: ContentType | null }>({
    open: false,
    contentType: null,
  })
  const [deleteConfirmName, setDeleteConfirmName] = useState("")

  const filteredTypes = useMemo(() => {
    return initialContentTypes.filter(ct =>
      ct.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ct.slug.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [initialContentTypes, searchQuery])

  const isLimitReached = useMemo(() => {
    const customCount = initialContentTypes.filter(c => !c.isGlobal).length
    return customCount >= limit
  }, [initialContentTypes, limit])

  const handleDeleteClick = (contentType: ContentType) => {
    setDeleteDialog({ open: true, contentType })
    setDeleteConfirmName("")
  }

  const handleDelete = () => {
    if (!deleteDialog.contentType) return
    if (deleteConfirmName !== deleteDialog.contentType.name) {
      toast({ variant: "destructive", title: "Verifikasi Gagal", description: "Nama verifikasi tidak cocok" })
      return
    }

    startTransition(async () => {
      const res = await deleteContentTypeAction(tenantSlug, deleteDialog.contentType!.id)
      if (res.error) {
        toast({ variant: "destructive", title: "Terjadi Kesalahan", description: res.error })
      } else {
        toast({ title: "Berhasil", description: "Content type berhasil dihapus" })
        setDeleteDialog({ open: false, contentType: null })
      }
    })
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black tracking-tight text-foreground">Collection Types</h1>
                <Badge variant="secondary" className="text-xs font-bold px-2 py-0.5 rounded-full">
                  {initialContentTypes.length}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Kelola struktur skema koleksi multi-entri (seperti Artikel, Produk, atau Pengguna).</p>
            </div>
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                className="h-9 px-3.5 text-xs font-bold rounded-xl border-border/80 text-foreground hover:bg-muted shadow-xs transition-all flex items-center gap-1.5"
                onClick={() => router.push(`/dashboard/${tenantSlug}/cms`)}
                title="Buka CMS Studio untuk mengelola konten dan entri data"
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                <span>Buka CMS Studio</span>
              </Button>

              <Button
                className="h-9 px-4 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-all"
                onClick={() => router.push(`/dashboard/${tenantSlug}/content-type-builder/content-types/new`)}
                disabled={isLimitReached}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Skema Baru
              </Button>
            </div>
          </div>

          {/* Schema Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border border-border/80 bg-card rounded-2xl shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-muted-foreground">Total Skema</p>
                  <p className="text-2xl font-black text-foreground">{initialContentTypes.length}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Layout className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80 bg-card rounded-2xl shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-muted-foreground">Skema Sistem</p>
                  <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
                    {initialContentTypes.filter(c => c.isGlobal).length}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Globe className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80 bg-card rounded-2xl shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-muted-foreground">Skema Workspace</p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {initialContentTypes.filter(c => !c.isGlobal).length} <span className="text-xs font-normal text-muted-foreground">/ {limit >= 999999 ? "∞" : limit}</span>
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Database className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Limit Alert */}
          {isLimitReached && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="text-xs text-muted-foreground">
                Anda telah mencapai batas maksimum {limit} skema tipe konten. Hapus skema lama atau upgrade paket untuk menambah kuota.
              </div>
            </div>
          )}

          {/* Filter & List Area */}
          <div className="space-y-3">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari skema koleksi..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-card border-border/80 rounded-xl text-xs"
              />
            </div>

            <Card className="border border-border/80 bg-card rounded-2xl shadow-xs overflow-hidden">
              <CardContent className="p-0">
                {filteredTypes.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <Database className="h-8 w-8 mx-auto opacity-30 text-muted-foreground" />
                    <p className="text-xs font-bold text-foreground">Skema tidak ditemukan</p>
                    <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                      Mulai dengan membuat skema koleksi kustom untuk workspace Anda.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="text-xs font-bold pl-6">Nama Struktur</TableHead>
                        <TableHead className="text-xs font-bold">Sumber</TableHead>
                        <TableHead className="text-xs font-bold text-center">Field</TableHead>
                        <TableHead className="text-xs font-bold text-center">Total Entri</TableHead>
                        <TableHead className="text-xs font-bold text-center">Status</TableHead>
                        <TableHead className="text-right pr-6"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTypes.map((ct) => (
                        <TableRow
                          key={ct.id}
                          className="group hover:bg-muted/40 transition-colors cursor-pointer border-b border-border/60"
                          onClick={() => router.push(`/dashboard/${tenantSlug}/content-type-builder/content-types/edit/${ct.slug}`)}
                        >
                          <TableCell className="pl-6 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-foreground">{ct.name}</span>
                                <p className="text-[10px] font-mono text-muted-foreground uppercase">{ct.slug}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            {ct.isGlobal ? (
                              <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 px-2">SISTEM</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-2">KUSTOM</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-bold text-xs text-foreground py-3">{ct.fields?.length || 0}</TableCell>
                          <TableCell className="text-center py-3">
                            <Badge variant="secondary" className="font-bold text-[10px] rounded-full px-2 py-0.5">{ct.entryCount?.toLocaleString() || 0}</Badge>
                          </TableCell>
                          <TableCell className="text-center py-3">
                            {ct.isPublished ? (
                              <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">Live</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5 rounded-full">Draft</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right pr-6 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2.5 text-[11px] font-bold rounded-lg gap-1.5 border-border/80 text-foreground hover:bg-muted shadow-xs"
                                onClick={() => router.push(`/dashboard/${tenantSlug}/cms/content/${ct.slug}`)}
                                title={`Buka entri ${ct.name} di CMS Studio`}
                              >
                                <FileText className="h-3 w-3 text-primary" />
                                <span>Kelola Konten</span>
                              </Button>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground">
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 rounded-xl">
                                  <DropdownMenuItem onClick={() => router.push(`/dashboard/${tenantSlug}/content-type-builder/content-types/edit/${ct.slug}`)} className="text-xs cursor-pointer rounded-lg">
                                    <Edit className="mr-2 h-3.5 w-3.5" /> Edit Skema
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => router.push(`/dashboard/${tenantSlug}/cms/content/${ct.slug}`)} className="text-xs cursor-pointer rounded-lg">
                                    <Layout className="mr-2 h-3.5 w-3.5" /> Buka Entri CMS
                                  </DropdownMenuItem>
                                  {(!ct.isGlobal || isGlobalTenant) && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handleDeleteClick(ct)} className="text-destructive focus:bg-destructive focus:text-destructive-foreground text-xs cursor-pointer rounded-lg">
                                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Hapus Skema
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, contentType: null })}>
        <DialogContent className="rounded-2xl border border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Hapus Tipe Konten?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tindakan ini akan menghapus skema <strong className="text-foreground font-bold">"{deleteDialog.contentType?.name}"</strong> beserta seluruh data entrinya secara permanen.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-2">
            <div className="p-3 bg-destructive/10 rounded-xl border border-destructive/20 text-xs">
              <p className="font-semibold text-destructive">Ketik nama skema persis untuk konfirmasi:</p>
              <p className="font-mono font-bold mt-1 text-foreground">{deleteDialog.contentType?.name}</p>
            </div>
            
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="Ketik nama skema"
              className="h-9 text-xs rounded-xl"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              className="rounded-xl text-xs"
              onClick={() => setDeleteDialog({ open: false, contentType: null })}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl text-xs font-bold"
              onClick={handleDelete}
              disabled={deleteConfirmName !== deleteDialog.contentType?.name || isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Menghapus...
                </>
              ) : (
                "Hapus Permanen"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
