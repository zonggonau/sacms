"use client"

import { useState, useEffect, use } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Loader2,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Settings2,
  GripVertical,
  Layers,
  Zap,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { FieldTypeSelector } from "@/components/cms/field-type-selector"
import { FieldConfigModal, Field } from "@/components/cms/field-config-modal"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { getContentTypeBySlugAction, updateContentTypeAction, getContentTypesAction } from "@/actions/content-types"

interface ContentType {
  id: string
  name: string
  slug: string
  description: string | null
  docxTemplateUrl: string | null
  showInCms?: boolean
  isPublished: boolean
  isGlobal: boolean
  fields: Field[]
}

// DnD Kit Imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { FIELD_TYPES } from "@/lib/field-types"

function SortableFieldItem({ 
  field, 
  onEdit, 
  onDelete,
  onToggleShowInCms
}: { 
  field: Field, 
  onEdit: (f: Field) => void, 
  onDelete: (id: string) => void,
  onToggleShowInCms: (id: string, checked: boolean) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.5 : 1,
  }

  const fieldTypeInfo = FIELD_TYPES.find(ft => ft.type === field.type)
  const Icon = fieldTypeInfo?.icon || Zap
  const isCmsActive = field.showInCms ?? field.options?.showInCms ?? true

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`group bg-card text-card-foreground border rounded-xl p-3.5 flex items-center gap-3.5 hover:border-primary/60 transition-all shadow-xs ${
        isCmsActive ? "border-border/80" : "border-border/40 bg-muted/20 opacity-75"
      }`}
    >
      <div 
        {...attributes} 
        {...listeners} 
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded-lg text-muted-foreground/30 group-hover:text-muted-foreground transition-colors"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
        isCmsActive ? "text-primary bg-primary/10" : "text-muted-foreground bg-muted"
      }`}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-bold text-xs truncate ${isCmsActive ? "text-foreground" : "text-muted-foreground"}`}>
            {field.name}
          </span>
          {field.required && <Badge variant="outline" className="text-[8px] h-3.5 border-rose-500/20 text-rose-600 bg-rose-500/10 font-bold rounded-full">WAJIB</Badge>}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
          <span className="uppercase">{field.type}</span>
          <span>&middot;</span>
          <span>/{field.slug}</span>
        </div>
      </div>

      {/* Switch Tampil di CMS */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted/40 hover:bg-muted/70 transition-colors rounded-lg border border-border/60 shrink-0">
        <Switch 
          id={`switch-cms-${field.id}`}
          checked={isCmsActive}
          onCheckedChange={(checked) => onToggleShowInCms(field.id, checked)}
          className="scale-75 data-[state=checked]:bg-emerald-600"
        />
        <Label 
          htmlFor={`switch-cms-${field.id}`}
          className="text-[10px] font-bold cursor-pointer select-none whitespace-nowrap hidden sm:inline"
        >
          {isCmsActive ? (
            <span className="text-emerald-600 dark:text-emerald-400">CMS ON</span>
          ) : (
            <span className="text-muted-foreground/70">CMS OFF</span>
          )}
        </Label>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground" onClick={() => onEdit(field)}>
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => onDelete(field.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

export default function EditContentTypeClient({
  tenantSlug,
  contentTypeSlug,
  initialContentType,
  initialFields,
}: {
  tenantSlug: string
  contentTypeSlug: string
  initialContentType: ContentType | null
  initialFields: Field[]
}) {
  const { status } = useSession()
  const router = useRouter()
  
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [contentType, setContentType] = useState<ContentType | null>(initialContentType)
  const [name, setName] = useState(initialContentType?.name || "")
  const [slug, setSlug] = useState(initialContentType?.slug || "")
  const [description, setDescription] = useState(initialContentType?.description || "")
  const [showInCms, setShowInCms] = useState(initialContentType?.showInCms ?? true)
  const [docxTemplateUrl, setDocxTemplateUrl] = useState(initialContentType?.docxTemplateUrl || "")
  const [fields, setFields] = useState<Field[]>(initialFields || [])

  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [editingField, setEditingField] = useState<Field | null>(null)
  const [availableContentTypes, setAvailableContentTypes] = useState<any[]>([])

  useEffect(() => {
    async function loadContentTypes() {
      try {
        const res = await getContentTypesAction(tenantSlug)
        if ("contentTypes" in res && res.contentTypes) {
          setAvailableContentTypes(res.contentTypes)
        }
      } catch (err) {}
    }
    loadContentTypes()
  }, [tenantSlug])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const selectType = (type: string) => {
    const newField: Field = {
      id: Date.now().toString(),
      name: "",
      slug: "",
      type: type,
      required: false,
      unique: false,
      options: null,
      relationType: "",
      targetModel: "",
      targetSlug: "",
      componentSlug: "",
      repeatable: false,
      autoGenerate: type === "slug",
      sourceField: "",
    }
    setEditingField(newField)
    setIsTypeSelectorOpen(false)
    setIsConfigModalOpen(true)
  }

  const editField = (field: Field) => {
    setEditingField({ ...field })
    setIsConfigModalOpen(true)
  }

  const saveFieldConfig = () => {
    if (!editingField?.name || !editingField?.slug) {
      toast({ variant: "destructive", title: "Data Kurang", description: "Nama dan Slug wajib diisi" })
      return
    }

    const exists = fields.find(f => f.id === editingField.id)
    if (exists) {
      setFields(fields.map(f => f.id === editingField.id ? editingField : f))
    } else {
      setFields([...fields, editingField])
    }
    
    setIsConfigModalOpen(false)
    setEditingField(null)
  }

  const saveBatchFields = (newFields: Field[]) => {
    setFields(prev => {
      let updated = [...prev]
      for (const nf of newFields) {
        const idx = updated.findIndex(f => f.id === nf.id || f.slug === nf.slug)
        if (idx >= 0) {
          updated[idx] = nf
        } else {
          updated.push(nf)
        }
      }
      return updated
    })
    setIsConfigModalOpen(false)
    setEditingField(null)
  }

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id))
  }

  const toggleFieldShowInCms = (id: string, checked: boolean) => {
    setFields(prev => prev.map(f => {
      if (f.id !== id) return f
      let currentOpts: any = {}
      if (typeof f.options === 'string') {
        try { currentOpts = JSON.parse(f.options) } catch {}
      } else if (typeof f.options === 'object' && f.options !== null) {
        currentOpts = { ...f.options }
      }
      currentOpts.showInCms = checked
      return { ...f, showInCms: checked, options: currentOpts }
    }))
  }

  const serializeFieldOptions = (field: Field) => {
    let options: any = {}
    
    try {
      if (typeof field.options === 'string') {
        try {
          options = JSON.parse(field.options)
        } catch (e) {
          if (field.type === 'select' || field.type === 'tags') {
            options = { choices: field.options.split(',').map(v => v.trim()).filter(Boolean) }
          } else {
            options = field.options
          }
        }
      } else if (typeof field.options === 'object' && field.options !== null) {
        options = { ...field.options }
      }
    } catch (e) {}

    if (typeof options !== 'object' || options === null) options = {}
    options.showInCms = field.showInCms !== false

    if (field.type === 'slug' && field.autoGenerate) {
      options.autoGenerate = true
      options.sourceField = field.sourceField
    } else if (field.type === 'relation') {
      options.relationType = field.relationType || "manyToOne"
      options.targetModel = field.targetModel || "content-type"
      options.targetSlug = field.targetSlug || field.relationSlug || ""
      options.multiple = field.relationType === "oneToMany" || field.relationType === "manyToMany"
    } else if (field.type === 'component') {
      options.componentSlug = field.componentSlug || ""
      options.repeatable = !!field.repeatable
    }

    return options
  }

  const handleUpdateSchema = async () => {
    if (!name) {
      toast({ variant: "destructive", title: "Validasi Gagal", description: "Nama skema wajib diisi" })
      return
    }

    setSaving(true)
    try {
      const res = await updateContentTypeAction(tenantSlug, initialContentType!.id, {
        name,
        slug: contentTypeSlug,
        description: description || undefined,
        docxTemplateUrl: docxTemplateUrl || undefined,
        showInCms,
        fields: fields.map((f, i) => ({
          name: f.name,
          slug: f.slug,
          type: f.type,
          required: f.required,
          unique: f.unique,
          options: serializeFieldOptions(f),
          relationSlug: f.type === "relation" ? (f.targetSlug || f.relationSlug || null) : null,
          relationType: f.relationType || undefined,
          targetModel: f.targetModel || undefined,
          targetSlug: f.targetSlug || f.relationSlug || undefined,
          componentSlug: f.componentSlug || undefined,
          repeatable: f.repeatable,
          order: i,
        }))
      })

      if (!res.error) {
        toast({ title: "Berhasil", description: "Skema berhasil diperbarui" })
        router.push(`/dashboard/${tenantSlug}/content-type-builder/content-types`)
      } else {
        toast({ variant: "destructive", title: "Terjadi Kesalahan", description: res.error || "Gagal memperbarui skema" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Gagal menyimpan skema" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 flex items-center justify-center flex-col w-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </div>
  )

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        
        {/* Sticky Header */}
        <div className="bg-card/80 backdrop-blur-md border-b border-border/60 px-4 md:px-6 py-3.5 sticky top-0 z-10 shrink-0">
          <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-3">
              <Link href={`/dashboard/${tenantSlug}/content-type-builder/content-types`}>
                <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 hover:bg-muted/60">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-base font-black text-foreground">Edit Skema Koleksi</h1>
                <p className="text-muted-foreground text-xs">{contentType?.name} &middot; <span className="font-mono">/{contentType?.slug}</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-bold rounded-xl border-border/80 text-foreground hover:bg-muted shadow-xs flex items-center gap-1.5"
                onClick={() => router.push(`/dashboard/${tenantSlug}/cms/content/${contentType?.slug || slug}`)}
                title="Buka entri konten ini di CMS Studio"
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                <span className="hidden sm:inline">Buka di CMS Studio</span>
              </Button>

              <Button onClick={handleUpdateSchema} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 h-8 text-xs rounded-xl shadow-xs">
                {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Simpan Perubahan
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <Card className="bg-card text-card-foreground border border-border/80 shadow-xs rounded-2xl overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Identitas Model</CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Nama Tampilan *</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Artikel Blog" className="bg-background border-border/80 rounded-xl h-9 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">API Slug</Label>
                    <Input value={slug} disabled className="bg-muted/50 border-input font-mono text-xs opacity-70 text-foreground rounded-xl h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Deskripsi</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Untuk apa koleksi ini digunakan?" rows={3} className="bg-background border-border/80 rounded-xl text-xs resize-none" />
                  </div>
                  <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold cursor-pointer text-foreground" htmlFor="showInCmsEdit">Tampilkan di CMS</Label>
                      <p className="text-[11px] text-muted-foreground">Munculkan di menu studio konten /cms</p>
                    </div>
                    <Switch 
                      id="showInCmsEdit"
                      checked={showInCms} 
                      onCheckedChange={setShowInCms} 
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-primary" /> Daftar Atribut ({fields.length})
                </h2>
                <Button variant="outline" size="sm" onClick={() => setIsTypeSelectorOpen(true)} className="rounded-xl font-bold bg-card border-border/80 h-8 text-xs text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Field
                </Button>
              </div>

              <DndContext 
                id="dnd-context"
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={fields.map(f => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2.5">
                    {fields.map(field => (
                      <SortableFieldItem 
                        key={field.id} 
                        field={field} 
                        onEdit={editField} 
                        onDelete={removeField} 
                        onToggleShowInCms={toggleFieldShowInCms}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </div>
      </div>

      <FieldTypeSelector
        isOpen={isTypeSelectorOpen}
        onOpenChange={setIsTypeSelectorOpen}
        onSelect={selectType}
      />

      <FieldConfigModal
        isOpen={isConfigModalOpen}
        onOpenChange={setIsConfigModalOpen}
        editingField={editingField}
        setEditingField={setEditingField}
        fields={fields}
        tenantSlug={tenantSlug}
        context="contentType"
        onSave={saveFieldConfig}
        onSaveBatch={saveBatchFields}
        templateContentTypes={availableContentTypes}
      />
    </div>
  )
}



