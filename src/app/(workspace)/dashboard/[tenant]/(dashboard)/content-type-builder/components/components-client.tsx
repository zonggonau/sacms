"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { 
  Plus, MoreVertical, Edit, Trash2, Box, Puzzle, 
  Search, Info, Sparkles, Package, Tags, Loader2, AlertCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { toast } from "@/hooks/use-toast"

import { deleteComponentAction } from "@/actions/components"
import { useRouter } from "next/navigation"

interface Component {
  id: string
  name: string
  slug: string
  description: string | null
  category: string | null
  fields: any[]
  isGlobal?: boolean
  usedByCount?: number
}

interface ComponentsClientProps {
  initialComponents: Component[]
  tenantSlug: string
  limit?: number
  current?: number
}

export function ComponentsClient({ initialComponents, tenantSlug, limit = 3, current = 0 }: ComponentsClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [componentToDelete, setComponentToDelete] = useState<Component | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState("")


  const filteredComponents = useMemo(() => {
    return initialComponents.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.category && c.category.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  }, [initialComponents, searchQuery])

  const isLimitReached = useMemo(() => {
    return current >= limit
  }, [current, limit])

  const handleDeleteClick = (component: Component) => {
    setComponentToDelete(component)
    setDeleteConfirmName("")
  }

  const handleDelete = async () => {
    if (!componentToDelete) return
    if (deleteConfirmName !== componentToDelete.name) {
      toast({ variant: "destructive", title: "Verifikasi Gagal", description: "Nama verifikasi tidak sesuai" })
      return
    }

    setIsDeleting(true)
    try {
      const response = await deleteComponentAction(tenantSlug, componentToDelete.id)
      if (response.error) throw new Error(response.error)
      toast({ title: "Komponen Dihapus", description: `${componentToDelete.name} telah berhasil dihapus.` })
      router.refresh()
    } catch (error: any) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: error.message || "Gagal menghapus komponen" })
    } finally {
      setIsDeleting(false)
      setComponentToDelete(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black tracking-tight text-foreground">Components</h1>
                <Badge variant="secondary" className="text-xs font-bold px-2 py-0.5 rounded-full">
                  {initialComponents.length}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Struktur data modular yang dapat disematkan berulang kali ke dalam berbagai tipe konten.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                className="h-9 px-4 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-all"
                disabled={isLimitReached}
                asChild={!isLimitReached}
              >
                {isLimitReached ? (
                  <span>
                    <Plus className="mr-1.5 h-4 w-4" /> Buat Komponen
                  </span>
                ) : (
                  <Link href={`/dashboard/${tenantSlug}/content-type-builder/components/new`}>
                    <Plus className="mr-1.5 h-4 w-4" /> Buat Komponen
                  </Link>
                )}
              </Button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border border-border/80 bg-card rounded-2xl shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-muted-foreground">Total Komponen</p>
                  <p className="text-2xl font-black text-foreground">{initialComponents.length}</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Puzzle className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80 bg-card rounded-2xl shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-muted-foreground">Kategori</p>
                  <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
                    {new Set(initialComponents.map(c => c.category).filter(Boolean)).size}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Tags className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80 bg-card rounded-2xl shadow-xs">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-muted-foreground">Komponen Global</p>
                  <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {initialComponents.filter(c => c.isGlobal).length}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Package className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Limit Alert */}
          {isLimitReached && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="text-xs text-muted-foreground">
                Anda telah mencapai batas maksimum {limit} skema. Hapus komponen yang tidak terpakai atau upgrade paket untuk menambah kuota.
              </div>
            </div>
          )}

          {/* Search & List */}
          <div className="space-y-3">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Cari nama komponen atau kategori..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-card border-border/80 rounded-xl text-xs" 
              />
            </div>

            <Card className="border border-border/80 bg-card rounded-2xl shadow-xs overflow-hidden">
              <CardContent className="p-0">
                {filteredComponents.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <Puzzle className="h-8 w-8 mx-auto opacity-30 text-muted-foreground" />
                    <p className="text-xs font-bold text-foreground">Komponen tidak ditemukan</p>
                    <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                      Komponen membantu Anda menyusun struktur data bertingkat seperti blok SEO, alamat, atau section layout.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="text-xs font-bold pl-6">Nama Komponen</TableHead>
                        <TableHead className="text-xs font-bold">Kategori</TableHead>
                        <TableHead className="text-xs font-bold text-center">Jumlah Field</TableHead>
                        <TableHead className="text-right pr-6"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredComponents.map((component) => (
                        <TableRow 
                          key={component.id} 
                          className="group hover:bg-muted/40 transition-colors border-b border-border/60"
                        >
                          <TableCell className="pl-6 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                <Box className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <Link 
                                    href={`/dashboard/${tenantSlug}/content-type-builder/components/${component.slug}`}
                                    className="text-xs font-bold text-foreground hover:text-primary transition-colors"
                                  >
                                    {component.name}
                                  </Link>
                                  {component.usedByCount !== undefined && component.usedByCount > 0 && (
                                    <Badge variant="outline" className="text-[9px] h-4 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 rounded-full">
                                      Digunakan {component.usedByCount}x
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-[10px] font-mono text-muted-foreground uppercase">{component.slug}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            {component.category ? (
                              <Badge variant="outline" className="text-[10px] font-semibold rounded-full px-2 py-0.5 border-border">
                                {component.category}
                              </Badge>
                            ) : (
                              <span className="text-[11px] italic text-muted-foreground opacity-50">Tanpa kategori</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <Badge variant="secondary" className="font-bold text-[10px] rounded-full px-2 py-0.5">
                              {component.fields.length}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground">
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                                <DropdownMenuItem asChild className="text-xs cursor-pointer rounded-lg">
                                  <Link href={`/dashboard/${tenantSlug}/content-type-builder/components/${component.slug}`}>
                                    <Edit className="mr-2 h-3.5 w-3.5" /> Edit Skema
                                  </Link>
                                </DropdownMenuItem>
                                {!component.isGlobal && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      className="text-destructive focus:bg-destructive focus:text-destructive-foreground text-xs cursor-pointer rounded-lg"
                                      onClick={() => handleDeleteClick(component)}
                                    >
                                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Hapus Komponen
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Guidelines Banner */}
          <div className="p-3.5 bg-muted/30 border border-border/60 rounded-2xl flex items-start gap-3">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              <strong>Komponen</strong> adalah struktur data modular yang dapat disematkan berulang kali ke berbagai Content Types (misal: Meta SEO, Alamat Kontak, atau Social Links).
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!componentToDelete} onOpenChange={(open) => {
        if (!open) setComponentToDelete(null)
      }}>
        <DialogContent className="rounded-2xl border border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Hapus Komponen?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Apakah Anda yakin ingin menghapus komponen <strong className="text-foreground font-bold">"{componentToDelete?.name}"</strong>? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            {componentToDelete?.usedByCount !== undefined && componentToDelete.usedByCount > 0 && (
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30 text-xs">
                <p className="font-bold text-amber-600 dark:text-amber-400">
                  ⚠️ Peringatan: Komponen Sedang Digunakan
                </p>
                <p className="text-muted-foreground mt-1">
                  Komponen ini digunakan pada <strong>{componentToDelete.usedByCount}</strong> field di skema Anda.
                </p>
              </div>
            )}
            <div className="p-3 bg-destructive/10 rounded-xl border border-destructive/20 text-xs">
              <p className="font-semibold text-destructive">Ketik nama komponen persis untuk konfirmasi:</p>
              <p className="font-mono font-bold mt-1 text-foreground">{componentToDelete?.name}</p>
            </div>
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="Ketik nama komponen"
              className="h-9 text-xs rounded-xl"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" className="rounded-xl text-xs" onClick={() => setComponentToDelete(null)}>
              Batal
            </Button>
            <Button 
              variant="destructive"
              className="rounded-xl text-xs font-bold"
              onClick={handleDelete}
              disabled={isDeleting || deleteConfirmName !== componentToDelete?.name}
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
              Hapus Permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
