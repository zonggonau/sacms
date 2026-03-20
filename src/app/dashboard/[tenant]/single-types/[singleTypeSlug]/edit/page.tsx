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
  ShieldCheck,
} from "lucide-react"
import Link from "next/link"
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
import { FIELD_TYPES, FIELD_CATEGORIES } from "@/lib/field-types"
import { RelationFieldConfig, ComponentFieldConfig } from "@/components/content/relation-field-config"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"

interface Field {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  unique: boolean
  options: string | null
  relationType: string
  targetModel: string
  targetSlug: string
  componentSlug: string
  repeatable: boolean
}

export default function EditSingleTypeSchemaPage({
  params,
}: {
  params: Promise<{ tenant: string; singleTypeSlug: string }>
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const resolvedParams = use(params)
  const tenantSlug = resolvedParams.tenant
  const singleTypeSlug = resolvedParams.singleTypeSlug
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [singleTypeId, setSingleTypeId] = useState("")
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [fields, setFields] = useState<Field[]>([])
  const [isGlobal, setIsGlobal] = useState(false)

  // Modal States
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [editingField, setEditingField] = useState<Field | null>(null)
  const [typeSearch, setTypeSearch] = useState("")

  const tenants = session?.user?.tenants || []
  const isSuperAdmin = session?.user?.role === "super_admin"

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/tenant/${tenantSlug}/single-types/slug/${singleTypeSlug}`)
        if (!response.ok) throw new Error("Failed to fetch")
        const data = await response.json()
        
        setSingleTypeId(data.id)
        setName(data.name)
        setSlug(data.slug)
        setDescription(data.description || "")
        setIsGlobal(data.isGlobal || false)
        
        const mappedFields = (data.fields || []).map((f: any) => {
          let extra: any = { relationType: "", targetModel: "", targetSlug: "", componentSlug: "", repeatable: false }
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
  }, [tenantSlug, singleTypeSlug, session])

  const isReadOnly = isGlobal && !isSuperAdmin

  const generateFieldSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")

  const selectType = (type: string) => {
    const newField: Field = {
      id: Date.now().toString(), name: "", slug: "", type: type,
      required: false, unique: false, options: null,
      relationType: "", targetModel: "", targetSlug: "", componentSlug: "", repeatable: false,
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
    if (!editingField?.name || !editingField?.slug) return
    const exists = fields.find(f => f.id === editingField.id)
    setFields(exists ? fields.map(f => f.id === editingField.id ? editingField : f) : [...fields, editingField])
    setIsConfigModalOpen(false)
    setEditingField(null)
  }

  const serializeFieldOptions = (field: Field) => {
    if (field.type === "relation") return JSON.stringify({ relationType: field.relationType, targetModel: field.targetModel, targetSlug: field.targetSlug })
    if (field.type === "component") return JSON.stringify({ componentSlug: field.componentSlug, repeatable: field.repeatable })
    return field.options
  }

  const handleUpdate = async () => {
    if (!name || !slug) return
    setSaving(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/single-types/${singleTypeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, slug, description,
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
        toast({ title: "Updated" })
        router.push(`/dashboard/${tenantSlug}/single-types`)
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="flex min-h-screen bg-muted/10">
      <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.back()}><ArrowLeft className="h-5 w-5" /></Button>
              <div>
                <h1 className="text-3xl font-black tracking-tight uppercase">Edit Schema</h1>
                <p className="text-muted-foreground text-sm">{name} &middot; Singleton</p>
              </div>
            </div>
            {!isReadOnly && (
              <Button onClick={handleUpdate} disabled={saving} className="bg-primary hover:bg-primary/90 font-bold px-6 shadow-lg shadow-primary/20">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            )}
          </div>

          {isReadOnly && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-center gap-4 text-primary">
              <ShieldCheck className="h-5 w-5" />
              <p className="text-sm font-medium">Platform-managed schema. Structure is read-only.</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <Card className="border-none shadow-sm">
                <CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Identity</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label className="text-xs font-bold">Name</Label><Input value={name} onChange={e => setName(e.target.value)} disabled={isReadOnly} className="bg-muted/30 border-none font-bold" /></div>
                  <div className="space-y-2"><Label className="text-xs font-bold">API Slug</Label><Input value={slug} disabled className="bg-muted/50 border-none font-mono text-xs opacity-50" /></div>
                  <div className="space-y-2"><Label className="text-xs font-bold">Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} disabled={isReadOnly} rows={3} className="bg-muted/30 border-none text-xs" /></div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Layers className="h-4 w-4" /> Attributes</h2>
                {!isReadOnly && (
                  <Button variant="outline" size="sm" onClick={() => setIsTypeSelectorOpen(true)} className="rounded-xl font-bold bg-card border-primary/20 text-primary hover:bg-primary hover:text-white">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Field
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                {fields.map(field => {
                  const typeInfo = FIELD_TYPES.find(ft => ft.type === field.type)
                  const Icon = typeInfo?.icon || Zap
                  return (
                    <div key={field.id} className="group bg-card border rounded-2xl p-4 flex items-center gap-4 hover:border-primary/50 transition-all shadow-sm">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-primary bg-primary/5"><Icon className="h-5 w-5" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm truncate">{field.name}</span>
                          {field.required && <Badge className="text-[8px] h-3.5 bg-red-50 text-red-500 border-red-100 uppercase">REQ</Badge>}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">{field.type} &middot; /{field.slug}</div>
                      </div>
                      {!isReadOnly && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editField(field)}><Settings2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setFields(fields.filter(f => f.id !== field.id))}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Same Modals as New Page */}
      <Dialog open={isTypeSelectorOpen} onOpenChange={setIsTypeSelectorOpen}>
        <DialogContent className="max-w-2xl p-0 border-none shadow-2xl rounded-3xl overflow-hidden">
          <div className="flex flex-col max-h-[85vh]">
            <DialogHeader className="p-6 bg-muted/10 border-b shrink-0">
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Attribute Type</DialogTitle>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search types..." value={typeSearch} onChange={e => setTypeSearch(e.target.value)} className="pl-10 h-10 bg-card border-none rounded-xl" />
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
                          <button key={ft.type} onClick={() => selectType(ft.type)} className="flex items-start gap-3 p-3 rounded-2xl border bg-card text-left hover:border-primary transition-all group">
                            <div className="w-10 h-10 rounded-xl bg-muted group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center shrink-0"><ft.icon className="h-5 w-5" /></div>
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
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Configure {editingField && FIELD_TYPES.find(ft => ft.type === editingField.type)?.label}</DialogTitle>
              </div>
            </DialogHeader>
            <ScrollArea className="flex-1 overflow-y-auto bg-card">
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-xs font-bold">Field Name *</Label><Input value={editingField?.name || ""} onChange={e => setEditingField(prev => prev ? ({ ...prev, name: e.target.value, slug: generateFieldSlug(e.target.value) }) : null)} className="bg-muted/30 border-none h-11 rounded-xl font-bold" /></div>
                  <div className="space-y-2"><Label className="text-xs font-bold">API Slug *</Label><Input value={editingField?.slug || ""} onChange={e => setEditingField(prev => prev ? ({ ...prev, slug: e.target.value }) : null)} className="bg-muted/30 border-none h-11 rounded-xl font-mono text-xs" /></div>
                </div>
                {(editingField?.type === "select" || editingField?.type === "tags") && (
                  <div className="space-y-2 pt-4"><Label className="text-xs font-bold">Options (Comma separated)</Label><Input value={editingField.options || ""} onChange={e => setEditingField(prev => prev ? ({ ...prev, options: e.target.value }) : null)} className="bg-muted/30 border-none h-11 rounded-xl" /></div>
                )}
                {editingField?.type === "relation" && <div className="p-4 bg-muted/20 rounded-2xl"><RelationFieldConfig tenantSlug={tenantSlug} context="singleType" relationType={editingField.relationType} targetModel={editingField.targetModel} targetSlug={editingField.targetSlug} onRelationTypeChange={v => setEditingField(prev => prev ? ({ ...prev, relationType: v }) : null)} onTargetModelChange={v => setEditingField(prev => prev ? ({ ...prev, targetModel: v, targetSlug: "" }) : null)} onTargetSlugChange={v => setEditingField(prev => prev ? ({ ...prev, targetSlug: v }) : null)} /></div>}
                {editingField?.type === "component" && <div className="p-4 bg-muted/20 rounded-2xl"><ComponentFieldConfig tenantSlug={tenantSlug} componentSlug={editingField.componentSlug} repeatable={editingField.repeatable} onComponentSlugChange={v => setEditingField(prev => prev ? ({ ...prev, componentSlug: v }) : null)} onRepeatableChange={v => setEditingField(prev => prev ? ({ ...prev, repeatable: v }) : null)} /></div>}
                <div className="flex items-center gap-6 p-4 bg-muted/20 rounded-2xl mt-4">
                  <div className="flex items-center space-x-3"><Checkbox id="required" checked={editingField?.required} onCheckedChange={checked => setEditingField(prev => prev ? ({ ...prev, required: !!checked }) : null)} /><Label htmlFor="required" className="text-xs font-bold cursor-pointer">Required</Label></div>
                  <div className="flex items-center space-x-3"><Checkbox id="unique" checked={editingField?.unique} onCheckedChange={checked => setEditingField(prev => prev ? ({ ...prev, unique: !!checked }) : null)} /><Label htmlFor="unique" className="text-xs font-bold cursor-pointer">Unique</Label></div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="p-6 bg-muted/10 border-t shrink-0">
              <Button variant="outline" onClick={() => setIsConfigModalOpen(false)} className="rounded-xl h-11">Cancel</Button>
              <Button onClick={saveFieldConfig} className="bg-primary hover:bg-primary/90 rounded-xl h-11 font-bold px-8">Save Field</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
