"use client"

import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { 
  Save, Eye, EyeOff, FileText, Plus, Edit2, 
  Trash2, Loader2, Sparkles, Search, X, 
  Layers, Globe, MoreVertical, Layout,
  CheckCircle2, AlertCircle, ShieldCheck, ArrowLeft
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

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
import { deleteSingleTypeAction, saveSingleTypeDataAction } from "@/actions/single-types"

interface SingleType {
  id: string
  name: string
  slug: string
  description: string | null
  fields: any[]
  data: any
  publishedAt: string | null
  updatedAt: string
  isGlobal: boolean
}

interface SingleTypesClientProps {
  initialSingleTypes: SingleType[]
  tenantSlug: string
  limit?: number
  current?: number
  isGlobalTenant?: boolean
}

export function SingleTypesClient({ initialSingleTypes, tenantSlug, limit = 3, current = 0, isGlobalTenant = false }: SingleTypesClientProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()


  const [searchTerm, setSearchTerm] = useState("")
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; singleType: SingleType | null }>({
    open: false,
    singleType: null,
  })
  const [deleteConfirmName, setDeleteConfirmName] = useState("")

  const isSuperAdmin = session?.user?.role === "super_admin"

  const filteredSingleTypes = useMemo(() => {
    return initialSingleTypes.filter(st => 
      st.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      st.slug.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [initialSingleTypes, searchTerm])

  const isLimitReached = useMemo(() => {
    return current >= limit
  }, [current, limit])

  const handlePublishToggle = (singleType: SingleType, publish: boolean) => {
    startTransition(async () => {
      const res = await saveSingleTypeDataAction(tenantSlug, singleType.id, singleType.data, publish)
      if (res.error) {
        toast({ variant: "destructive", title: "Error", description: res.error })
      } else {
        toast({
          title: publish ? "Published!" : "Unpublished",
          description: `${singleType.name} is now ${publish ? 'live' : 'draft'}.`,
          className: publish ? "bg-emerald-50 border-emerald-200 text-emerald-800" : ""
        })
      }
    })
  }

  const handleDeleteClick = (singleType: SingleType) => {
    setDeleteDialog({ open: true, singleType })
    setDeleteConfirmName("")
  }

  const handleDelete = () => {
    if (!deleteDialog.singleType) return
    if (deleteConfirmName !== deleteDialog.singleType.name) {
      toast({ variant: "destructive", title: "Error", description: "Verification name does not match" })
      return
    }

    startTransition(async () => {
      const res = await deleteSingleTypeAction(tenantSlug, deleteDialog.singleType!.id)
      if (res.error) {
        toast({ variant: "destructive", title: "Error", description: res.error })
      } else {
        toast({ title: "Deleted", description: `${deleteDialog.singleType!.name} has been removed.` })
        setDeleteDialog({ open: false, singleType: null })
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
                <h1 className="text-2xl font-black tracking-tight text-foreground">Single Types</h1>
                <Badge variant="secondary" className="text-xs font-bold px-2 py-0.5 rounded-full">
                  {initialSingleTypes.length}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Kelola struktur skema konten tunggal (seperti Beranda, Pengaturan Global, atau Tentang Kami).
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                className="h-9 px-4 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-all"
                onClick={() => router.push(`/dashboard/${tenantSlug}/content-type-builder/single-types/new`)}
                disabled={isLimitReached}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Single Type Baru
              </Button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border border-border/80 bg-card rounded-2xl shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-muted-foreground">Total Skema</p>
                  <p className="text-2xl font-black text-foreground">{initialSingleTypes.length}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Layers className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80 bg-card rounded-2xl shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-muted-foreground">Terpublikasi (Live)</p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {initialSingleTypes.filter(s => s.publishedAt).length}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Globe className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80 bg-card rounded-2xl shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-muted-foreground">Draft</p>
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {initialSingleTypes.filter(s => !s.publishedAt).length}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <FileText className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Limit Alert */}
          {isLimitReached && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="text-xs text-muted-foreground">
                Anda telah mencapai batas maksimum {limit} skema. Hapus skema yang tidak terpakai atau upgrade paket untuk menambah kuota.
              </div>
            </div>
          )}

          {/* Search & List */}
          <div className="space-y-3">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Cari nama atau slug single type..." 
                className="pl-9 h-9 bg-card border-border/80 rounded-xl text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Card className="border border-border/80 bg-card rounded-2xl shadow-xs overflow-hidden">
              <CardContent className="p-0">
                {filteredSingleTypes.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <FileText className="h-8 w-8 mx-auto opacity-30 text-muted-foreground" />
                    <p className="text-xs font-bold text-foreground">Single type tidak ditemukan</p>
                    <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                      {searchTerm ? `Tidak ada hasil untuk "${searchTerm}".` : "Mulai dengan membuat struktur skema single type pertama Anda."}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="text-xs font-bold pl-6">Nama Struktur</TableHead>
                        <TableHead className="text-xs font-bold">API Slug</TableHead>
                        <TableHead className="text-xs font-bold text-center">Field</TableHead>
                        <TableHead className="text-xs font-bold text-center">Status</TableHead>
                        <TableHead className="text-xs font-bold text-center">Terakhir Diperbarui</TableHead>
                        <TableHead className="text-right pr-6"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSingleTypes.map((st) => (
                        <TableRow 
                          key={st.id} 
                          className="group hover:bg-muted/40 transition-colors cursor-pointer border-b border-border/60" 
                          onClick={() => router.push(`/dashboard/${tenantSlug}/content-type-builder/single-types/${st.slug}/edit`)}
                        >
                          <TableCell className="pl-6 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-foreground truncate">{st.name}</span>
                                  {st.isGlobal && (
                                    <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 rounded-full border-primary/30 text-primary">
                                      Global
                                    </Badge>
                                  )}
                                </div>
                                {st.description && <p className="text-[11px] text-muted-foreground truncate max-w-[220px] mt-0.5">{st.description}</p>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <code className="text-[11px] font-mono font-bold bg-muted/60 px-2 py-0.5 rounded-md text-foreground">
                              /{st.slug}
                            </code>
                          </TableCell>
                          <TableCell className="text-center font-bold text-xs text-foreground py-3">
                            {st.fields?.length || 0}
                          </TableCell>
                          <TableCell className="text-center py-3">
                            {st.publishedAt ? (
                              <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                                Live
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Draft
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground font-mono py-3">
                            {st.updatedAt ? new Date(st.updatedAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short' }) : "-"}
                          </TableCell>
                          <TableCell className="text-right pr-6 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1.5 items-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground">
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 rounded-xl">
                                  {(!st.isGlobal || isGlobalTenant) && (
                                    <DropdownMenuItem onClick={() => router.push(`/dashboard/${tenantSlug}/content-type-builder/single-types/${st.slug}/edit`)} className="text-xs cursor-pointer rounded-lg">
                                      <Layout className="mr-2 h-3.5 w-3.5" /> Edit Skema
                                    </DropdownMenuItem>
                                  )}
                                  {(!st.isGlobal || isGlobalTenant) && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handleDeleteClick(st)} className="text-destructive focus:bg-destructive focus:text-destructive-foreground text-xs cursor-pointer rounded-lg">
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

          {/* Governance Footer */}
          <div className="p-3.5 bg-muted/30 border border-border/60 rounded-2xl flex items-start gap-3">
            <ShieldCheck className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              <strong>Single Type</strong> didesain untuk konten halaman tunggal (seperti Beranda, Tentang Kami, atau Pengaturan). Skema kustom bersifat privat untuk workspace ini.
            </div>
          </div>

        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent className="rounded-2xl border border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Hapus Single Type?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tindakan ini akan menghapus skema <strong className="text-foreground font-bold">"{deleteDialog.singleType?.name}"</strong> beserta seluruh datanya secara permanen.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <div className="p-3 bg-destructive/10 rounded-xl border border-destructive/20 text-xs">
              <p className="font-semibold text-destructive">Ketik nama skema persis untuk konfirmasi:</p>
              <p className="font-mono font-bold mt-1 text-foreground">{deleteDialog.singleType?.name}</p>
            </div>
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="Ketik nama skema"
              className="h-9 text-xs rounded-xl"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" className="rounded-xl text-xs" onClick={() => setDeleteDialog({ open: false, singleType: null })}>
              Batal
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl text-xs font-bold"
              onClick={handleDelete}
              disabled={isPending || deleteConfirmName !== deleteDialog.singleType?.name}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
              Hapus Permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
