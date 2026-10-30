"use client"

import { useEffect, useState, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Loader2, Plus, Trash2, FolderTree, ChevronUp, ChevronDown, FolderInput, Check, X, Pencil } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import {
  buildGroupTree,
  flattenGroupTreeForSelect,
  type ContentTypeGroupNode,
  type FlatContentTypeGroup,
} from "@/lib/content-type-groups"
import {
  getContentTypeGroupsAction,
  createContentTypeGroupAction,
  renameContentTypeGroupAction,
  reparentContentTypeGroupAction,
  reorderContentTypeGroupsAction,
  deleteContentTypeGroupAction,
} from "@/actions/content-type-groups"

const TOP_LEVEL = "__top_level__"
const MAX_LEVEL = 3

interface ContentTypeGroupManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  onChanged?: () => void
}

export function ContentTypeGroupManagerDialog({ open, onOpenChange, tenantSlug, onChanged }: ContentTypeGroupManagerDialogProps) {
  const { toast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [isPending, startTransition] = useTransition()

  const [loading, setLoading] = useState(false)
  const [flatGroups, setFlatGroups] = useState<FlatContentTypeGroup[]>([])
  const [newGroupName, setNewGroupName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [addingChildTo, setAddingChildTo] = useState<string | null>(null)
  const [newChildName, setNewChildName] = useState("")

  const load = () => {
    setLoading(true)
    getContentTypeGroupsAction(tenantSlug).then((res) => {
      setLoading(false)
      if ("error" in res) {
        toast({ variant: "destructive", title: "Gagal Memuat Grup", description: res.error })
        return
      }
      setFlatGroups(res.groups)
    })
  }

  useEffect(() => {
    if (open) load()
  }, [open, tenantSlug])

  const tree = buildGroupTree(flatGroups)

  const notifyChanged = () => {
    load()
    onChanged?.()
  }

  const handleCreateTopLevel = () => {
    const name = newGroupName.trim()
    if (!name) return
    startTransition(async () => {
      const res = await createContentTypeGroupAction(tenantSlug, { name, parentId: null })
      if ("error" in res) {
        toast({ variant: "destructive", title: "Gagal Membuat Grup", description: res.error })
      } else {
        setNewGroupName("")
        notifyChanged()
      }
    })
  }

  const handleCreateChild = (parentId: string) => {
    const name = newChildName.trim()
    if (!name) return
    startTransition(async () => {
      const res = await createContentTypeGroupAction(tenantSlug, { name, parentId })
      if ("error" in res) {
        toast({ variant: "destructive", title: "Gagal Membuat Subgrup", description: res.error })
      } else {
        setAddingChildTo(null)
        setNewChildName("")
        notifyChanged()
      }
    })
  }

  const handleRename = (id: string) => {
    const name = editingName.trim()
    if (!name) return
    startTransition(async () => {
      const res = await renameContentTypeGroupAction(tenantSlug, id, name)
      if ("error" in res) {
        toast({ variant: "destructive", title: "Gagal Mengubah Nama", description: res.error })
      } else {
        setEditingId(null)
        notifyChanged()
      }
    })
  }

  const handleReparent = (id: string, newParentId: string | null) => {
    startTransition(async () => {
      const res = await reparentContentTypeGroupAction(tenantSlug, id, newParentId)
      if ("error" in res) {
        toast({ variant: "destructive", title: "Gagal Memindahkan Grup", description: res.error })
      } else {
        notifyChanged()
      }
    })
  }

  const handleMove = (node: ContentTypeGroupNode, siblings: ContentTypeGroupNode[], direction: -1 | 1) => {
    const index = siblings.findIndex((s) => s.id === node.id)
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= siblings.length) return
    const reordered = [...siblings]
    ;[reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]]
    startTransition(async () => {
      const res = await reorderContentTypeGroupsAction(tenantSlug, node.parentId, reordered.map((s) => s.id))
      if ("error" in res) {
        toast({ variant: "destructive", title: "Gagal Mengurutkan", description: res.error })
      } else {
        notifyChanged()
      }
    })
  }

  const handleDelete = async (node: ContentTypeGroupNode) => {
    const ok = await confirm({
      title: `Hapus grup "${node.name}"?`,
      description: "Koleksi di dalam grup ini akan menjadi tanpa grup (tidak dihapus), dan subgrup di dalamnya akan ikut terhapus.",
      confirmLabel: "Hapus",
      variant: "destructive",
    })
    if (!ok) return
    startTransition(async () => {
      const res = await deleteContentTypeGroupAction(tenantSlug, node.id)
      if ("error" in res) {
        toast({ variant: "destructive", title: "Gagal Menghapus Grup", description: res.error })
      } else {
        toast({
          title: "Grup Dihapus",
          description: `${res.orphanedContentTypeCount} koleksi menjadi tanpa grup${res.descendantGroupCount > 0 ? `, ${res.descendantGroupCount} subgrup ikut terhapus` : ""}.`,
        })
        notifyChanged()
      }
    })
  }

  const renderRow = (node: ContentTypeGroupNode, depth: number, siblings: ContentTypeGroupNode[]) => {
    const level = depth + 1
    const isEditing = editingId === node.id
    const reparentTargets = flattenGroupTreeForSelect(tree, node.id)

    return (
      <div key={node.id} style={{ paddingLeft: depth * 20 }}>
        <div className="flex items-center gap-1.5 py-1.5 border-b border-border/50 group">
          <FolderTree className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {isEditing ? (
            <>
              <Input
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename(node.id)}
                className="h-7 text-xs flex-1"
              />
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleRename(node.id)} disabled={isPending}>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)} disabled={isPending}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <span className="text-xs font-semibold flex-1 truncate">{node.name}</span>
              <span className="text-[10px] text-muted-foreground mr-1">Level {level}</span>

              <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" title="Pindah urutan naik" onClick={() => handleMove(node, siblings, -1)} disabled={isPending}>
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" title="Pindah urutan turun" onClick={() => handleMove(node, siblings, 1)} disabled={isPending}>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                title="Ubah nama"
                onClick={() => { setEditingId(node.id); setEditingName(node.name) }}
                disabled={isPending}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" title="Pindah ke grup lain" disabled={isPending}>
                    <FolderInput className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="end">
                  <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Pindah ke...</p>
                  <Select value={node.parentId ?? TOP_LEVEL} onValueChange={(v) => handleReparent(node.id, v === TOP_LEVEL ? null : v)}>
                    <SelectTrigger className="h-8 text-xs w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TOP_LEVEL} className="text-xs">Tingkat Atas (tanpa induk)</SelectItem>
                      {reparentTargets.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PopoverContent>
              </Popover>

              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                title={level >= MAX_LEVEL ? "Maksimum 3 tingkat kedalaman grup" : "Tambah subgrup"}
                disabled={level >= MAX_LEVEL || isPending}
                onClick={() => { setAddingChildTo(node.id); setNewChildName("") }}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                title="Hapus grup"
                onClick={() => handleDelete(node)}
                disabled={isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>

        {addingChildTo === node.id && (
          <div className="flex items-center gap-1.5 py-1.5" style={{ paddingLeft: 20 }}>
            <Input
              autoFocus
              placeholder="Nama subgrup baru"
              value={newChildName}
              onChange={(e) => setNewChildName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateChild(node.id)}
              className="h-7 text-xs flex-1"
            />
            <Button size="sm" className="h-7 text-[11px]" onClick={() => handleCreateChild(node.id)} disabled={isPending || !newChildName.trim()}>Tambah</Button>
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setAddingChildTo(null)}>Batal</Button>
          </div>
        )}

        {node.children.map((child) => renderRow(child, depth + 1, node.children))}
      </div>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-2xl border border-border bg-card max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FolderTree className="h-4 w-4" /> Kelola Grup Koleksi
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Kelompokkan koleksi terkait ke dalam grup bertingkat (maksimum 3 level) yang tampil sebagai dropdown di sidebar CMS.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-y-auto -mx-1 px-1">
            {loading ? (
              <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : tree.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-6 text-center">Belum ada grup. Buat grup pertama Anda di bawah.</p>
            ) : (
              tree.map((node) => renderRow(node, 0, tree))
            )}
          </div>

          <div className="flex items-center gap-1.5 pt-2 border-t border-border/60">
            <Input
              placeholder="Nama grup baru, misal: Artikel"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateTopLevel()}
              className="h-9 text-xs flex-1"
            />
            <Button size="sm" className="h-9 text-xs font-bold" onClick={handleCreateTopLevel} disabled={isPending || !newGroupName.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Tambah Grup
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </>
  )
}
