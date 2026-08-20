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
import { Switch } from "@/components/ui/switch"
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
import { createContentTypeAction } from "@/actions/content-types"

export default function NewContentTypeClient({
  tenantSlug,
}: {
  tenantSlug: string
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [showInCms, setShowInCms] = useState(true)
  const [docxTemplateUrl, setDocxTemplateUrl] = useState("")
  const [fields, setFields] = useState<Field[]>([])

  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [editingField, setEditingField] = useState<Field | null>(null)

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
      } else {
        options = field.options || {}
      }
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
      const res = await createContentTypeAction(tenantSlug, {
        name,
        slug,
        description,
        showInCms,
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
        toast({ title: "Success", description: "Content type created successfully" })
        router.push(`/dashboard/${tenantSlug}/content-type-builder/content-types`)
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
                <h1 className="text-base font-black text-foreground">Skema Koleksi Baru</h1>
                <p className="text-muted-foreground text-xs">Definisikan model data dan atribut field.</p>
              </div>
            </div>
            <Button onClick={handleSaveSchema} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 h-8 text-xs rounded-xl shadow-xs">
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Simpan Skema
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Col: Info */}
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
                    <Label className="text-xs font-semibold text-foreground">API Slug *</Label>
                    <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="artikel-blog" className="bg-background border-border/80 rounded-xl h-9 font-mono text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Deskripsi</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Untuk apa koleksi ini digunakan?" rows={3} className="bg-background border-border/80 rounded-xl text-xs resize-none" />
                  </div>
                  <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold cursor-pointer text-foreground" htmlFor="showInCmsNew">Tampilkan di CMS</Label>
                      <p className="text-[11px] text-muted-foreground">Munculkan di menu studio konten /cms</p>
                    </div>
                    <Switch 
                      id="showInCmsNew"
                      checked={showInCms} 
                      onCheckedChange={setShowInCms} 
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Col: Fields */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-primary" /> Daftar Atribut ({fields.length})
                </h2>
                <Button variant="outline" size="sm" onClick={openTypeSelector} className="rounded-xl font-bold bg-card border-border/80 h-8 text-xs text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Field
                </Button>
              </div>

              {fields.length === 0 ? (
                <Card className="border-dashed border-2 border-border/80 bg-card/40 shadow-none rounded-2xl">
                  <CardContent className="py-16 flex flex-col items-center justify-center text-center space-y-2">
                    <Plus className="h-8 w-8 text-muted-foreground/40" />
                    <p className="font-bold text-xs text-foreground">Belum ada field yang ditambahkan</p>
                    <p className="text-[11px] text-muted-foreground max-w-xs">Klik tombol "Tambah Field" di atas untuk menambahkan atribut data pertama.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2.5">
                  {fields.map((field) => {
                    const fieldTypeInfo = FIELD_TYPES.find(ft => ft.type === field.type)
                    const Icon = fieldTypeInfo?.icon || Zap
                    return (
                      <div key={field.id} className="group bg-card text-card-foreground border border-border/80 rounded-xl p-3.5 flex items-center gap-3.5 hover:border-primary/60 transition-all shadow-xs">
                        <div className="cursor-grab text-muted-foreground/30 group-hover:text-muted-foreground transition-colors"><GripVertical className="h-4 w-4" /></div>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-primary bg-primary/10 shrink-0">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs truncate text-foreground">{field.name}</span>
                            {field.required && <Badge variant="outline" className="text-[8px] h-3.5 border-rose-500/20 text-rose-600 bg-rose-500/10 font-bold rounded-full">WAJIB</Badge>}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                            <span className="uppercase">{field.type}</span>
                            <span>&middot;</span>
                            <span>/{field.slug}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground" onClick={() => editField(field)}><Settings2 className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => removeField(field.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
        tenantSlug={tenantSlug}
        context="contentType"
        onSave={saveFieldConfig}
      />
    </div>
  )
}



