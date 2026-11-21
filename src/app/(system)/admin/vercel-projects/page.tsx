"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  Rocket,
  Search,
  RefreshCw,
  Trash2,
  Building2,
  ExternalLink,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Wand2,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

interface VercelProjectItem {
  id: string
  name: string
  framework: string | null
  nodeVersion: string | null
  url: string
  latestDeploymentState: string | null
  latestDeploymentUrl: string | null
  latestDeploymentAt: number | null
  createdAt: number | null
  gitRepo: string | null
  tenant: { id: string; name: string; slug: string } | null
}

function stateBadge(state: string | null) {
  if (!state) {
    return (
      <Badge variant="outline" className="text-[10px] font-bold rounded-full text-muted-foreground border-border/70">
        Belum Deploy
      </Badge>
    )
  }
  const s = state.toUpperCase()
  if (s === "READY") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold rounded-full">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Ready
      </Badge>
    )
  }
  if (s === "ERROR" || s === "CANCELED") {
    return (
      <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] font-bold rounded-full">
        <XCircle className="h-3 w-3 mr-1" /> {s}
      </Badge>
    )
  }
  return (
    <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-bold rounded-full">
      <Clock className="h-3 w-3 mr-1" /> {s}
    </Badge>
  )
}

export default function AdminVercelProjectsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [projects, setProjects] = useState<VercelProjectItem[]>([])
  const [configured, setConfigured] = useState(true)
  const [orphanedCount, setOrphanedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(20)

  const [projectToDelete, setProjectToDelete] = useState<VercelProjectItem | null>(null)
  const [confirmText, setConfirmText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const isAdmin = session?.user?.role === "super_admin"

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/admin/vercel-projects")
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects || [])
        setConfigured(data.configured !== false)
        setOrphanedCount(data.orphanedCount || 0)
      } else {
        toast({ variant: "destructive", title: "Gagal", description: "Gagal memuat daftar project Vercel" })
      }
    } catch {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Terjadi kesalahan jaringan" })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (isAdmin) fetchProjects()
  }, [isAdmin])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.tenant?.name.toLowerCase().includes(q) ||
      p.tenant?.slug.toLowerCase().includes(q) ||
      p.url.toLowerCase().includes(q)
    )
  }, [projects, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize]
  )

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value))
    setPage(1)
  }

  const openDeleteDialog = (project: VercelProjectItem) => {
    setProjectToDelete(project)
    setConfirmText("")
  }

  const handleDelete = async () => {
    if (!projectToDelete) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/admin/vercel-projects?id=${encodeURIComponent(projectToDelete.id)}&name=${encodeURIComponent(projectToDelete.name)}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast({ title: "Berhasil", description: `Project ${projectToDelete.name} dihapus dari Vercel.` })
        setProjectToDelete(null)
        fetchProjects()
      } else {
        const err = await res.json().catch(() => ({}))
        toast({ variant: "destructive", title: "Gagal", description: err.error || "Gagal menghapus project" })
      }
    } catch {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Terjadi kesalahan jaringan" })
    } finally {
      setIsDeleting(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex flex-1 min-h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-center text-muted-foreground">
        <p>Akses dibatasi khusus untuk Super Administrator.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">Project Vercel</h1>
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20 rounded-full">
                  Hosting
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                Seluruh project pada akun/team Vercel yang terhubung, lintas semua workspace.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setRefreshing(true); fetchProjects() }}
                disabled={refreshing}
                className="rounded-xl h-9 text-xs font-bold shadow-xs border-border/80"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
                Muat Ulang
              </Button>
            </div>
          </div>

          {!configured && (
            <div className="flex items-start gap-2 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Vercel Access Token belum dikonfigurasi di Admin &gt; Platform Settings &gt; Mesin AI. Daftar project tidak dapat dimuat.</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-5">
                <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Project</CardTitle>
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Rocket className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="text-2xl font-black text-foreground tracking-tight">{projects.length}</div>
                <p className="text-[11px] text-muted-foreground mt-1">Project terdaftar pada akun Vercel</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-emerald-500/20 bg-card shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-5">
                <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Terhubung Workspace</CardTitle>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Building2 className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">{projects.length - orphanedCount}</div>
                <p className="text-[11px] text-muted-foreground mt-1">Dimiliki oleh tenant aktif</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-amber-500/20 bg-card shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-5">
                <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Orphan (Tanpa Tenant)</CardTitle>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">{orphanedCount}</div>
                <p className="text-[11px] text-muted-foreground mt-1">Tidak terkait workspace manapun — aman dibersihkan</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cari nama project, workspace, atau URL..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 h-9 rounded-xl text-xs bg-muted/20 border-border/80"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground font-medium">Tampilkan</span>
              <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="h-9 w-[72px] rounded-xl text-xs bg-muted/20 border-border/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="border border-border/80 shadow-xs overflow-hidden rounded-2xl bg-card">
            <Table className="border-collapse">
              <TableHeader>
                <TableRow className="bg-muted/30 border-b border-border/60 hover:bg-muted/30">
                  <TableHead className="p-4 h-auto text-left text-xs font-bold uppercase tracking-wider text-muted-foreground min-w-[220px]">Project</TableHead>
                  <TableHead className="p-4 h-auto text-left text-xs font-bold uppercase tracking-wider text-muted-foreground min-w-[180px]">Workspace Tenant</TableHead>
                  <TableHead className="p-4 h-auto text-center text-xs font-bold uppercase tracking-wider text-muted-foreground min-w-[120px]">Status Deploy</TableHead>
                  <TableHead className="p-4 h-auto text-left text-xs font-bold uppercase tracking-wider text-muted-foreground min-w-[140px]">Dibuat</TableHead>
                  <TableHead className="p-4 h-auto text-right text-xs font-bold uppercase tracking-wider text-muted-foreground min-w-[100px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/40">
                {paginated.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="p-12 text-center text-muted-foreground whitespace-normal">
                      <Rocket className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-xs font-semibold">
                        {projects.length === 0 ? "Tidak ada project di akun Vercel" : "Tidak ada project yang cocok dengan pencarian"}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/10 transition-colors border-b-0">
                      <TableCell className="p-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Rocket className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-foreground font-mono truncate">{p.name}</span>
                              {p.url && (
                                <a href={p.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            {p.framework && (
                              <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 h-4 border-border/60 text-muted-foreground mt-0.5">
                                {p.framework}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="p-4 whitespace-normal">
                        {p.tenant ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <div>
                              <p className="text-xs font-bold text-foreground">{p.tenant.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">/{p.tenant.slug}</p>
                            </div>
                          </div>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-bold rounded-full">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Orphan
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="p-4 text-center">{stateBadge(p.latestDeploymentState)}</TableCell>
                      <TableCell className="p-4 text-xs text-muted-foreground">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                      </TableCell>
                      <TableCell className="p-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(p)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {filtered.length > 0 && (
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-muted-foreground">
                Menampilkan <span className="font-bold text-foreground">{paginated.length}</span> dari <span className="font-bold text-foreground">{filtered.length}</span> project &bull; Halaman <span className="font-bold text-foreground">{currentPage}</span> dari <span className="font-bold text-foreground">{totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DELETE CONFIRMATION — type the exact project name to confirm, or
          click "Isi Otomatis" to fill it in automatically. Irreversible on
          Vercel's side, so no shortcut that skips the explicit match. */}
      <Dialog
        open={!!projectToDelete}
        onOpenChange={(open) => { if (!open) { setProjectToDelete(null); setConfirmText("") } }}
      >
        <DialogContent className="rounded-2xl border border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Hapus Project Vercel?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Project <strong className="text-foreground font-bold">{projectToDelete?.name}</strong>
              {projectToDelete?.tenant ? (
                <> milik workspace <strong className="text-foreground font-bold">{projectToDelete.tenant.name}</strong></>
              ) : null} beserta seluruh riwayat deployment-nya akan dihapus permanen di Vercel. Tidak bisa dibatalkan.
              {projectToDelete?.tenant && " Website workspace tersebut akan offline sampai di-deploy ulang."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-3 bg-destructive/10 rounded-xl border border-destructive/20 text-xs">
              <p className="font-semibold text-destructive">Ketik nama project persis untuk konfirmasi:</p>
              <p className="font-mono font-bold mt-1 text-foreground">{projectToDelete?.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Ketik nama project"
                className="h-9 text-xs rounded-xl font-mono flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmText(projectToDelete?.name || "")}
                className="h-9 text-[11px] font-bold rounded-xl border-border/80 shrink-0"
              >
                <Wand2 className="h-3 w-3 mr-1" /> Isi Otomatis
              </Button>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setProjectToDelete(null); setConfirmText("") }}
              className="rounded-xl h-9 text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting || confirmText !== projectToDelete?.name}
              onClick={handleDelete}
              className="rounded-xl h-9 text-xs font-bold"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
              {isDeleting ? "Menghapus..." : "Hapus Permanen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
