"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  Search,
  Zap,
} from "lucide-react"
import { FIELD_TYPES, FIELD_CATEGORIES } from "@/lib/field-types"
import { RelationFieldConfig, ComponentFieldConfig } from "@/components/content/relation-field-config"
import { toast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"

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

interface Field {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  unique: boolean
  options: string | Record<string, any> | null
  relationType: string
  targetModel: string
  targetSlug: string
  componentSlug: string
  repeatable: boolean
  autoGenerate?: boolean
  sourceField?: string
}

interface ContentType {
  id: string
  name: string
  slug: string
  description: string | null
  isPublished: boolean
  fields: Field[]
}

// Sortable Item Component
function SortableFieldItem({ 
  field, 
  onEdit, 
  onDelete 
}: { 
  field: Field, 
  onEdit: (f: Field) => void, 
  onDelete: (id: string) => void 
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

  const typeInfo = FIELD_TYPES.find(ft => ft.type === field.type)
  const Icon = typeInfo?.icon || Zap

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className="group bg-card border rounded-2xl p-4 flex items-center gap-4 hover:border-primary/50 transition-all shadow-sm"
    >
      <div 
        {...attributes} 
        {...listeners} 
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded-md"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-primary bg-primary/5 shrink-0">
        <Icon className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm truncate">{field.name}</span>
          {field.required && <Badge className="text-[8px] h-3.5 bg-red-50 text-red-500 border-red-100 uppercase">REQ</Badge>}
        </div>
        <div className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">
          {field.type} &middot; /{field.slug}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(field)}>
          <Settings2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(field.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default function EditGlobalContentTypePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const resolvedParams = use(params)
  const contentTypeId = resolvedParams.id
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contentType, setContentType] = useState<ContentType | null>(null)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [isPublished, setIsPublished] = useState(true)
  const [fields, setFields] = useState<Field[]>([])

  // Modal States
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [editingField, setEditingField] = useState<Field | null>(null)
  const [typeSearch, setTypeSearch] = useState("")

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/admin/content-types/${contentTypeId}`)
        if (!response.ok) throw new Error("Failed to fetch")
        const data = await response.json()
        
        setContentType(data)
        setName(data.name)
        setSlug(data.slug)
        setDescription(data.description || "")
        setIsPublished(data.isPublished)
        
        const mappedFields = (data.fields || []).map((f: any) => {
          let extra: any = { 
            relationType: "", 
            targetModel: "", 
            targetSlug: "", 
            componentSlug: "", 
            repeatable: false,
            autoGenerate: false,
            sourceField: ""
          }
          if (f.options) {
            try {
              const opts = typeof f.options === "string" ? JSON.parse(f.options) : f.options
              if (f.type === "relation") {
                extra.relationType = opts.relationType || ""
                extra.targetModel = opts.targetModel || ""
                extra.targetSlug = opts.targetSlug || f.relationSlug || ""
              } else if (f.type === "component") {
                extra.componentSlug = opts.componentSlug || ""
                extra.repeatable = opts.repeatable || false
              } else if (f.type === "slug") {
                extra.autoGenerate = opts.autoGenerate || false
                extra.sourceField = opts.sourceField || ""
              }
            } catch {}
          }
          return { ...f, ...extra }
        })
        setFields(mappedFields)
      } catch (err) {
        toast({ variant: "destructive", title: "Error", description: "Failed to load schema" })
      } finally {
        setLoading(false)
      }
    }
    if (session?.user) fetchData()
  }, [contentTypeId, session])

  const generateFieldSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")

  const selectType = (type: string) => {
    const newField: Field = {
      id: `field-${Date.now()}`, name: "", slug: "", type: type,
      required: false, unique: false, options: null,
      relationType: "", targetModel: "", targetSlug: "", componentSlug: "", repeatable: false,
      autoGenerate: type === "slug", sourceField: "",
    }
    setEditingField(newField)
    setIsTypeSelectorOpen(false)
    setIsConfigModalOpen(true)
  }

  const editField = (field: Field) => {
    setEditingField({ ...field })
    setIsConfigModalOpen(true)
  }

  const deleteField = (id: string) => {
    setFields(fields.filter(f => f.id !== id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id)
        const newIndex = items.findIndex((i) => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const saveFieldConfig = () => {
    if (!editingField?.name || !editingField?.slug) return
    const exists = fields.find(f => f.id === editingField.id)
    setFields(exists ? fields.map(f => f.id === editingField.id ? editingField : f) : [...fields, editingField])
    setIsConfigModalOpen(false)
    setEditingField(null)
  }

  const serializeFieldOptions = (field: Field) => {
    const options: Record<string, any> = typeof field.options === "string" 
      ? (field.options ? JSON.parse(field.options) : {}) 
      : (field.options || {})

    if (field.type === "relation") {
      options.relationType = field.relationType
      options.targetModel = field.targetModel
      options.targetSlug = field.targetSlug
    } else if (field.type === "component") {
      options.componentSlug = field.componentSlug
      options.repeatable = field.repeatable
    } else if (field.type === "slug") {
      options.autoGenerate = field.autoGenerate
      options.sourceField = field.sourceField
    }
    
    return options
  }

  const handleUpdate = async () => {
    if (!name || !slug) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/content-types/${contentTypeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, description, isPublished,
          fields: fields.map((f, index) => ({
            name: f.name, slug: f.slug, type: f.type,
            required: f.required, unique: f.unique,
            options: serializeFieldOptions(f),
            relationSlug: f.type === "relation" ? f.targetSlug : null,
            order: index,
          })),
        }),
      })
      if (res.ok) {
        toast({ title: "Updated", description: "Global schema updated successfully" })
        router.push("/admin/content-types")
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center flex-1 flex-col w-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  if (session?.user?.role !== "super_admin") {
    router.push("/dashboard")
    return null
  }

  return (
    <div className="flex flex-1 flex-col w-full">
<div className="flex-1 flex-col w-full">
        <div className="p-6 lg:p-8 w-full space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.back()}><ArrowLeft className="h-5 w-5" /></Button>
              <div>
                <h1 className="text-3xl font-black tracking-tight uppercase">Edit Global Schema</h1>
                <p className="text-muted-foreground text-sm">{name} &middot; /{slug}</p>
              </div>
            </div>
            <Button onClick={handleUpdate} disabled={saving} className="bg-primary hover:bg-primary/90 font-bold px-6 shadow-lg shadow-primary/20">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <Card className="border-none shadow-sm">
                <CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Identity</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label className="text-xs font-bold">Display Name</Label><Input value={name} onChange={e => setName(e.target.value)} className="bg-muted/30 border-none font-bold" /></div>
                  <div className="space-y-2"><Label className="text-xs font-bold">API Slug</Label><Input value={slug} disabled className="bg-muted/50 border-none font-mono text-xs opacity-50" /></div>
                  <div className="space-y-2"><Label className="text-xs font-bold">Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="bg-muted/30 border-none text-xs" /></div>
                  <div className="flex items-center space-x-3 pt-2">
                    <Checkbox id="isPublished" checked={isPublished} onCheckedChange={v => setIsPublished(!!v)} />
                    <Label htmlFor="isPublished" className="text-xs font-bold cursor-pointer">Published globally</Label>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Layers className="h-4 w-4" /> Attributes</h2>
                <Button variant="outline" size="sm" onClick={() => setIsTypeSelectorOpen(true)} className="rounded-xl font-bold bg-card border-primary/20 text-primary hover:bg-primary hover:text-white transition-all">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Field
                </Button>
              </div>

              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={fields.map(f => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {fields.map(field => (
                      <SortableFieldItem 
                        key={field.id} 
                        field={field} 
                        onEdit={editField} 
                        onDelete={deleteField} 
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </div>
      </div>

      {/* Modals - Same as New Page */}
      <Dialog open={isTypeSelectorOpen} onOpenChange={setIsTypeSelectorOpen}>
        <DialogContent className="max-w-2xl p-0 border border-border shadow-none rounded-none overflow-hidden bg-card">
          <div className="flex flex-col max-h-[85vh]">
            <DialogHeader className="p-6 bg-muted/10 border-b shrink-0">
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Select Attribute Type</DialogTitle>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search types..." value={typeSearch} onChange={e => setTypeSearch(e.target.value)} className="pl-10 h-10 bg-card border border-border rounded-none" />
              </div>
            </DialogHeader>
            <ScrollArea className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-8">
                {FIELD_CATEGORIES.map(category => {
                  const categoryTypes = FIELD_TYPES.filter(ft => ft.category === category && (ft.label.toLowerCase().includes(typeSearch.toLowerCase()) || ft.description.toLowerCase().includes(typeSearch.toLowerCase())))
                  if (categoryTypes.length === 0) return null
                  return (
                    <div key={category} className="space-y-3">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">{category}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {categoryTypes.map(ft => (
                          <button key={ft.type} onClick={() => selectType(ft.type)} className="flex items-start gap-3 p-3 rounded-none border border-border bg-card text-left hover:border-primary transition-all group">
                            <div className="w-10 h-10 rounded-none border border-border bg-muted group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center shrink-0 transition-colors"><ft.icon className="h-5 w-5" /></div>
                            <div className="min-w-0"><p className="text-sm font-bold group-hover:text-primary">{ft.label}</p><p className="text-[10px] text-muted-foreground line-clamp-1">{ft.description}</p></div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
        <DialogContent className="max-w-lg rounded-none border border-border shadow-none overflow-hidden p-0 bg-card">
          <div className="flex flex-col max-h-[90vh]">
            <DialogHeader className="p-6 bg-primary text-primary-foreground shrink-0 border-b border-primary-foreground/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-none border border-primary-foreground/20 bg-card/20 flex items-center justify-center">
                  {editingField && (
                    (() => {
                      const Icon = FIELD_TYPES.find(ft => ft.type === editingField.type)?.icon
                      return Icon ? <Icon className="h-5 w-5" /> : null
                    })()
                  )}
                </div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Configure {editingField && FIELD_TYPES.find(ft => ft.type === editingField.type)?.label}</DialogTitle>
              </div>
            </DialogHeader>
            <ScrollArea className="flex-1 overflow-y-auto bg-card">
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-xs font-bold">Field Name *</Label><Input value={editingField?.name || ""} onChange={e => setEditingField(prev => prev ? ({ ...prev, name: e.target.value, slug: generateFieldSlug(e.target.value) }) : null)} className="bg-muted/30 border border-border h-11 rounded-none font-bold" /></div>
                  <div className="space-y-2"><Label className="text-xs font-bold">API Slug *</Label><Input value={editingField?.slug || ""} onChange={e => setEditingField(prev => prev ? ({ ...prev, slug: e.target.value }) : null)} className="bg-muted/30 border border-border h-11 rounded-none font-mono text-xs" /></div>
                </div>
                {(editingField?.type === "select" || editingField?.type === "tags") && (
                  <div className="space-y-2 pt-4"><Label className="text-xs font-bold">Options (Comma separated)</Label><Input value={typeof editingField.options === "string" ? editingField.options : ""} onChange={e => setEditingField(prev => prev ? ({ ...prev, options: e.target.value }) : null)} className="bg-muted/30 border border-border h-11 rounded-none" /></div>
                )}
                {editingField?.type === "relation" && <div className="p-4 bg-muted/20 border border-border rounded-none"><RelationFieldConfig context="contentType" relationType={editingField.relationType} targetModel={editingField.targetModel} targetSlug={editingField.targetSlug} onRelationTypeChange={v => setEditingField(prev => prev ? ({ ...prev, relationType: v }) : null)} onTargetModelChange={v => setEditingField(prev => prev ? ({ ...prev, targetModel: v, targetSlug: "" }) : null)} onTargetSlugChange={v => setEditingField(prev => prev ? ({ ...prev, targetSlug: v }) : null)} /></div>}
                {editingField?.type === "component" && <div className="p-4 bg-muted/20 border border-border rounded-none"><ComponentFieldConfig componentSlug={editingField.componentSlug} repeatable={editingField.repeatable} onComponentSlugChange={v => setEditingField(prev => prev ? ({ ...prev, componentSlug: v }) : null)} onRepeatableChange={v => setEditingField(prev => prev ? ({ ...prev, repeatable: v }) : null)} /></div>}
                {editingField?.type === "slug" && (
                  <div className="p-4 bg-muted/20 border border-border rounded-none space-y-4">
                    <div className="flex items-center space-x-3">
                      <Checkbox 
                        id="autoGenerate" 
                        checked={editingField?.autoGenerate} 
                        onCheckedChange={checked => setEditingField(prev => prev ? ({ ...prev, autoGenerate: !!checked }) : null)} 
                      />
                      <Label htmlFor="autoGenerate" className="text-xs font-bold cursor-pointer">Auto-generate from another field</Label>
                    </div>
                    {editingField?.autoGenerate && (
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Source Field</Label>
                        <Select 
                          value={editingField.sourceField || ""} 
                          onValueChange={v => setEditingField(prev => prev ? ({ ...prev, sourceField: v }) : null)}
                        >
                          <SelectTrigger className="bg-card border border-border h-11 rounded-none font-bold">
                            <SelectValue placeholder="Select a field" />
                          </SelectTrigger>
                          <SelectContent className="rounded-none border border-border shadow-none">
                            {fields.filter(f => f.id !== editingField.id && (f.type === "text" || f.type === "textarea")).map(f => (
                              <SelectItem key={f.slug} value={f.slug} className="rounded-none font-bold">
                                {f.name} ({f.slug})
                              </SelectItem>
                            ))}
                            {fields.filter(f => f.id !== editingField.id && (f.type === "text" || f.type === "textarea")).length === 0 && (
                              <div className="p-2 text-xs text-muted-foreground italic">No text fields available</div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-6 p-4 bg-muted/20 border border-border rounded-none mt-4">
                  <div className="flex items-center space-x-3"><Checkbox id="required" checked={editingField?.required} onCheckedChange={checked => setEditingField(prev => prev ? ({ ...prev, required: !!checked }) : null)} /><Label htmlFor="required" className="text-xs font-bold cursor-pointer">Required</Label></div>
                  <div className="flex items-center space-x-3"><Checkbox id="unique" checked={editingField?.unique} onCheckedChange={checked => setEditingField(prev => prev ? ({ ...prev, unique: !!checked }) : null)} /><Label htmlFor="unique" className="text-xs font-bold cursor-pointer">Unique</Label></div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="p-6 bg-muted/10 border-t shrink-0">
              <Button variant="outline" onClick={() => setIsConfigModalOpen(false)} className="rounded-none border border-border h-11">Cancel</Button>
              <Button onClick={saveFieldConfig} className="bg-primary hover:bg-primary/90 rounded-none h-11 font-bold px-8 shadow-lg shadow-primary/20 border border-primary">Save Field</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
