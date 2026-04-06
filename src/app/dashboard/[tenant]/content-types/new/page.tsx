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
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
import { FIELD_TYPES, FIELD_CATEGORIES } from "@/lib/field-types"
import { RelationFieldConfig, ComponentFieldConfig } from "@/components/content/relation-field-config"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface Field {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  unique: boolean
  options: string | null
  // Relation fields
  relationType: string
  targetModel: string
  targetSlug: string
  // Component fields
  componentSlug: string
  repeatable: boolean
  autoGenerate?: boolean
  sourceField?: string
}

export default function NewContentTypePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string
  
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [fields, setFields] = useState<Field[]>([])

  // Modal States
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [editingField, setEditingField] = useState<Field | null>(null)
  const [typeSearch, setTypeSearch] = useState("")

  const tenants = session?.user?.tenants || []

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
      const res = await fetch(`/api/tenant/${tenantSlug}/content-types`, {
        method: "POST",
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
        toast({ title: "Success", description: "Content type created successfully" })
        router.push(`/dashboard/${tenantSlug}/content-types`)
      } else {
        const data = await res.json()
        toast({ variant: "destructive", title: "Error", description: data.error || "Failed to create content type" })
      }
    } catch (error) {
      console.error("Failed to save:", error)
      toast({ variant: "destructive", title: "Error", description: "Failed to save schema" })
    } finally {
      setSaving(false)
    }
  }

  if (status === "loading") return (
    <div className="flex min-h-screen">
      <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
      <main className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-muted/10">
      <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/dashboard/${tenantSlug}/content-types`}>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-black tracking-tight uppercase">New Schema</h1>
                <p className="text-muted-foreground">Define your data structure and rules.</p>
              </div>
            </div>
            <Button onClick={handleSaveSchema} disabled={saving} className="bg-primary hover:bg-primary/90 font-bold px-6 shadow-lg shadow-primary/20">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Schema
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Col: Info */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="border-none shadow-sm">
                <CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Identity</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Display Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Blog Post" className="bg-muted/30 border-none font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">API Slug</Label>
                    <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g., blog-post" className="bg-muted/30 border-none font-mono text-xs" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Description</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this collection for?" rows={3} className="bg-muted/30 border-none text-xs" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Col: Fields */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Attributes List ({fields.length})
                </h2>
                <Button variant="outline" size="sm" onClick={openTypeSelector} className="rounded-xl font-bold bg-card border-primary/20 text-primary hover:bg-primary hover:text-white transition-all">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add New Field
                </Button>
              </div>

              {fields.length === 0 ? (
                <Card className="border-dashed border-2 bg-transparent shadow-none">
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
                      <div key={field.id} className="group bg-card border rounded-2xl p-4 flex items-center gap-4 hover:border-primary/50 transition-all shadow-sm">
                        <div className="cursor-grab text-muted-foreground/20 group-hover:text-muted-foreground transition-colors"><GripVertical className="h-4 w-4" /></div>
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-primary bg-primary/5", `bg-${fieldTypeInfo?.category.toLowerCase()}/10`)}>
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
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => editField(field)}><Settings2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-red-50" onClick={() => removeField(field.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* MODAL 1: Type Selector */}
      <Dialog open={isTypeSelectorOpen} onOpenChange={setIsTypeSelectorOpen}>
        <DialogContent className="max-w-2xl p-0 border-none shadow-2xl rounded-3xl overflow-hidden">
          <div className="flex flex-col max-h-[85vh]">
            <DialogHeader className="p-6 bg-muted/10 border-b shrink-0">
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Select Attribute Type</DialogTitle>
              <DialogDescription>Choose the type of data this field will hold.</DialogDescription>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search types..." 
                  value={typeSearch} 
                  onChange={e => setTypeSearch(e.target.value)}
                  className="pl-10 h-10 bg-card border-none rounded-xl"
                />
              </div>
            </DialogHeader>
            
            <ScrollArea className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-8">
                {FIELD_CATEGORIES.map(category => {
                  const categoryTypes = FIELD_TYPES.filter(ft => 
                    ft.category === category && 
                    (ft.label.toLowerCase().includes(typeSearch.toLowerCase()) || 
                     ft.description.toLowerCase().includes(typeSearch.toLowerCase()))
                  )
                  if (categoryTypes.length === 0) return null
                  
                  return (
                    <div key={category} className="space-y-3">
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">{category}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {categoryTypes.map(ft => (
                          <button
                            key={ft.type}
                            onClick={() => selectType(ft.type)}
                            className="flex items-start gap-3 p-3 rounded-2xl border bg-card text-left hover:border-primary hover:ring-2 hover:ring-primary/10 transition-all group"
                          >
                            <div className="w-10 h-10 rounded-xl bg-muted group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center shrink-0 transition-colors">
                              <ft.icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{ft.label}</p>
                              <p className="text-[10px] text-muted-foreground line-clamp-1">{ft.description}</p>
                            </div>
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

      {/* MODAL 2: Field Configuration */}
      <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl border-none shadow-2xl overflow-hidden p-0">
          <div className="flex flex-col max-h-[90vh]">
            <DialogHeader className="p-6 bg-primary text-primary-foreground shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  {editingField && (
                    (() => {
                      const Icon = FIELD_TYPES.find(ft => ft.type === editingField.type)?.icon
                      return Icon ? <Icon className="h-5 w-5" /> : null
                    })()
                  )}
                </div>
                <div>
                  <DialogTitle className="text-xl font-black uppercase tracking-tight">Configure {editingField && FIELD_TYPES.find(ft => ft.type === editingField.type)?.label}</DialogTitle>
                  <DialogDescription className="text-primary-foreground/70 text-xs">Define rules and identity for this field.</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            
            <ScrollArea className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6 bg-card">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Field Name *</Label>
                    <Input 
                      value={editingField?.name || ""} 
                      onChange={e => {
                        const slug = generateFieldSlug(e.target.value)
                        setEditingField(prev => prev ? ({ ...prev, name: e.target.value, slug }) : null)
                      }}
                      placeholder="e.g., Hero Title"
                      className="bg-muted/30 border-none h-11 rounded-xl font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">API Slug *</Label>
                    <Input 
                      value={editingField?.slug || ""} 
                      onChange={e => setEditingField(prev => prev ? ({ ...prev, slug: e.target.value }) : null)}
                      placeholder="hero_title"
                      className="bg-muted/30 border-none h-11 rounded-xl font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Field Specific Configs */}
                {(editingField?.type === "select" || editingField?.type === "tags") && (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Options (Comma separated)</Label>
                    <Input 
                      value={editingField.options || ""} 
                      onChange={e => setEditingField(prev => prev ? ({ ...prev, options: e.target.value }) : null)}
                      placeholder="Option A, Option B, Option C"
                      className="bg-muted/30 border-none h-11 rounded-xl"
                    />
                  </div>
                )}

                {editingField?.type === "relation" && tenantSlug && (
                  <div className="p-4 bg-muted/20 rounded-2xl space-y-4">
                    <RelationFieldConfig
                      tenantSlug={tenantSlug}
                      context="contentType"
                      relationType={editingField.relationType}
                      targetModel={editingField.targetModel}
                      targetSlug={editingField.targetSlug}
                      onRelationTypeChange={(v) => setEditingField(prev => prev ? ({ ...prev, relationType: v }) : null)}
                      onTargetModelChange={(v) => setEditingField(prev => prev ? ({ ...prev, targetModel: v, targetSlug: "" }) : null)}
                      onTargetSlugChange={(v) => setEditingField(prev => prev ? ({ ...prev, targetSlug: v }) : null)}
                    />
                  </div>
                )}

                {editingField?.type === "component" && tenantSlug && (
                  <div className="p-4 bg-muted/20 rounded-2xl">
                    <ComponentFieldConfig
                      tenantSlug={tenantSlug}
                      componentSlug={editingField.componentSlug}
                      repeatable={editingField.repeatable}
                      onComponentSlugChange={(v) => setEditingField(prev => prev ? ({ ...prev, componentSlug: v }) : null)}
                      onRepeatableChange={(v) => setEditingField(prev => prev ? ({ ...prev, repeatable: v }) : null)}
                    />
                  </div>
                )}

                {editingField?.type === "slug" && (
                  <div className="p-4 bg-muted/20 rounded-2xl space-y-4">
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
                          <SelectTrigger className="bg-card border-none h-11 rounded-xl font-bold">
                            <SelectValue placeholder="Select a field" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-none shadow-2xl">
                            {fields.filter(f => f.id !== editingField.id && (f.type === "text" || f.type === "textarea")).map(f => (
                              <SelectItem key={f.slug} value={f.slug} className="rounded-lg font-bold">
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

                <div className="flex items-center gap-6 p-4 bg-muted/20 rounded-2xl">
                  <div className="flex items-center space-x-3">
                    <Checkbox 
                      id="required" 
                      checked={editingField?.required || false} 
                      onCheckedChange={checked => setEditingField(prev => prev ? ({ ...prev, required: !!checked }) : null)} 
                      className="rounded-md h-5 w-5"
                    />
                    <Label htmlFor="required" className="text-xs font-bold cursor-pointer">Required Field</Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox 
                      id="unique" 
                      checked={editingField?.unique || false} 
                      onCheckedChange={checked => setEditingField(prev => prev ? ({ ...prev, unique: !!checked }) : null)} 
                      className="rounded-md h-5 w-5"
                    />
                    <Label htmlFor="unique" className="text-xs font-bold cursor-pointer">Unique Values</Label>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 bg-muted/10 border-t gap-2 shrink-0">
              <Button variant="outline" onClick={() => { setIsConfigModalOpen(false); setEditingField(null) }} className="rounded-xl h-11">Cancel</Button>
              <Button onClick={saveFieldConfig} className="bg-primary hover:bg-primary/90 rounded-xl h-11 font-bold px-8 shadow-lg shadow-primary/20">Save Field</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
