"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { 
  ArrowLeft, Save, Send, FileText, CheckCircle2, 
  Clock, Archive, Loader2, Globe, Layout, ChevronDown,
  Calendar as CalendarIcon, Eye, AlertCircle, Check, ChevronRight
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
import { ContentHistorySidebar } from "@/components/cms/content-history-sidebar"
import { getEntryAction, updateEntryAction } from "@/actions/content"

interface Field {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  localizable: boolean
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

const TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["IN_REVIEW", "PUBLISHED"],
  IN_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["PUBLISHED", "SCHEDULED"],
  SCHEDULED: ["PUBLISHED", "DRAFT"],
  PUBLISHED: ["ARCHIVED", "DRAFT"],
  ARCHIVED: ["DRAFT"],
  REJECTED: ["DRAFT"],
}

export default function EditEntryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string
  const contentTypeSlug = params?.slug as string
  const entryId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [contentType, setContentType] = useState<ContentType | null>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [entryStatus, setEntryStatus] = useState<string>("DRAFT")
  const [reviewComment, setReviewComment] = useState<string | null>(null)
  const [locale, setLocale] = useState<string>("en")
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(undefined)
  const [availableLocales, setAvailableLocales] = useState<any[]>([{ locale: "en", name: "English" }])
  const [showPreview, setShowPreview] = useState(false)

  const tenants = session?.user?.tenants || []

  useEffect(() => {
    async function fetchData() {
      if (!tenantSlug || !contentTypeSlug || !entryId || contentType) return
      try {
        const entRes = await getEntryAction(tenantSlug, contentTypeSlug, entryId)
        const locRes = await fetch(`/api/tenant/${tenantSlug}/locales`)
        
        if (entRes.contentType) setContentType(entRes.contentType as any)
        if (entRes.entry) {
          const entry = entRes.entry
          setEntryStatus(entry.status)
          setReviewComment(entry.reviewComment)
          setLocale(entry.locale)
          if (entry.scheduledAt) setScheduledAt(new Date(entry.scheduledAt))
          
          let parsedData = entry.data
          if (typeof entry.data === 'string') {
            try { parsedData = JSON.parse(entry.data) } catch { parsedData = {} }
          }
          setFormData((parsedData || {}) as Record<string, unknown>)
        }
        if (locRes.ok) {
          const data = await locRes.json()
          if (data.locales?.length > 0) setAvailableLocales(data.locales)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (status === "authenticated") fetchData()
  }, [tenantSlug, contentTypeSlug, entryId, status, contentType])

  const allowedNextStatuses = useMemo(() => {
    const next = TRANSITIONS[entryStatus] || []
    return Array.from(new Set([entryStatus, ...next]))
  }, [entryStatus])

  useEffect(() => {
    if (showPreview) {
      const iframe = document.getElementById("preview-iframe") as HTMLIFrameElement
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: "PREVIEW_UPDATE", data: formData }, "*")
      }
    }
  }, [formData, showPreview])

  const handleSave = async (publishNow: boolean = false) => {
    setSaving(true)
    
    let targetStatus = publishNow ? "PUBLISHED" : entryStatus
    if (!publishNow && scheduledAt && targetStatus !== "ARCHIVED") {
      targetStatus = "SCHEDULED"
    }

    try {
      const res = await updateEntryAction(tenantSlug, contentTypeSlug, entryId, {
        data: formData,
        status: targetStatus,
        locale,
        scheduledAt: scheduledAt || null
      })

      if (res.success) {
        toast({ title: publishNow ? "Published Successfully!" : "Entry Updated" })
        if (publishNow) {
          router.push(`/dashboard/${tenantSlug}/content-type-builder/content-types/${contentTypeSlug}`)
        } else {
          router.refresh()
        }
      } else {
        toast({ variant: "destructive", title: "Error", description: res.error || "Failed to update entry" })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update entry" })
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
        if (field.options.trim().startsWith('[') || field.options.trim().startsWith('{')) {
          try { opts = JSON.parse(field.options) } catch (e) { opts = field.options }
        }
      }
      
      if (Array.isArray(opts)) options = opts
      else if (typeof opts === 'string') options = opts.split(",").map(o => o.trim()).filter(Boolean)
    }

    switch (field.type) {
      case "document_template":
        return null;

      case "text":
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
          <SlugField 
            value={value as string} 
            onChange={v => handleFieldChange(field.slug, v)} 
            required={field.required} 
            placeholder={field.name}
            sourceValue={sourceValue}
          />
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
            
            required={field.required}
            multiple={isMultiple}
          />
        )
      case "button":
        return <ButtonField value={value as any} onChange={v => handleFieldChange(field.slug, v)}  required={field.required} />
      case "component":
        const cOpts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
        return <ComponentField label={field.name} tenantSlug={tenantSlug} componentSlug={cOpts?.componentSlug} value={value} onChange={v => handleFieldChange(field.slug, v)}  repeatable={cOpts?.repeatable} />
      case "json":
        return <AdvancedField type="json" value={value} onChange={v => handleFieldChange(field.slug, v)}  required={field.required} />
      case "color":
        return <AdvancedField type="color" value={value} onChange={v => handleFieldChange(field.slug, v)}  required={field.required} />
      case "location":
        return <AdvancedField type="location" value={value} onChange={v => handleFieldChange(field.slug, v)}  required={field.required} />
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
        
        {/* Editor Pane */}
        <div className="flex flex-col flex-1 w-full">
          {/* Sticky Header */}
          <div className="bg-card/80 backdrop-blur-md border-b border-border/60 px-4 md:px-6 py-3.5 sticky top-0 z-10 shrink-0">
            <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 hover:bg-muted/60" onClick={() => router.back()}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-base font-black text-foreground">Edit Entri: {contentType?.name}</h1>
                    <Badge className={cn("text-[9px] font-bold uppercase rounded-full px-2 py-0.5", statusCfg.color)}>
                      {statusCfg.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">ID: {entryId.slice(0, 12)}...</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Select 
                  value={entryStatus} 
                  onValueChange={(val) => setEntryStatus(val as any)}
                >
                  <SelectTrigger className="w-36 bg-card font-bold text-xs rounded-xl border-border/80 h-8">
                    <div className="flex items-center gap-2">
                      <statusCfg.icon className="h-3.5 w-3.5" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border bg-card">
                    {Object.entries(STATUS_CONFIG).map(([val, cfg]) => {
                      return (
                        <SelectItem 
                          key={val} 
                          value={val} 
                          className="text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <cfg.icon className="h-3.5 w-3.5" />
                            {cfg.label}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>

                <ContentHistorySidebar 
                  tenantSlug={tenantSlug}
                  contentTypeSlug={contentTypeSlug}
                  entryId={entryId}
                  currentData={formData}
                  onRestoreSuccess={(newData) => setFormData(newData)}
                />

                <Button 
                  variant="outline" 
                  onClick={() => setShowPreview(!showPreview)}
                  className={cn("h-8 px-3 rounded-xl text-xs font-bold border-border/80 shadow-xs", showPreview ? "bg-primary/10 text-primary border-primary/30" : "bg-card")}
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> {showPreview ? "Tutup Preview" : "Live Preview"}
                </Button>

                <Button onClick={() => handleSave(true)} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 h-8 text-xs rounded-xl shadow-xs">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                  Publikasikan
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto flex-1">
            <div className={cn("grid gap-6", showPreview ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3")}>
              <div className={cn("space-y-6", showPreview ? "col-span-1" : "lg:col-span-2")}>
                {entryStatus === "REJECTED" && reviewComment && (
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex gap-3 text-rose-700 dark:text-rose-400 shadow-xs">
                    <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider">Catatan Reviewer</h4>
                      <p className="text-xs mt-0.5 italic">"{reviewComment}"</p>
                    </div>
                  </div>
                )}

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
                          <div className="flex items-center gap-2">
                            <Label className="text-xs font-semibold text-foreground">{field.name} {field.required && <span className="text-rose-500">*</span>}</Label>
                            {field.localizable && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Globe className="h-3.5 w-3.5 text-primary/60 cursor-help" />
                                </PopoverTrigger>
                                <PopoverContent className="w-60 p-3 rounded-xl shadow-lg border border-border bg-card text-xs text-muted-foreground">
                                  Field ini mendukung multibahasa (locale: {locale.toUpperCase()}).
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
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
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status & Publikasi</CardTitle>
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
                      disabled={saving} 
                      className="w-full bg-background hover:bg-muted/60 border border-border/80 h-9 rounded-xl font-bold text-xs"
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                      Simpan Perubahan
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden">
                  <CardHeader className="p-4 pb-2 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Riwayat Entri</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-border/60">
                      <span className="text-muted-foreground text-xs">Status Saat Ini</span>
                      <span className="font-bold text-primary">{statusCfg.label}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-muted-foreground text-xs">Pembuat</span>
                      <span className="font-medium text-foreground">Sistem CMS</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview Pane */}
        {showPreview && (
          <div className="w-1/2 bg-card border-l border-border flex flex-col overflow-hidden relative">
            <div className="bg-muted/50 border-b border-border p-3 flex justify-between items-center text-xs font-bold shrink-0">
              <div className="flex items-center gap-2 text-foreground">
                <Globe className="h-4 w-4 text-primary" />
                Live Preview
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg hover:bg-muted" onClick={() => window.open(`/preview/${tenantSlug}/${contentTypeSlug}/${entryId}`, '_blank')}>
                Buka tab baru <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <div className="flex-1 w-full bg-background relative">
              <iframe 
                id="preview-iframe"
                src={`/preview/${tenantSlug}/${contentTypeSlug}/${entryId}`}
                className="absolute inset-0 w-full h-full border-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
