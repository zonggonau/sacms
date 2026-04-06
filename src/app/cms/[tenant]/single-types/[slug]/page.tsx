"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { 
  ArrowLeft, Save, FileText, Loader2, 
  Globe, ShieldCheck, Send, Zap, ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

// Field Renderers
import { TextField } from "@/components/content/field-renderers/text-field"
import { TextareaField } from "@/components/content/field-renderers/textarea-field"
import { NumberField } from "@/components/content/field-renderers/number-field"
import { DateTimeField } from "@/components/content/field-renderers/datetime-field"
import { BooleanField } from "@/components/content/field-renderers/boolean-field"
import { DateField } from "@/components/content/field-renderers/date-field"
import { SelectField } from "@/components/content/field-renderers/select-field"
import { MediaField } from "@/components/content/field-renderers/media-field"
import { MediaMultipleField } from "@/components/content/field-renderers/media-multiple-field"
import { RichTextField } from "@/components/content/field-renderers/rich-text-field"
import { RelationSelectField } from "@/components/content/field-renderers/relation-select-field"
import { ComponentField } from "@/components/content/field-renderers/component-field"
import { TagsField } from "@/components/content/field-renderers/tags-field"
import { AdvancedField } from "@/components/content/field-renderers/advanced-fields"
import { SlugField } from "@/components/content/field-renderers/slug-field"
import { AIAssistantDialog } from "@/components/content/ai-assistant-dialog"

interface Field {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  options?: any
  relationSlug?: string
}

interface SingleType {
  id: string
  name: string
  slug: string
  description: string | null
  fields: Field[]
  data: Record<string, unknown> | null
  publishedAt: string | null
  updatedAt: string
}

export default function CMSSingleTypeDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string
  const singleTypeSlug = params?.slug as string
  
  const [singleType, setSingleType] = useState<SingleType | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [locale, setLocale] = useState<string>("en")
  const [availableLocales, setAvailableLocales] = useState<any[]>([{ locale: "en", name: "English" }])

  const fetchData = useCallback(async () => {
    if (!tenantSlug || !singleTypeSlug) return
    setLoading(true)
    try {
      const [stRes, locRes] = await Promise.all([
        fetch(`/api/tenant/${tenantSlug}/single-types/slug/${singleTypeSlug}`),
        fetch(`/api/tenant/${tenantSlug}/locales`)
      ])
      
      if (stRes.ok) {
        const data = await stRes.json()
        setSingleType(data)
        setFormData(data.data || {})
      }
      if (locRes.ok) {
        const data = await locRes.json()
        if (data.locales?.length > 0) setAvailableLocales(data.locales)
      }
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error", description: "Failed to load content" })
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, singleTypeSlug])

  useEffect(() => {
    if (status === "authenticated") {
      setSingleType(null)
      setFormData({})
      fetchData()
    }
  }, [fetchData, status, singleTypeSlug])

  const handleSave = async (publishNow: boolean = false) => {
    if (!singleTypeSlug) return
    setSaving(true)
    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/single-types/slug/${singleTypeSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          data: formData,
          publish: publishNow,
          locale
        }),
      })
      if (!response.ok) throw new Error("Save failed")
      
      toast({ 
        title: publishNow ? "Published Successfully!" : "Draft Saved",
        className: publishNow ? "bg-emerald-50 border-emerald-200 text-emerald-800" : ""
      })
      
      if (publishNow) {
        router.push(`/cms/${tenantSlug}/single-types`)
      } else {
        fetchData()
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save content" })
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (slug: string, value: any) => {
    setFormData(prev => ({ ...prev, [slug]: value }))
  }

  const renderField = (field: Field) => {
    const value = formData[field.slug]
    let options: string[] = []
    
    if (field.options) {
      try {
        const opts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
        if (Array.isArray(opts)) options = opts
        else if (typeof opts === 'string') options = opts.split(",").map(o => o.trim()).filter(Boolean)
      } catch (e) {
        if (typeof field.options === 'string') options = field.options.split(",").map(o => o.trim()).filter(Boolean)
      }
    }

    const LabelWithAI = () => (
      <div className="flex items-center justify-between mb-2">
        <Label className="text-sm font-bold text-slate-700">{field.name} {field.required && "*"}</Label>
        {(field.type === "text" || field.type === "textarea" || field.type === "richText") && (
          <AIAssistantDialog
            tenantSlug={tenantSlug}
            contentTypeSlug={singleTypeSlug}
            fieldName={field.name}
            currentValue={value as string}
            onApply={(content) => handleFieldChange(field.slug, content)}
          />
        )}
      </div>
    )

    switch (field.type) {
      case "text":
        if (['hashtag', 'hastag', 'tags'].includes(field.slug.toLowerCase())) {
          return <div className="space-y-2"><LabelWithAI /><TagsField value={value as any} onChange={v => handleFieldChange(field.slug, v)} /></div>
        }
        return <div className="space-y-2"><LabelWithAI /><TextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} placeholder={field.name} /></div>
      
      case "slug":
      case "uid":
        // Find source field for auto-generation (usually 'title' or 'name')
        const sourceFieldName = (singleType?.fields.find(f => f.slug === 'title') || singleType?.fields.find(f => f.slug === 'name'))?.slug
        const sourceValue = sourceFieldName ? (formData[sourceFieldName] as string) : ""
        
        return (
          <div className="space-y-2">
            <SlugField 
              label={<LabelWithAI />}
              value={value as string} 
              onChange={v => handleFieldChange(field.slug, v)} 
              required={field.required} 
              placeholder={field.name}
              sourceValue={sourceValue}
              autoGenerate={false} // Default to manual entry for single types
            />
          </div>
        )
      
      case "textarea":
      case "markdown":
        return <div className="space-y-2"><LabelWithAI /><TextareaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>
      
      case "richText":
        return <div className="space-y-2"><LabelWithAI /><RichTextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>
      
      case "number":
      case "integer":
        return <div className="space-y-2"><Label className="text-sm font-bold">{field.name}</Label><NumberField value={value as any} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>
      
      case "boolean":
        return <div className="space-y-2"><Label className="text-sm font-bold">{field.name}</Label><BooleanField value={value as boolean} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>
      
      case "date":
      case "datetime":
        return <div className="space-y-2"><Label className="text-sm font-bold">{field.name}</Label><DateField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>
      
      case "select":
        return <div className="space-y-2"><Label className="text-sm font-bold">{field.name}</Label><SelectField value={value as string} onChange={v => handleFieldChange(field.slug, v)} options={options} required={field.required} /></div>
      
      case "tags":
      case "hashtags":
        return <div className="space-y-2"><Label className="text-sm font-bold">{field.name}</Label><TagsField value={value as any} onChange={v => handleFieldChange(field.slug, v)} /></div>

      case "media":
      case "file":
        return <div className="space-y-2"><Label className="text-sm font-bold">{field.name}</Label><MediaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} tenantSlug={tenantSlug} /></div>
      
      case "mediaMultiple":
        return <div className="space-y-2"><Label className="text-sm font-bold">{field.name}</Label><MediaMultipleField value={value as string[]} onChange={v => handleFieldChange(field.slug, v)} tenantSlug={tenantSlug} /></div>

      case "relation":
        const relOpts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
        const isMultiple = relOpts?.relationType === 'oneToMany' || relOpts?.relationType === 'manyToMany'
        return (
          <div className="space-y-2">
            <RelationSelectField 
              value={value as any} 
              onChange={v => handleFieldChange(field.slug, v)} 
              tenantSlug={tenantSlug}
              targetSlug={field.relationSlug || ""}
              label={field.name}
              required={field.required}
              multiple={isMultiple}
            />
          </div>
        )

      case "json":
      case "color":
      case "location":
        return <div className="space-y-2"><AdvancedField type={field.type as any} value={value} onChange={v => handleFieldChange(field.slug, v)} label={field.name} required={field.required} /></div>

      case "component":
        let compOpts: any = {}
        try { compOpts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options } catch { compOpts = {} }
        return <ComponentField tenantSlug={tenantSlug} componentSlug={compOpts?.componentSlug} value={value} onChange={v => handleFieldChange(field.slug, v)} label={field.name} repeatable={compOpts?.repeatable} />
      
      default:
        return <div className="space-y-2"><Label className="text-sm font-bold text-slate-700">{field.name}</Label><Input value={value as string || ""} onChange={e => handleFieldChange(field.slug, e.target.value)} /></div>
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
    </div>
  )

  if (!singleType) return null

  return (
    <div className="min-h-screen bg-muted/10">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/cms/${tenantSlug}/single-types`)} className="rounded-full hover:bg-emerald-50">
              <ArrowLeft className="h-5 w-5 text-emerald-600" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-black tracking-tight text-slate-900">{singleType.name}</h1>
                <Badge variant={singleType.publishedAt ? "default" : "secondary"} className="uppercase font-black text-[10px] px-2 py-0.5 rounded-full">
                  {singleType.publishedAt ? "Live" : "Draft"}
                </Badge>
              </div>
              <p className="text-muted-foreground font-medium mt-1">Page Content &middot; /{singleType.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="bg-card rounded-xl font-bold h-11 border-emerald-100 hover:bg-emerald-50">
              Save Draft
            </Button>
            <Button onClick={() => handleSave(true)} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100 font-bold rounded-xl h-11 px-6">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Publish Now
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-none shadow-sm bg-card rounded-3xl overflow-hidden">
              <CardHeader className="border-b bg-emerald-50/30 p-6">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-emerald-600" /> Page Editor
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-10">
                {singleType.fields.length === 0 ? (
                  <div className="text-center py-12 opacity-40">
                    <Zap className="h-12 w-12 mx-auto mb-4 text-emerald-600" />
                    <p className="font-bold">No fields defined for this page</p>
                  </div>
                ) : (
                  singleType.fields.map((field) => (
                    <div key={field.id} className="relative group">
                      <div className="absolute -left-4 top-0 bottom-0 w-1 bg-emerald-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                      {renderField(field)}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-none shadow-sm bg-card rounded-3xl overflow-hidden">
              <CardHeader className="bg-muted/10 border-b p-6">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-600" /> Localization
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Target Language</Label>
                  <Select value={locale} onValueChange={setLocale}>
                    <SelectTrigger className="bg-muted/30 border-none h-11 rounded-xl font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-xl">
                      {availableLocales.map(l => (
                        <SelectItem key={l.locale} value={l.locale} className="font-bold">{l.name} ({l.locale.toUpperCase()})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="p-6 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl text-white shadow-xl shadow-emerald-100 relative overflow-hidden">
              <Zap className="absolute -right-4 -bottom-4 h-24 w-24 opacity-10 rotate-12" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="h-5 w-5 fill-white/20" />
                  <h4 className="font-black uppercase text-xs tracking-widest">Isolated Content</h4>
                </div>
                <p className="text-[11px] leading-relaxed font-medium opacity-90">
                  These changes are specific to <strong>{tenantSlug}</strong> and will not affect other workspaces or the global template.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
