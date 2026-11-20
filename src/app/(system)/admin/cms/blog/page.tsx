"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Newspaper,
  ImageIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { MediaLibraryDialog } from "@/components/media-library-dialog"
import { useToast } from "@/hooks/use-toast"
import {
  listCmsBlogPostsAction,
  createCmsBlogPostAction,
  updateCmsBlogPostAction,
  deleteCmsBlogPostAction,
} from "@/actions/cms-frontend"

// quill/quill-cursors reference the browser-only `self` global at module
// top-level — loading them on the server (even for a "use client" page's
// initial SSR pass) crashes with "self is not defined". Same fix already
// used by src/components/content/field-renderers/rich-text-field.tsx.
const RichTextEditor = dynamic(() => import("@/components/rich-text-editor").then((mod) => mod.RichTextEditor), { ssr: false })

const CATEGORIES = ["Berita", "Artikel", "Pengumuman"]

interface BlogPost {
  id: string
  status: string
  title?: string
  slug?: string
  content?: string
  category?: string
  cover_image?: string
  updatedAt: string | Date
}

const EMPTY_FORM = { title: "", slug: "", content: "", category: "Artikel", cover_image: "" }

function slugify(text: string) {
  return text.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-")
}

export default function AdminCmsBlogPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [publishOnSave, setPublishOnSave] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mediaOpen, setMediaOpen] = useState(false)
  const [postToDelete, setPostToDelete] = useState<BlogPost | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const isAdmin = session?.user?.role === "super_admin"

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const fetchPosts = async () => {
    const res = await listCmsBlogPostsAction()
    if ("error" in res) {
      toast({ variant: "destructive", title: "Gagal", description: res.error })
    } else {
      setPosts((res.posts || []) as BlogPost[])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isAdmin) fetchPosts()
  }, [isAdmin])

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setPublishOnSave(false)
    setDialogOpen(true)
  }

  const openEdit = (post: BlogPost) => {
    setEditingId(post.id)
    setForm({
      title: post.title || "",
      slug: post.slug || "",
      content: post.content || "",
      category: post.category || "Artikel",
      cover_image: post.cover_image || "",
    })
    setPublishOnSave(post.status === "PUBLISHED")
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const status = publishOnSave ? "PUBLISHED" : "DRAFT"
      const res = editingId
        ? await updateCmsBlogPostAction(editingId, form, status)
        : await createCmsBlogPostAction(form, status)

      if ("error" in res && res.error) {
        toast({ variant: "destructive", title: "Gagal Menyimpan", description: res.error })
      } else {
        toast({ title: "Berhasil", description: "Post berhasil disimpan." })
        setDialogOpen(false)
        fetchPosts()
      }
    } catch {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Terjadi kesalahan jaringan" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!postToDelete) return
    const res = await deleteCmsBlogPostAction(postToDelete.id)
    if ("error" in res && res.error) {
      toast({ variant: "destructive", title: "Gagal", description: res.error })
    } else {
      toast({ title: "Berhasil", description: "Post dipindahkan ke trash." })
      fetchPosts()
    }
    setPostToDelete(null)
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shrink-0" asChild>
            <Link href="/admin/cms"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0">
            <p className="text-sm font-black tracking-tight truncate">Blog</p>
            <p className="text-[10px] text-muted-foreground truncate">Kelola artikel blog SaCMS</p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate} className="h-8 rounded-lg text-[11px] font-bold">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Post Baru
        </Button>
      </div>

      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        <Card className="border border-border/80 shadow-xs overflow-hidden rounded-2xl bg-card">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border/60">
                  <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Judul</th>
                  <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Kategori</th>
                  <th className="p-4 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">Diperbarui</th>
                  <th className="p-4 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {posts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-muted-foreground">
                      <Newspaper className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-xs font-semibold">Belum ada post blog</p>
                    </td>
                  </tr>
                ) : (
                  posts.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-4">
                        <p className="text-xs font-bold text-foreground">{p.title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">/blog/{p.slug}</p>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">{p.category}</td>
                      <td className="p-4 text-center">
                        {p.status === "PUBLISHED" ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold rounded-full">Published</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-bold rounded-full">Draft</Badge>
                        )}
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">
                        {new Date(p.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)} className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setPostToDelete(p); setDeleteConfirmOpen(true) }}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">{editingId ? "Edit Post" : "Post Baru"}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Perubahan tampil di /blog setelah disimpan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Judul *</Label>
              <Input
                value={form.title}
                onChange={(e) => {
                  const title = e.target.value
                  setForm((f) => ({ ...f, title, slug: editingId ? f.slug : slugify(title) }))
                }}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Slug *</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                className="h-9 text-xs rounded-xl font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Kategori</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Cover Image</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={form.cover_image}
                    onChange={(e) => setForm((f) => ({ ...f, cover_image: e.target.value }))}
                    className="h-9 text-xs rounded-xl font-mono flex-1"
                    placeholder="https://..."
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => setMediaOpen(true)} className="h-9 text-[11px] font-bold rounded-xl border-border/80 shrink-0">
                    <ImageIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Isi Konten</Label>
              <RichTextEditor value={form.content} onChange={(v) => setForm((f) => ({ ...f, content: v }))} minHeight={240} />
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center sm:justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPublishOnSave((p) => !p)}
              className="rounded-xl h-9 text-xs font-bold border-border/80"
            >
              {publishOnSave ? "Status: Published" : "Status: Draft"}
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl h-9 text-xs">
                Batal
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving} className="rounded-xl h-9 text-xs font-bold">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Simpan
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaLibraryDialog
        open={mediaOpen}
        onOpenChange={setMediaOpen}
        mediaType="image"
        onSelect={(media) => { setForm((f) => ({ ...f, cover_image: media.url })); setMediaOpen(false) }}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Hapus post ini?"
        description={`"${postToDelete?.title}" akan dipindahkan ke trash dan hilang dari /blog.`}
        confirmLabel="Hapus"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
