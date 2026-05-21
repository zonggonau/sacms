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
} from "lucide-react"
import Link from "next/link"
import { FieldTypeSelector } from "@/components/cms/field-type-selector"
import { FieldConfigModal, Field } from "@/components/cms/field-config-modal"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface ContentType {
  id: string
  name: string
  slug: string
  description: string | null
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

  const fieldTypeInfo = FIELD_TYPES.find(ft => ft.type === field.type)
  const Icon = fieldTypeInfo?.icon || Zap

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className="group bg-white border border-slate-200 rounded-none p-4 flex items-center gap-4 hover:border-primary hover:shadow-sm transition-all shadow-none"
    >
      <div 
        {...attributes} 
        {...listeners} 
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded-none text-muted-foreground/20 group-hover:text-muted-foreground transition-colors"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="w-10 h-10 rounded-none flex items-center justify-center text-primary bg-primary/5 shrink-0">
        <Icon className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm truncate">{field.name}</span>
          {field.required && <Badge variant="outline" className="text-[8px] h-3.5 border-red-100 text-red-500 bg-red-50 font-black">REQ</Badge>}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
          <span className="uppercase">{field.type}</span>
          <span>&middot;</span>
          <span>/{field.slug}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => onEdit(field)}>
          <Settings2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none text-destructive hover:bg-red-50" onClick={() => onDelete(field.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default function EditContentTypePage({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const resolvedParams = use(params)
  const tenantSlug = resolvedParams.tenant
  const contentTypeSlug = resolvedParams.slug
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contentType, setContentType] = useState<ContentType | null>(null)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [fields, setFields] = useState<Field[]>([])

  // Modal States
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [editingField, setEditingField] = useState<Field | null>(null)

  const tenants = session?.user?.tenants || []

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
        const response = await fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}`)
        if (!response.ok) throw new Error("Failed to fetch")
        const data = await response.json()
        
        setContentType(data)
        setName(data.name)
        setSlug(data.slug)
        setDescription(data.description || "")
        
        const mappedFields = (data.fields || []).map((f: any) => {
          let extra: any = {
            relationType: "",
            targetModel: "",
            targetSlug: "",
            componentSlug: "",
            repeatable: false,
            autoGenerate: false,
            sourceField: "",
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
  }, [tenantSlug, contentTypeSlug, session])

  const generateFieldSlug = (value: string) => {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
  }

  const openTypeSelector = () => setIsTypeSelectorOpen(true)

  const selectType = (type: string) => {
    const newField: Field = {
      id: `field-${Date.now()}`,
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

  const removeField = (id: string) => {
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
    if (!editingField?.name || !editingField?.slug) {
      toast({ variant: "destructive", title: "Missing info", description: "Name and Slug are required" })
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

  const serializeFieldOptions = (field: Field) => {
    let options: Record<string, any> = {}
    
    try {
      options = field.options ? (typeof field.options === 'string' ? JSON.parse(field.options) : field.options) : {}
    } catch (e) {
      options = {}
    }

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

  const handleUpdateSchema = async () => {
    if (!name || !slug) {
      toast({ variant: "destructive", title: "Validation Error", description: "Name and slug are required" })
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/content-types/${contentType?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description,
          fields: fields.map((f, index) => ({
            name: f.name,
            slug: f.slug,
            type: f.type,
            required: f.required,
            unique: f.unique,
            options: serializeFieldOptions(f),
            relationSlug: f.type === "relation" ? f.targetSlug : null,
            order: index,
          })),
        }),
      })

      if (res.ok) {
        toast({ title: "Success", description: "Content type updated successfully" })
        router.push(`/dashboard/${tenantSlug}/content-types`)
      } else {
        const data = await res.json()
        toast({ variant: "destructive", title: "Error", description: data.error || "Failed to update content type" })
      }
    } catch (error) {
      console.error("Failed to save:", error)
      toast({ variant: "destructive", title: "Error", description: "Failed to save schema" })
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
<div className="flex-1 bg-[#f6f6f9] text-foreground flex flex-col w-full">
        
        {/* Sticky Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 shrink-0">
          <div className="max-w-5xl mx-auto w-full">
            
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/dashboard/${tenantSlug}/content-types`}>
                <Button variant="ghost" size="icon" className="rounded-none">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Edit Schema</h1>
                <p className="text-muted-foreground">{contentType?.name} &middot; /{contentType?.slug}</p>
              </div>
            </div>
            <Button onClick={handleUpdateSchema} disabled={saving} className="bg-primary hover:bg-primary/90 text-white font-bold px-6 rounded-none shadow-none">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </div>

          
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6 lg:p-8 max-w-5xl mx-auto w-full flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <Card className="bg-white border border-slate-200 shadow-sm rounded-none">
                <CardHeader><CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Identity</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Display Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Blog Post" className="bg-white border border-slate-200 rounded-none shadow-sm focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary h-10 font-medium text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">API Slug</Label>
                    <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g., blog-post" className="bg-white border border-slate-200 rounded-none shadow-sm focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary h-10 font-mono text-xs" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Description</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this collection for?" rows={3} className="bg-white border border-slate-200 rounded-none shadow-sm focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary text-sm p-3" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Attributes List ({fields.length})
                </h2>
                <Button variant="outline" size="sm" onClick={openTypeSelector} className="rounded-none font-bold bg-white border-slate-200 text-primary hover:bg-primary hover:border-primary hover:text-white transition-all shadow-sm">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add New Field
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
                        onDelete={removeField} 
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
      />
    </div>
  )
}
