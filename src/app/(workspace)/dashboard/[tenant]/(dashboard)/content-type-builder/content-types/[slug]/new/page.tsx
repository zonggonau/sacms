"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { 
  ArrowLeft, Save, Send, FileText, CheckCircle2, 
  Clock, Archive, Loader2, Globe, Layout, ChevronDown,
  Calendar as CalendarIcon, Eye, AlertCircle, Check, Plus, Zap
} from "lucide-react"
import { useSession } from "next-auth/react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
import { Calendar } from "@/components/ui/calendar"
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
import { TagsField } from "@/components/content/field-renderers/tags-field"
import { MediaField } from "@/components/content/field-renderers/media-field"
import { ButtonField } from "@/components/content/field-renderers/button-field"
import { MediaMultipleField } from "@/components/content/field-renderers/media-multiple-field"
import { RichTextField } from "@/components/content/field-renderers/rich-text-field"

import { RelationSelectField } from "@/components/content/field-renderers/relation-select-field"
import { ComponentField } from "@/components/content/field-renderers/component-field"
import { AdvancedField } from "@/components/content/field-renderers/advanced-fields"
import { SlugField } from "@/components/content/field-renderers/slug-field"
import { AISmartFill } from "@/components/content/ai-smart-fill"
import { getContentTypeBySlugAction } from "@/actions/content-types"
import { createEntryAction } from "@/actions/content"

interface Field {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  options: any
  relationSlug?: string
}

interface ContentType {
  id: string
  name: string
  slug: string
  description: string | null
  fields: Field[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: "Draft", color: "bg-slate-500", icon: FileText },
  IN_REVIEW: { label: "In Review", color: "bg-blue-500", icon: Clock },
  APPROVED: { label: "Approved", color: "bg-cyan-500", icon: CheckCircle2 },
  SCHEDULED: { label: "Scheduled", color: "bg-purple-500", icon: CalendarIcon },
  PUBLISHED: { label: "Published", color: "bg-emerald-500", icon: Check },
  ARCHIVED: { label: "Archived", color: "bg-orange-500", icon: Archive },
  REJECTED: { label: "Rejected", color: "bg-red-500", icon: AlertCircle },
}

export default function CreateEntryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string
  const contentTypeSlug = params?.slug as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contentType, setContentType] = useState<ContentType | null>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [entryStatus, setEntryStatus] = useState<string>("DRAFT")
  const [locale, setLocale] = useState<string>("en")
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(undefined)
  const [availableLocales, setAvailableLocales] = useState<any[]>([{ locale: "en", name: "English" }])
  const [isLimitReached, setIsLimitReached] = useState(false)
  const [entriesLimit, setEntriesLimit] = useState(100)

  const tenants = session?.user?.tenants || []

  useEffect(() => {
    async function fetchData() {
      if (!tenantSlug || !contentTypeSlug || contentType) return
      try {
        const [ctRes, locRes, usageRes] = await Promise.all([
          getContentTypeBySlugAction(tenantSlug, contentTypeSlug),
          fetch(`/api/tenant/${tenantSlug}/locales`),
          fetch(`/api/tenant/${tenantSlug}/billing/usage`)
        ])
        
        if (ctRes.contentType) {
          const data = ctRes.contentType
          setContentType(data as any)
          // Init empty form
          const initialData: Record<string, any> = {}
          data.fields.forEach((f: any) => {
            let isMultiple = false
            if (f.type === "relation" && f.options) {
              try {
                const o = typeof f.options === "string" ? JSON.parse(f.options) : f.options
                if (o?.relationType === "oneToMany" || o?.relationType === "manyToMany") isMultiple = true
              } catch(e) {}
            }
            if (f.type === "mediaMultiple" || isMultiple) {
              initialData[f.slug] = []
            } else {
              initialData[f.slug] = f.type === "boolean" ? false : ""
            }
          })
          setFormData(initialData)
        }
        if (locRes.ok) {
          const data = await locRes.json()
          if (data.locales?.length > 0) setAvailableLocales(data.locales)
        }
        if (usageRes.ok) {
          const usageData = await usageRes.json()
          const entriesUsage = usageData.usage?.find((u: any) => u.label === "Content Entries")
          if (entriesUsage) {
            setEntriesLimit(entriesUsage.limit)
            if (entriesUsage.current >= entriesUsage.limit) {
              setIsLimitReached(true)
            }
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (status === "authenticated") fetchData()
  }, [tenantSlug, contentTypeSlug, status, contentType])

  const handleSave = async (publishNow: boolean = false) => {
    setSaving(true)
    
    let targetStatus = publishNow ? "PUBLISHED" : entryStatus
    if (!publishNow && scheduledAt && targetStatus !== "ARCHIVED") {
      targetStatus = "SCHEDULED"
    }

    try {
      const res = await createEntryAction(tenantSlug, contentTypeSlug, {
        data: formData,
        status: targetStatus,
        locale,
        scheduledAt: scheduledAt || null
      })

      if (res.success) {
        toast({ title: publishNow ? "Published Successfully!" : "Entry Created" })
        router.push(`/dashboard/${tenantSlug}/content-type-builder/content-types/${contentTypeSlug}`)
      } else {
        toast({ variant: "destructive", title: "Error", description: res.error || "Failed to create entry" })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to create entry" })
    } finally {
      setSaving(false)
    }
  }

  const handleAISmartFill = (data: Record<string, any>) => {
    setFormData(prev => ({
      ...prev,
      ...data
    }))
  }

  const handleFieldChange = (slug: string, value: any) => {
    setFormData(prev => ({ ...prev, [slug]: value }))
  }

  const renderField = (field: Field) => {
    const value = formData[field.slug]
    let options: string[] = []
    
    if (field.options) {
      let opts = field.options
      if (typeof field.options === 'string') {
        // Only try to parse if it looks like JSON (starts with [ or {)
        if (field.options.trim().startsWith('[') || field.options.trim().startsWith('{')) {
          try {
            opts = JSON.parse(field.options)
          } catch (e) {
            console.warn(`Failed to parse options for field ${field.slug} as JSON, using as raw string.`)
            opts = field.options
          }
        }
      }
      
      if (Array.isArray(opts)) {
        options = opts
      } else if (typeof opts === 'string') {
        options = opts.split(",").map(o => o.trim()).filter(Boolean)
      }
    }

    switch (field.type) {
      case "document_template":
        return null;

      case "text":
        // Heuristic: if it's a text field but named hashtag/hastag/tags, use TagsField
        if (['hashtag', 'hastag', 'tags'].includes(field.slug.toLowerCase())) {
          return <TagsField value={value as any} onChange={v => handleFieldChange(field.slug, v)} placeholder={`Add ${field.name.toLowerCase()}...`} />
        }
        return <TextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} placeholder={field.name} />
      
      case "slug":
      case "uid":
        // Find source field for auto-generation (usually 'title' or 'name')
        const sourceFieldName = (contentType?.fields.find(f => f.slug === 'title') || contentType?.fields.find(f => f.slug === 'name'))?.slug
        const sourceValue = sourceFieldName ? (formData[sourceFieldName] as string) : ""
        
        return (
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label className="text-sm font-bold text-slate-700">{field.name} {field.required && "*"}</Label>
              <Badge variant="outline" className="text-[9px] opacity-50 uppercase tracking-widest font-black">{field.type}</Badge>
            </div>
            <SlugField 
              value={value as string} 
              onChange={v => handleFieldChange(field.slug, v)} 
              required={field.required} 
              placeholder={field.name}
              sourceValue={sourceValue}
            />
          </div>
        )
      
      case "email":
        return <TextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} placeholder="email@example.com" type="email" />

      case "textarea":
      case "markdown":
        return <TextareaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      
      case "richText":
        return <RichTextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      
      case "number":
      case "integer":
        return <NumberField value={value as any} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      
      case "boolean":
        return <BooleanField value={value as boolean} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      
      case "date":
      case "datetime":
      case "time":
        return <DateField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} />
      
      case "select":
        return <SelectField value={value as string} onChange={v => handleFieldChange(field.slug, v)} options={options} required={field.required} />
      
      case "tags":
      case "hashtags":
        return <TagsField value={value as any} onChange={v => handleFieldChange(field.slug, v)} placeholder={`Add ${field.name.toLowerCase()}...`} />

      case "media":
      case "file":
        return <MediaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} tenantSlug={tenantSlug} />
      
      case "mediaMultiple":
        return <MediaMultipleField value={value as string[]} onChange={v => handleFieldChange(field.slug, v)} tenantSlug={tenantSlug} />

      case "relation":
        let relOpts: any = {}
        if (field.options) {
          try {
            relOpts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
          } catch (e) {}
        }
        const isMultiple = relOpts?.relationType === 'oneToMany' || relOpts?.relationType === 'manyToMany'
        return (
          <RelationSelectField 
            value={value as any} 
            onChange={v => handleFieldChange(field.slug, v)} 
            tenantSlug={tenantSlug}
            targetSlug={field.relationSlug || ""}
            label={field.name}
            required={field.required}
            multiple={isMultiple}
          />
        )

      case "button":
        return <ButtonField value={value as any} onChange={v => handleFieldChange(field.slug, v)} label={field.name} required={field.required} />
      
      case "component":
        const opts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
        return <ComponentField tenantSlug={tenantSlug} componentSlug={opts?.componentSlug} value={value} onChange={v => handleFieldChange(field.slug, v)} label={field.name} repeatable={opts?.repeatable} />

      case "json":
        return <AdvancedField type="json" value={value} onChange={v => handleFieldChange(field.slug, v)} label={field.name} required={field.required} />

      case "color":
        return <AdvancedField type="color" value={value} onChange={v => handleFieldChange(field.slug, v)} label={field.name} required={field.required} />

      case "location":
        return <AdvancedField type="location" value={value} onChange={v => handleFieldChange(field.slug, v)} label={field.name} required={field.required} />

      default:
        return <Input value={value as string || ""} onChange={e => handleFieldChange(field.slug, e.target.value)} />
      }
  }

  if (loading) return <div className="flex items-center justify-center flex-1 flex-col w-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  if (!contentType) {
    return (
      <div className="flex flex-1 flex-col w-full">
<div className="flex-1 flex flex-col items-center justify-center p-8 text-center w-full">
          <div className="w-20 h-20 rounded-none bg-red-50 flex items-center justify-center mb-6 text-red-500">
            <AlertCircle className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight">Content Type Not Found</h2>
          <p className="text-muted-foreground mt-2 max-w-sm">
            We couldn't find the structure for <strong>{contentTypeSlug}</strong>. It might have been deleted or moved.
          </p>
          <Button variant="outline" className="mt-8 rounded-none font-bold" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
          </Button>
        </div>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[entryStatus] || STATUS_CONFIG.DRAFT

  return (
    <div className="flex flex-1 flex-col w-full min-h-screen">
      <div className="flex-1 bg-background text-foreground flex w-full flex-col">
        
        {/* Sticky Header */}
        <div className="bg-card/80 backdrop-blur-md border-b border-border/60 px-4 md:px-6 py-3.5 sticky top-0 z-10 shrink-0">
          <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 hover:bg-muted/60" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-base font-black text-foreground">Entri Baru: {contentType?.name}</h1>
                  <Badge className={cn("text-[9px] font-bold uppercase rounded-full px-2 py-0.5", statusCfg.color)}>
                    {statusCfg.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Isi kolom field di bawah untuk membuat entri konten baru.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AISmartFill 
                tenantSlug={tenantSlug} 
                contentTypeName={contentType?.name || ""} 
                schema={contentType?.fields || []}
                onApply={handleAISmartFill}
              />
              <Select value={entryStatus} onValueChange={setEntryStatus}>
                <SelectTrigger className="w-36 bg-card font-bold text-xs rounded-xl border-border/80 h-8">
                  <div className="flex items-center gap-2">
                    <statusCfg.icon className="h-3.5 w-3.5" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-card">
                  {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                    <SelectItem key={val} value={val} className="text-xs font-semibold rounded-lg cursor-pointer">
                      <div className="flex items-center gap-2">
                        <cfg.icon className="h-3.5 w-3.5" />
                        {cfg.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={() => handleSave(true)} disabled={saving || isLimitReached} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 h-8 text-xs rounded-xl shadow-xs">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                Buat & Publikasikan
              </Button>
            </div>
          </div>
        </div>

        {/* Limit Alert */}
        {isLimitReached && (
          <div className="max-w-7xl mx-auto w-full px-4 md:px-6 mt-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="text-xs text-muted-foreground">
                Anda telah mencapai kuota maksimum {entriesLimit} entri. Hapus entri lama atau upgrade paket untuk menambah entri.
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-border/60 p-5 pb-3">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> Editor Konten
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-6">
                  {contentType?.fields.map(field => (
                    <div key={field.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-foreground">{field.name} {field.required && <span className="text-rose-500">*</span>}</Label>
                        <Badge variant="outline" className="text-[9px] font-mono uppercase px-1.5 py-0 rounded-full border-border/60 text-muted-foreground">{field.type}</Badge>
                      </div>
                      {renderField(field)}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            
            <div className="space-y-4">
              <Card className="border border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden">
                <CardHeader className="p-4 pb-2 border-b border-border/60">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    Opsi Publikasi
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Jadwal Publikasi</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-medium rounded-xl border border-border/80 bg-background h-9 text-xs",
                            !scheduledAt && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {scheduledAt ? format(scheduledAt, "PPP") : <span>Tentukan tanggal...</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-lg border border-border bg-card" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduledAt}
                          onSelect={setScheduledAt}
                          initialFocus
                          disabled={(date) => date < new Date()}
                        />
                        {scheduledAt && (
                          <div className="p-2.5 border-t bg-muted/10 flex justify-between items-center text-xs">
                            <Button variant="ghost" size="sm" onClick={() => setScheduledAt(undefined)} className="text-[10px] font-bold rounded-lg h-7">Batal</Button>
                            <span className="text-[10px] text-muted-foreground italic">Otomatis dijadwalkan</span>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Bahasa (Locale)</Label>
                    <Select value={locale} onValueChange={setLocale}>
                      <SelectTrigger className="bg-background border border-border/80 h-9 rounded-xl text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl border border-border bg-card">
                        {availableLocales.map(l => (
                          <SelectItem key={l.locale} value={l.locale} className="rounded-lg text-xs cursor-pointer">{l.name} ({l.locale.toUpperCase()})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    variant="outline" 
                    onClick={() => handleSave(false)} 
                    disabled={saving || isLimitReached} 
                    className="w-full bg-background hover:bg-muted/60 border border-border/80 h-9 rounded-xl font-bold text-xs"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                    Simpan sebagai Draft
                  </Button>
                </CardContent>
              </Card>

              <div className="p-4 bg-primary/5 border border-primary/15 rounded-2xl text-foreground shadow-xs">
                <div className="flex items-center gap-2 mb-1.5 text-primary font-bold text-xs">
                  <Zap className="h-4 w-4" /> AI Smart Fill
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Gunakan fitur AI Smart Fill di bagian atas untuk mengisi seluruh kolom formulir secara otomatis dari prompt deskripsi Anda.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}





