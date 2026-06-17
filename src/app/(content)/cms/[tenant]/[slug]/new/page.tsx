"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
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
import { CMSSidebar } from "@/components/cms/cms-sidebar"
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
import { ButtonField } from "@/components/content/field-renderers/button-field"
import { TagsField } from "@/components/content/field-renderers/tags-field"
import { AdvancedField } from "@/components/content/field-renderers/advanced-fields"
import { SlugField } from "@/components/content/field-renderers/slug-field"
import { AIAssistantDialog } from "@/components/content/ai-assistant-dialog"
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
  DRAFT: { label: "Draft", color: "bg-muted text-foreground border border-border rounded-none", icon: FileText },
  IN_REVIEW: { label: "In Review", color: "bg-zinc-100 dark:bg-zinc-800 text-foreground border border-border rounded-none", icon: Clock },
  APPROVED: { label: "Approved", color: "bg-zinc-100 dark:bg-zinc-800 text-foreground border border-border rounded-none", icon: CheckCircle2 },
  SCHEDULED: { label: "Scheduled", color: "bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-none", icon: CalendarIcon },
  PUBLISHED: { label: "Published", color: "bg-zinc-950 dark:bg-zinc-50 text-background border border-border rounded-none", icon: Check },
  ARCHIVED: { label: "Archived", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 rounded-none", icon: Archive },
  REJECTED: { label: "Rejected", color: "bg-red-500/10 text-red-500 border border-red-500/20 rounded-none", icon: AlertCircle },
}

export default function CMSCreateEntryPage() {
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

  useEffect(() => {
    async function fetchData() {
      if (!tenantSlug || !contentTypeSlug || contentType) return
      try {
        const [ctData, locRes] = await Promise.all([
          getContentTypeBySlugAction(tenantSlug, contentTypeSlug),
          fetch(`/api/tenant/${tenantSlug}/locales`)
        ])
        if (ctData && !ctData.error && ctData.contentType) {
          setContentType(ctData.contentType as any)
          // Init empty form
          const initialData: Record<string, any> = {}
          ctData.contentType.fields.forEach((f: Field) => {
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

      if (!res.error) {
        toast({ 
          title: publishNow ? "Published Successfully!" : "Entry Created",
          className: "bg-muted border border-border text-foreground rounded-none shadow-none"
        })
        router.push(window.location.pathname.replace(/\/new\/?$/, ''))
      } else {
        toast({ variant: "destructive", title: "Error", description: res.error })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (slug: string, value: any) => {
    setFormData(prev => ({ ...prev, [slug]: value }))
  }

  const handleAISmartFill = (data: Record<string, any>) => {
    setFormData(prev => ({
      ...prev,
      ...data
    }))
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
      <div className="flex items-center justify-between">
        <Label className="text-sm font-bold text-slate-700">{field.name} {field.required && "*"}</Label>
      </div>
    )

    switch (field.type) {
      case "document_template":
        return null;

      case "text":
        if (['hashtag', 'hastag', 'tags'].includes(field.slug.toLowerCase())) {
          return <div className="space-y-2"><LabelWithAI /><TagsField value={value as any} onChange={v => handleFieldChange(field.slug, v)} /></div>
        }
        return <div className="space-y-2"><LabelWithAI /><TextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} placeholder={field.name} /></div>
      
      case "slug":
      case "uid":
        // Find source field for auto-generation (usually 'title' or 'name')
        const sourceFieldName = (contentType?.fields.find(f => f.slug === 'title') || contentType?.fields.find(f => f.slug === 'name'))?.slug
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
        let relOpts: any = {}
        if (field.options) {
          try {
            relOpts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
          } catch (e) {}
        }
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
        const compOpts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
        return <ComponentField tenantSlug={tenantSlug} componentSlug={compOpts?.componentSlug} value={value} onChange={v => handleFieldChange(field.slug, v)} label={field.name} repeatable={compOpts?.repeatable} />
      
      default:
        return <div className="space-y-2"><Label className="text-sm font-bold">{field.name}</Label><Input value={value as string || ""} onChange={e => handleFieldChange(field.slug, e.target.value)} /></div>
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>

  const statusCfg = STATUS_CONFIG[entryStatus] || STATUS_CONFIG.DRAFT

  return (
    <div className="flex flex-1 flex-col w-full h-[calc(100vh-64px)] overflow-hidden">
      <div className="flex-1 bg-[#f6f6f9] text-foreground flex w-full min-h-0 flex-col">
        <div className="flex flex-col overflow-auto flex-1 min-h-0 w-full">
          {/* Sticky Header */}
          <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 shrink-0">
            <div className="w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-none hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-50">New {contentType?.name}</h1>
                <Badge className={cn("text-[10px] font-black uppercase px-2 py-0.5 shadow-none border", statusCfg.color)}>
                  {statusCfg.label}
                </Badge>
              </div>
              <p className="text-muted-foreground font-medium">Drafting new entry for {contentType?.name.toLowerCase()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AISmartFill 
              tenantSlug={tenantSlug} 
              contentTypeName={contentType?.name || ""} 
              schema={contentType?.fields || []}
              onApply={handleAISmartFill}
            />

            <Select value={entryStatus} onValueChange={setEntryStatus}>
              <SelectTrigger className="w-40 bg-card font-bold text-xs uppercase rounded-none border border-border h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none border border-border bg-card shadow-none">
                {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                  <SelectItem key={val} value={val} className="text-xs font-bold uppercase rounded-none hover:bg-muted">
                    <div className="flex items-center gap-2">
                      <cfg.icon className="h-3.5 w-3.5" />
                      {cfg.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              onClick={() => handleSave(true)} 
              disabled={saving} 
              className="bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 hover:bg-orange-500 hover:text-white dark:hover:bg-orange-500 dark:hover:text-white rounded-none border border-zinc-900 dark:border-zinc-100 h-11 px-6 font-bold transition-colors"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Create & Publish
            </Button>
          </div>
          </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-6 lg:p-8 w-full flex-1 shrink-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border border-border shadow-none bg-card rounded-none overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30 p-6">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-orange-500" /> Content Editor
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-10">
                {contentType?.fields.map(field => (
                  <div key={field.id} className="relative group">
                    <div className="absolute -left-4 top-0 bottom-0 w-1 bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {renderField(field)}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-6">
            <Card className="border border-border shadow-none bg-card rounded-none overflow-hidden">
              <CardHeader className="p-6 pb-2"><CardTitle className="text-base font-bold flex items-center gap-2"><Plus className="h-4 w-4 text-orange-500" /> Options</CardTitle></CardHeader>
              <CardContent className="p-6 pt-2 space-y-6">
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Scheduled Publication</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-bold rounded-none border border-border bg-muted/30 h-11 hover:border-orange-500 transition-colors",
                          !scheduledAt && "text-muted-foreground font-normal"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduledAt ? format(scheduledAt, "PPP") : <span>Set publish date...</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-none overflow-hidden shadow-none border border-border bg-card" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduledAt}
                        onSelect={setScheduledAt}
                        initialFocus
                        disabled={(date) => date < new Date()}
                      />
                      {scheduledAt && (
                        <div className="p-3 border-t bg-muted/10 flex justify-between">
                          <Button variant="ghost" size="sm" onClick={() => setScheduledAt(undefined)} className="text-[10px] uppercase font-black rounded-none hover:bg-muted">Clear</Button>
                          <span className="text-[10px] text-muted-foreground italic pt-2">Will set to SCHEDULED</span>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>

                <Separator className="opacity-50" />

                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Localization</Label>
                  <Select value={locale} onValueChange={setLocale}>
                    <SelectTrigger className="bg-muted/30 border border-border h-11 rounded-none font-bold focus:ring-orange-500"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none border border-border bg-card shadow-none">
                      {availableLocales.map(l => (
                        <SelectItem key={l.locale} value={l.locale} className="font-bold rounded-none">{l.name} ({l.locale.toUpperCase()})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator className="opacity-50" />

                <Button 
                  variant="outline" 
                  onClick={() => handleSave(false)} 
                  disabled={saving} 
                  className="w-full bg-transparent text-foreground hover:bg-muted border border-border h-11 rounded-none font-bold transition-colors hover:border-orange-500"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Draft
                </Button>
              </CardContent>
            </Card>

            <div className="p-6 bg-card border border-border rounded-none text-foreground shadow-none relative">
              <div className="absolute top-0 right-0 w-8 h-8 bg-orange-500 flex items-center justify-center text-white">
                <Zap className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <h4 className="font-black uppercase text-xs tracking-widest text-foreground">AI Power</h4>
              </div>
              <p className="text-[11px] leading-relaxed font-medium text-muted-foreground">
                Use <strong>AI Smart Fill</strong> at the top to populate the entire form from a single prompt or draft.
              </p>
            </div>
          </div>
        </div>
          </div>
        </div>
      </div>
    </div>
  )
}
