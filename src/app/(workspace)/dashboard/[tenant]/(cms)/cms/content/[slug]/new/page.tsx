"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { 
  ArrowLeft, Save, Send, FileText, CheckCircle2, 
  Clock, Archive, Loader2, Globe, Layout, ChevronDown,
  Calendar as CalendarIcon, Eye, AlertCircle, Check, Plus, Sparkles,
  Zap, Info
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
import { allowedInitialStatuses } from "@/lib/content-workflow-rules"

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
import { UrlField } from "@/components/content/field-renderers/url-field"
import { PhoneField } from "@/components/content/field-renderers/phone-field"
import { MultiSelectField } from "@/components/content/field-renderers/multiselect-field"
import { RatingField } from "@/components/content/field-renderers/rating-field"
import { MarkdownField } from "@/components/content/field-renderers/markdown-field"
import { CurrencyField } from "@/components/content/field-renderers/currency-field"
import { DateRangeField } from "@/components/content/field-renderers/date-range-field"
import { DynamicZoneField } from "@/components/content/field-renderers/dynamic-zone-field"
import { PasswordField } from "@/components/content/field-renderers/password-field"
import { PercentField } from "@/components/content/field-renderers/percent-field"
import { IconField } from "@/components/content/field-renderers/icon-field"
import { SeoField } from "@/components/content/field-renderers/seo-field"
import { CodeField } from "@/components/content/field-renderers/code-field"
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
  DRAFT: { 
    label: "Draft", 
    color: "bg-muted text-muted-foreground border-border/80", 
    icon: FileText 
  },
  IN_REVIEW: { 
    label: "In Review", 
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", 
    icon: Clock 
  },
  APPROVED: { 
    label: "Approved", 
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", 
    icon: CheckCircle2 
  },
  SCHEDULED: { 
    label: "Scheduled", 
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20", 
    icon: CalendarIcon 
  },
  PUBLISHED: { 
    label: "Published", 
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", 
    icon: Check 
  },
  ARCHIVED: { 
    label: "Archived", 
    color: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20", 
    icon: Archive 
  },
  REJECTED: { 
    label: "Rejected", 
    color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20", 
    icon: AlertCircle 
  },
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
  const [isLimitReached, setIsLimitReached] = useState(false)
  const [entriesLimit, setEntriesLimit] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const tenantMembership = session?.user?.tenants?.find((tenant) => tenant.slug === tenantSlug || tenant.id === tenantSlug)
  const effectiveRole = session?.user?.role === "super_admin" ? "owner" : (tenantMembership?.role || "viewer")
  const customPermissions = Array.isArray(tenantMembership?.customPermissions)
    ? tenantMembership.customPermissions as string[]
    : null

  const availableStatuses = useMemo(() => {
    return allowedInitialStatuses(effectiveRole, customPermissions)
  }, [effectiveRole, customPermissions])

  const canPublish = availableStatuses.includes("PUBLISHED")
  const canSchedule = availableStatuses.includes("SCHEDULED")

  const fetchData = useCallback(async () => {
    if (!tenantSlug || !contentTypeSlug) return
    try {
      setLoading(true)
      const [ctData, locRes, limitRes, settingsRes] = await Promise.all([
        getContentTypeBySlugAction(tenantSlug, contentTypeSlug),
        fetch(`/api/tenant/${tenantSlug}/locales`),
        fetch(`/api/tenant/${tenantSlug}/subscription/limit-check?feature=content_entries`),
        fetch(`/api/tenant/${tenantSlug}/settings`),
      ])
      
      if (ctData?.error) {
        toast({ variant: "destructive", title: "Gagal Memuat Skema", description: ctData.error })
      } else if (ctData?.contentType) {
        setContentType(ctData.contentType as any)
      }

      if (locRes.ok) {
        const data = await locRes.json()
        if (data.locales?.length > 0) setAvailableLocales(data.locales)
      }

      if (limitRes.ok) {
        const data = await limitRes.json()
        setIsLimitReached(!data.allowed)
        setEntriesLimit(data.max || 0)
      }

      if (settingsRes.ok) {
        const data = await settingsRes.json()
        if (data.settings?.previewUrl) setPreviewUrl(data.settings.previewUrl)
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error Memuat Data" })
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, contentTypeSlug])

  useEffect(() => {
    if (status === "authenticated") fetchData()
  }, [fetchData, status])

  const handleSave = async (publishNow: boolean = false, targetOverride?: string) => {
    if (isLimitReached) {
      toast({ variant: "destructive", title: "Batas Kuota Tercapai", description: "Tingkatkan paket untuk membuat entri baru." })
      return
    }

    setSaving(true)
    let targetStatus = publishNow ? "PUBLISHED" : (targetOverride || entryStatus)
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
          title: publishNow ? "Entri Berhasil Dipublikasikan!" : "Draft Berhasil Dibuat",
          description: "Entri konten baru telah disimpan di database."
        })
        router.push(`/dashboard/${tenantSlug}/cms/content/${contentTypeSlug}`)
      } else {
        toast({ variant: "destructive", title: "Gagal Membuat Entri", description: res.error })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error Menyimpan Data" })
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (slug: string, value: any) => {
    setFormData(prev => ({ ...prev, [slug]: value }))
  }

  const handleAISmartFill = (filledData: Record<string, unknown>) => {
    setFormData(prev => ({ ...prev, ...filledData }))
    toast({ title: "Formulir Diisi Otomatis oleh AI!", description: "Tinjau dan sesuaikan data sebelum mempublikasikan." })
  }

  const handleLivePreview = () => {
    if (!previewUrl) {
      toast({
        title: "Preview URL Belum Dikonfigurasi",
        description: "Buka menu Settings Workspace untuk mengatur URL Frontend Preview Anda.",
      })
      return
    }
    const slugValue = formData.slug || formData.slug_berita || "draft-preview"
    const sep = previewUrl.includes("?") ? "&" : "?"
    const fullUrl = `${previewUrl}${sep}contentType=${contentTypeSlug}&slug=${encodeURIComponent(String(slugValue))}&locale=${locale}&preview=true`
    window.open(fullUrl, "_blank")
  }

  const renderField = (field: Field) => {
    const value = formData[field.slug]
    let options: string[] = []
    
    if (field.options) {
      try {
        const opts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
        if (Array.isArray(opts)) options = opts; else if (opts && Array.isArray(opts.choices)) options = opts.choices
        else if (typeof opts === 'string') options = opts.split(",").map(o => o.trim()).filter(Boolean)
      } catch (e) {
        if (typeof field.options === 'string') options = field.options.split(",").map(o => o.trim()).filter(Boolean)
      }
    }

    const renderLabelWithAI = () => (
      <div className="flex items-center justify-between mb-1.5">
        <Label className="text-xs font-bold text-foreground">
          {field.name} {field.required && <span className="text-primary">*</span>}
        </Label>
        {(field.type === "text" || field.type === "textarea" || field.type === "richText") && (
          <AIAssistantDialog
            tenantSlug={tenantSlug}
            contentTypeSlug={contentTypeSlug}
            fieldName={field.name}
            currentValue={value as string}
            onApply={(content) => handleFieldChange(field.slug, content)}
          />
        )}
      </div>
    )

    switch (field.type) {
      case "document_template":
        return null;

      case "text":
        if (['hashtag', 'hastag', 'tags'].includes(field.slug.toLowerCase())) {
          return <div className="space-y-1.5">{renderLabelWithAI()}<TagsField value={value as any} onChange={v => handleFieldChange(field.slug, v)} /></div>
        }
        return <div className="space-y-1.5">{renderLabelWithAI()}<TextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} placeholder={`Masukkan ${field.name.toLowerCase()}...`} /></div>
      
      case "slug":
      case "uid":
        const sourceFieldName = (contentType?.fields.find(f => f.slug === 'title') || contentType?.fields.find(f => f.slug === 'name'))?.slug
        const sourceValue = sourceFieldName ? (formData[sourceFieldName] as string) : ""
        
        return (
          <div className="space-y-1.5">
            <SlugField 
              label={renderLabelWithAI()}
              value={value as string} 
              onChange={v => handleFieldChange(field.slug, v)} 
              required={field.required} 
              placeholder={field.name}
              sourceValue={sourceValue}
              autoGenerate={true}
            />
          </div>
        )
      
      case "textarea":
        return <div className="space-y-1.5">{renderLabelWithAI()}<TextareaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>
      
      case "date":
      case "datetime":
        return <div className="space-y-1.5">{renderLabelWithAI()}<DateField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>
      
      case "dateRange":
        return <div className="space-y-1.5">{renderLabelWithAI()}<DateRangeField value={value as any} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>
      
      case "markdown":
        return <div className="space-y-1.5">{renderLabelWithAI()}<MarkdownField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>
      
      case "richText":
        return <div className="space-y-1.5">{renderLabelWithAI()}<RichTextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} tenantSlug={tenantSlug} /></div>
      
      case "number":
      case "integer":
        return <div className="space-y-1.5">{renderLabelWithAI()}<NumberField value={value as any} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>
      
      case "currency":
        return <div className="space-y-1.5">{renderLabelWithAI()}<CurrencyField value={value as any} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>
      
      case "boolean":
        return <div className="space-y-1.5"><Label className="text-xs font-bold text-foreground">{field.name}</Label><BooleanField value={value as boolean} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>
      
      case "select":
        return <div className="space-y-1.5"><Label className="text-xs font-bold text-foreground">{field.name}</Label><SelectField value={value as string} onChange={v => handleFieldChange(field.slug, v)} options={options} required={field.required} /></div>
      
      case "tags":
      case "hashtags":
        return <div className="space-y-1.5"><Label className="text-xs font-bold text-foreground">{field.name}</Label><TagsField value={value as any} onChange={v => handleFieldChange(field.slug, v)} /></div>

      case "media":
      case "file":
        return <div className="space-y-1.5"><Label className="text-xs font-bold text-foreground">{field.name}</Label><MediaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} tenantSlug={tenantSlug} /></div>
      
      case "mediaMultiple":
        return <div className="space-y-1.5"><Label className="text-xs font-bold text-foreground">{field.name}</Label><MediaMultipleField value={value as string[]} onChange={v => handleFieldChange(field.slug, v)} tenantSlug={tenantSlug} /></div>

      case "relation":
        let relOpts: any = {}
        if (field.options) {
          try {
            relOpts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
          } catch (e) {}
        }
        const isMultiple = relOpts?.relationType === 'oneToMany' || relOpts?.relationType === 'manyToMany'
        return (
          <div className="space-y-1.5">
            {renderLabelWithAI()}
            <RelationSelectField 
              value={value as any} 
              onChange={v => handleFieldChange(field.slug, v)} 
              tenantSlug={tenantSlug}
              targetSlug={field.relationSlug || ""}
              required={field.required}
              multiple={isMultiple}
            />
          </div>
        )

      case "json":
      case "color":
      case "location":
        return <div className="space-y-1.5">{renderLabelWithAI()}<AdvancedField type={field.type as any} value={value} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>

      case "password":
        return <div className="space-y-1.5">{renderLabelWithAI()}<PasswordField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>

      case "component":
        let compOpts: any = {}
        try { compOpts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options } catch { compOpts = {} }
        return <div className="space-y-1.5">{renderLabelWithAI()}<ComponentField label={null} tenantSlug={tenantSlug} componentSlug={compOpts?.componentSlug} value={value} onChange={v => handleFieldChange(field.slug, v)} repeatable={compOpts?.repeatable} /></div>

      case "repeater":
        return <div className="space-y-1.5">{renderLabelWithAI()}<DynamicZoneField label={null} tenantSlug={tenantSlug} value={value as any[]} onChange={v => handleFieldChange(field.slug, v)} /></div>

      case "url":
        return <div className="space-y-1.5">{renderLabelWithAI()}<UrlField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>

      case "phone":
        return <div className="space-y-1.5">{renderLabelWithAI()}<PhoneField value={value as any} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>

      case "multiselect":
        return <div className="space-y-1.5">{renderLabelWithAI()}<MultiSelectField value={value as any} onChange={v => handleFieldChange(field.slug, v)} options={options} required={field.required} /></div>

      case "rating":
        return <div className="space-y-1.5">{renderLabelWithAI()}<RatingField value={value as number} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>

      case "percent":
        return <div className="space-y-1.5">{renderLabelWithAI()}<PercentField value={value as any} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>

      case "icon":
        return <div className="space-y-1.5">{renderLabelWithAI()}<IconField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>

      case "seo":
        return <div className="space-y-1.5">{renderLabelWithAI()}<SeoField value={value as any} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>

      case "code":
        return <div className="space-y-1.5">{renderLabelWithAI()}<CodeField value={value as any} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>

      case "button":
        return <div className="space-y-1.5">{renderLabelWithAI()}<ButtonField value={value as any} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>
      
      default:
        return <div className="space-y-1.5"><Label className="text-xs font-bold text-foreground">{field.name}</Label><Input className="h-9 rounded-xl text-xs bg-background border-border/80" value={value as string || ""} onChange={e => handleFieldChange(field.slug, e.target.value)} /></div>
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[entryStatus] || STATUS_CONFIG.DRAFT
  const StatusIcon = statusCfg.icon

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">

          {/* Top Bar Navigation & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => router.push(`/dashboard/${tenantSlug}/cms/content/${contentTypeSlug}`)}
                className="h-9 w-9 rounded-xl border-border/80 hover:bg-muted shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">
                    Buat {contentType?.name || "Entri Baru"}
                  </h1>
                  <Badge variant="outline" className={cn("text-[10px] font-bold px-2.5 py-0.5 rounded-full border shadow-none flex items-center gap-1", statusCfg.color)}>
                    <StatusIcon className="h-3 w-3" />
                    {statusCfg.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Membuat draf data baru untuk model koleksi <span className="font-semibold text-foreground">{contentTypeSlug}</span>.
                </p>
              </div>
            </div>

            {/* Top Right Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <AISmartFill 
                tenantSlug={tenantSlug} 
                contentTypeName={contentType?.name || ""} 
                schema={contentType?.fields || []}
                onApply={handleAISmartFill}
              />

              {/* Status Switcher Dropdown */}
              <Select value={entryStatus} onValueChange={setEntryStatus}>
                <SelectTrigger className="w-36 h-9 bg-card font-bold text-xs rounded-xl border-border/80 shadow-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-card shadow-xs">
                  {availableStatuses.map((val) => {
                    const cfg = STATUS_CONFIG[val] || STATUS_CONFIG.DRAFT
                    const Icon = cfg.icon
                    return (
                      <SelectItem key={val} value={val} className="text-xs font-bold rounded-lg cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" />
                          {cfg.label}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>

              {/* Live Preview Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleLivePreview}
                className="h-9 px-3 rounded-xl text-xs font-bold border-border/80 hover:bg-muted transition-all text-muted-foreground hover:text-foreground cursor-pointer"
                title="Buka Live Preview di tab baru"
              >
                <Eye className="h-3.5 w-3.5 mr-1.5 text-primary" />
                Live Preview
              </Button>

              {/* Save Draft Action */}
              <Button
                variant="outline"
                onClick={() => handleSave(false)} 
                disabled={saving || isLimitReached} 
                className="h-9 px-3.5 rounded-xl text-xs font-bold border-border/80 hover:bg-muted transition-all"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                Simpan Draft
              </Button>

              {/* Primary Action Button */}
              {canPublish ? (
                <Button
                  onClick={() => handleSave(true)} 
                  disabled={saving || isLimitReached} 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-4 rounded-xl text-xs font-bold shadow-xs transition-all"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                  Buat & Publish
                </Button>
              ) : availableStatuses.includes("IN_REVIEW") ? (
                <Button
                  onClick={() => handleSave(false, "IN_REVIEW")} 
                  disabled={saving || isLimitReached} 
                  className="bg-amber-600 hover:bg-amber-700 text-white h-9 px-4 rounded-xl text-xs font-bold shadow-xs transition-all"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                  Ajukan Review
                </Button>
              ) : null}
            </div>
          </div>

          {/* Limit Alert if reached */}
          {isLimitReached && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <div className="font-medium">
                Workspace Anda telah mencapai batas kuota entri konten ({entriesLimit} entri). Hapus entri lama atau tingkatkan paket langganan Anda.
              </div>
            </div>
          )}

          {/* Main 2-Column Content Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Left Column: Form Fields Editor (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <div>
                      <CardTitle className="text-sm font-bold text-foreground">Form Editor Konten</CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5">
                        Isi nilai field untuk membuat entri {contentType?.name} baru.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono rounded-md font-semibold">
                    {contentType?.fields.length || 0} Fields
                  </Badge>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  {contentType?.fields.map((field, idx) => (
                    <div key={field.id} className="space-y-1.5">
                      {idx > 0 && <Separator className="my-5 border-border/60" />}
                      {renderField(field)}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Settings, Localization & AI Prompt Sidebar (4 cols) */}
            <div className="lg:col-span-4 space-y-5">
              
              {/* Publication Settings Card */}
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    Pengaturan Publikasi
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Lokalisasi bahasa dan penjadwalan rilis konten.
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 space-y-4">
                  {/* Localization */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Bahasa (Locale)</Label>
                    <Select value={locale} onValueChange={setLocale}>
                      <SelectTrigger className="bg-background border-border/80 h-9 rounded-xl text-xs font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border bg-card">
                        {availableLocales.map((l) => (
                          <SelectItem key={l.locale} value={l.locale} className="text-xs font-medium">
                            {l.name} ({l.locale.toUpperCase()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Scheduled Publish */}
                  {canSchedule && (
                    <div className="space-y-1.5 pt-1">
                      <Label className="text-xs font-semibold text-foreground">Jadwal Rilis Otomatis</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-medium rounded-xl border-border/80 bg-background h-9 text-xs",
                              !scheduledAt && "text-muted-foreground font-normal"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                            {scheduledAt ? format(scheduledAt, "PPP") : "Pilih tanggal rilis..."}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden shadow-xs border-border bg-card" align="start">
                          <Calendar
                            mode="single"
                            selected={scheduledAt}
                            onSelect={setScheduledAt}
                            initialFocus
                            disabled={(date) => date < new Date()}
                          />
                          {scheduledAt && (
                            <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between">
                              <Button variant="ghost" size="sm" onClick={() => setScheduledAt(undefined)} className="text-xs h-7 rounded-lg">
                                Reset Tanggal
                              </Button>
                              <span className="text-[10px] text-muted-foreground font-medium">Status: SCHEDULED</span>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  <Separator className="border-border/60" />

                  <Button 
                    variant="secondary"
                    onClick={() => handleSave(false)} 
                    disabled={saving || isLimitReached} 
                    className="w-full h-9 rounded-xl text-xs font-bold gap-2"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Simpan Draft
                  </Button>
                </CardContent>
              </Card>

              {/* AI Smart Fill Card Info */}
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card p-5 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-bold text-foreground">AI Smart Fill</h3>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Gunakan fitur <strong>AI Smart Fill</strong> di bagian atas untuk mengisikan seluruh formulir model ini secara instan dari satu ide prompt atau draf teks.
                </p>
              </Card>

            </div>

          </div>

        </div>
      </div>
    </div>
  )
}
