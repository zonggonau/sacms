"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import Link from "next/link"
import { FieldTypeSelector } from "@/components/cms/field-type-selector"
import { FieldConfigModal, Field } from "@/components/cms/field-config-modal"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { FIELD_TYPES } from "@/lib/field-types"
import { createAdminContentTypeAction } from "@/actions/admin-content-types"

export default function AdminNewContentTypeClient() {
  const { status } = useSession()
  const router = useRouter()
  
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [docxTemplateUrl, setDocxTemplateUrl] = useState("")
  const [fields, setFields] = useState<Field[]>([])

  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [editingField, setEditingField] = useState<Field | null>(null)


  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if (name && !editingField) {
      const generatedSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
      setSlug(generatedSlug)
    }
  }, [name])

  const generateFieldSlug = (value: string) => {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
  }

  const openTypeSelector = () => setIsTypeSelectorOpen(true)

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

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id))
  }

  const serializeFieldOptions = (field: Field) => {
    let options: Record<string, any> = {}
    
    try {
      options = field.options ? JSON.parse(field.options) : {}
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
    
    return Object.keys(options).length > 0 ? JSON.stringify(options) : field.options
  }

  const handleSaveSchema = async () => {
    if (!name || !slug) {
      toast({ variant: "destructive", title: "Validation Error", description: "Name and slug are required" })
      return
    }

    setSaving(true)
    try {
      const res = await createAdminContentTypeAction({
        name,
        slug,
        description,
        docxTemplateUrl: docxTemplateUrl || null,
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
      })

      if (!res.error) {
        toast({ title: "Success", description: "Global content type created successfully" })
        router.push(`/admin/cms/content-types`)
      } else {
        toast({ variant: "destructive", title: "Error", description: res.error || "Failed to create content type" })
      }
    } catch (error) {
      console.error("Failed to save:", error)
      toast({ variant: "destructive", title: "Error", description: "Failed to save schema" })
    } finally {
      setSaving(false)
    }
  }

  if (status === "loading") return (
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
          <div className="w-full">
            
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/admin/cms/content-types`}>
                <Button variant="ghost" size="icon" className="rounded-none">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-800">New Schema</h1>
                <p className="text-muted-foreground">Define your data structure and rules.</p>
              </div>
            </div>
            <Button onClick={handleSaveSchema} disabled={saving} className="bg-primary hover:bg-primary/90 text-white font-bold px-6 rounded-none shadow-none">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Schema
            </Button>
          </div>

          
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6 lg:p-8 w-full flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Col: Info */}
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

            {/* Right Col: Fields */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Attributes List ({fields.length})
                </h2>
                <Button variant="outline" size="sm" onClick={openTypeSelector} className="rounded-none font-bold bg-white border-slate-200 text-primary hover:bg-primary hover:border-primary hover:text-white transition-all shadow-sm">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add New Field
                </Button>
              </div>

              {fields.length === 0 ? (
                <Card className="border-dashed border-2 border-slate-200 bg-transparent shadow-none rounded-none">
                  <CardContent className="py-20 flex flex-col items-center justify-center text-center opacity-40">
                    <Plus className="h-12 w-12 mb-4" />
                    <p className="font-bold">No fields defined yet</p>
                    <p className="text-xs mt-1">Start by adding your first content attribute.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {fields.map((field, index) => {
                    const fieldTypeInfo = FIELD_TYPES.find(ft => ft.type === field.type)
                    const Icon = fieldTypeInfo?.icon || Zap
                    return (
                      <div key={field.id} className="group bg-white border border-slate-200 rounded-none p-4 flex items-center gap-4 hover:border-primary hover:shadow-sm transition-all shadow-none">
                        <div className="cursor-grab text-muted-foreground/20 group-hover:text-muted-foreground transition-colors"><GripVertical className="h-4 w-4" /></div>
                        <div className={cn("w-10 h-10 rounded-none flex items-center justify-center text-primary bg-primary/5", `bg-${fieldTypeInfo?.category.toLowerCase()}/10`)}>
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
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => editField(field)}><Settings2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none text-destructive hover:bg-red-50" onClick={() => removeField(field.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
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
        tenantSlug="global"
        context="contentType"
        onSave={saveFieldConfig}
      />
    </div>
  )
}
