"use client"

import { useState, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft, Save, Send, FileText, CheckCircle2, 
  Clock, Archive, Loader2, Globe, Layout, ChevronDown,
  Calendar as CalendarIcon, Eye, AlertCircle, Check, Plus, Sparkles,
  Copy, History, Shield, Info
} from "lucide-react"
import { useSession } from "next-auth/react"
import { isPlatformStaff } from "@/lib/platform-roles"
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
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { allowedUserTransitions, isWorkflowStatus } from "@/lib/content-workflow-rules"

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
import { DocumentTemplateField } from "@/components/content/field-renderers/document-template-field"
import { ValidationField } from "@/components/content/field-renderers/validation-fields"
import { isFieldVisible } from "@/lib/field-visibility"
import { AIAssistantDialog } from "@/components/content/ai-assistant-dialog"
import { aiFormContext, applyAiFieldValue, applyAiSuggestions, type AiFieldValue } from "@/lib/content/field-ai"
import { roleMeets } from "@/lib/rbac/staff"
import { AISmartFill } from "@/components/content/ai-smart-fill"
import { ContentHistorySidebar } from "@/components/cms/content-history-sidebar"
import { ReviewerAssignment } from "@/components/cms/reviewer-assignment"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { getEntryAction, updateEntryAction } from "@/actions/content"

interface Field {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  localizable?: boolean
  options: any
  relationSlug?: string
}

interface ContentType {
  id: string
  name: string
  slug: string
  description: string | null
  docxTemplateUrl?: string | null
  fields: Field[]
}

interface SavedEntry {
  id: string
  locale: string
  data: unknown
  status: string
  scheduledAt: Date | string | null
  updatedAt: Date | string
}

function readEntryData(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value)
    } catch {
      return {}
    }
  }
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function previewLink(value?: string) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null
  } catch {
    return null
  }
}

const TRANSLATABLE_FIELDS = new Set(["text", "textarea", "richText", "markdown"])

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
    icon: Clock 
  },
  PUBLISHED: { 
    label: "Published", 
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", 
    icon: CheckCircle2 
  },
  ARCHIVED: { 
    label: "Archived", 
    color: "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20",
    icon: Archive 
  },
  REJECTED: { 
    label: "Rejected", 
    color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20", 
    icon: AlertCircle 
  },
}

export default function CMSEditEntryClient({
  tenantSlug,
  contentTypeSlug,
  entryId,
  initialEntry,
  initialContentType: contentType,
  initialAvailableLocales: enabledLocales,
  previewUrl,
  userRole,
  customPermissions: initialCustomPermissions,
}: {
  tenantSlug: string
  contentTypeSlug: string
  entryId: string
  initialEntry: SavedEntry
  initialContentType: ContentType
  initialAvailableLocales: { locale: string; name: string }[]
  previewUrl?: string
  userRole?: string
  customPermissions?: string[] | null
}) {
  const { data: session } = useSession()
  const router = useRouter()
  const { confirm, dialog: confirmDialog } = useConfirm()

  const [loadingLocale, setLoadingLocale] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedEntry, setSavedEntry] = useState<SavedEntry | null>(initialEntry)
  const [savedData, setSavedData] = useState(() => readEntryData(initialEntry.data))
  const [formData, setFormData] = useState(savedData)
  const [entryStatus, setEntryStatus] = useState(initialEntry.status)
  const [locale, setLocale] = useState(initialEntry.locale)
  const activeLocale = useRef(initialEntry.locale)
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(() =>
    initialEntry.scheduledAt ? new Date(initialEntry.scheduledAt) : undefined
  )
  const [translating, setTranslating] = useState(false)
  const [translateOpen, setTranslateOpen] = useState(false)
  const persistedStatus = savedEntry?.status ?? "DRAFT"
  const savedSchedule = savedEntry?.scheduledAt ? new Date(savedEntry.scheduledAt).getTime() : undefined
  const hasUnsavedChanges = formData !== savedData || entryStatus !== persistedStatus || scheduledAt?.getTime() !== savedSchedule
  const availableLocales = enabledLocales.some((item) => item.locale === locale)
    ? enabledLocales
    : [...enabledLocales, { locale, name: locale.toUpperCase() }]
  const translationTargets = enabledLocales.filter((item) => item.locale !== locale)
  const busy = loadingLocale || translating || saving
  const livePreview = previewLink(previewUrl)

  const applyEntry = (entry: SavedEntry | null, data: Record<string, unknown>) => {
    setSavedEntry(entry)
    setSavedData(data)
    setFormData(data)
    setEntryStatus(entry?.status ?? "DRAFT")
    setScheduledAt(entry?.scheduledAt ? new Date(entry.scheduledAt) : undefined)
  }

  const loadLocale = async (targetLocale: string) => {
    const result = await getEntryAction(tenantSlug, contentTypeSlug, entryId, targetLocale)
    if (result.error || !result.entry) throw new Error(result.error || "Entri tidak ditemukan.")
    return { entry: result.entry, isNewTranslation: result.isNewTranslation === true }
  }

  const leaveCurrentLocale = () => !hasUnsavedChanges || confirm({
    title: "Pindah bahasa?",
    description: "Perubahan yang belum disimpan pada bahasa ini akan ditinggalkan.",
    confirmLabel: "Pindah bahasa",
  })

  const handleLocaleChange = async (targetLocale: string) => {
    if (busy || targetLocale === locale || !(await leaveCurrentLocale())) return
    setLoadingLocale(true)
    try {
      const result = await loadLocale(targetLocale)
      applyEntry(result.isNewTranslation ? null : result.entry, readEntryData(result.entry.data))
      activeLocale.current = targetLocale
      setLocale(targetLocale)
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal Memuat Bahasa", description: error instanceof Error ? error.message : undefined })
    } finally {
      setLoadingLocale(false)
    }
  }

  const refreshAfterReview = async () => {
    try {
      const { entry } = await loadLocale(locale)
      if (activeLocale.current !== locale) return
      const updatedData = readEntryData(entry.data)
      if (JSON.stringify(updatedData) !== JSON.stringify(savedData)) {
        toast({ title: "Entri Telah Berubah", description: "Muat ulang editor untuk melihat perubahan terbaru." })
        return
      }
      setSavedEntry(entry)
      setEntryStatus((status) => status === persistedStatus ? entry.status : status)
    } catch {
      toast({ variant: "destructive", title: "Gagal Memuat Status Peninjauan" })
    }
  }

  const handleAiTranslate = async (targetLoc: string) => {
    const texts: Record<string, string> = {}
    for (const field of contentType.fields) {
      const value = formData[field.slug]
      if (field.localizable !== false && TRANSLATABLE_FIELDS.has(field.type) && typeof value === "string" && value.trim()) {
        texts[field.slug] = value
      }
    }
    if (!Object.keys(texts).length) {
      toast({ variant: "destructive", title: "Konten Kosong", description: "Isi kolom teks yang dapat diterjemahkan terlebih dahulu." })
      return
    }
    setTranslateOpen(false)
    if (busy || !(await leaveCurrentLocale())) return

    setTranslating(true)
    try {
      const target = await loadLocale(targetLoc)
      const res = await fetch(`/api/tenant/${tenantSlug}/ai/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceLocale: locale,
          targetLocale: targetLoc,
          data: texts,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.simulated || !data.translatedData) {
        throw new Error(data.error || "Gagal menerjemahkan konten")
      }

      const targetData = readEntryData(target.entry.data)
      applyEntry(target.isNewTranslation ? null : target.entry, targetData)
      setFormData({ ...targetData, ...data.translatedData })
      activeLocale.current = targetLoc
      setLocale(targetLoc)
      toast({
        title: "Konten Berhasil Diterjemahkan",
        description: `Periksa teks bahasa ${targetLoc.toUpperCase()} lalu simpan perubahan.`,
      })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Translasi Gagal",
        description: err.message,
      })
    } finally {
      setTranslating(false)
    }
  }

  const tenantMembership = session?.user?.tenants?.find((tenant) => tenant.slug === tenantSlug || tenant.id === tenantSlug)
  const effectiveRole = userRole || (isPlatformStaff(session?.user?.role) ? "owner" : (tenantMembership?.role || "viewer"))
  const customPermissions = initialCustomPermissions !== undefined 
    ? initialCustomPermissions 
    : (Array.isArray(tenantMembership?.customPermissions) ? tenantMembership.customPermissions as string[] : null)

  const availableStatuses = useMemo(() => {
    if (!isWorkflowStatus(persistedStatus)) return ["DRAFT"]
    return [
      persistedStatus,
      ...allowedUserTransitions(persistedStatus, effectiveRole, customPermissions),
    ]
  }, [persistedStatus, effectiveRole, customPermissions])

  const canPublish = availableStatuses.includes("PUBLISHED")
  const canSchedule = availableStatuses.includes("SCHEDULED")

  const handleSave = async (targetStatus?: string) => {
    if (busy) return
    if (targetStatus === "SCHEDULED" && (!scheduledAt || scheduledAt.getTime() <= Date.now())) {
      toast({ variant: "destructive", title: "Jadwal Belum Valid", description: "Pilih tanggal dan waktu publikasi yang akan datang." })
      return
    }
    setSaving(true)

    try {
      const res = await updateEntryAction(tenantSlug, contentTypeSlug, entryId, {
        data: formData,
        status: targetStatus,
        locale,
        scheduledAt: targetStatus === "SCHEDULED" ? scheduledAt : undefined,
        expectedUpdatedAt: savedEntry?.updatedAt ?? null,
        expectedLocaleMissing: !savedEntry,
      })

      if (res.error) {
        let errorDesc = res.error
        if (res.details && typeof res.details === 'object') {
          const detailList = Object.entries(res.details).map(([k, v]) => `${k}: ${v}`).join(", ")
          if (detailList) errorDesc = `${res.error} (${detailList})`
        }
        toast({ variant: "destructive", title: "Gagal Menyimpan", description: errorDesc })
      } else if (res.entry) {
        applyEntry(res.entry, readEntryData(res.entry.data))
        toast({
          title: targetStatus === "PUBLISHED" ? "Entri Berhasil Dipublikasikan" : "Entri Berhasil Diperbarui",
          description: `Perubahan data untuk ${contentType?.name || 'konten'} berhasil disimpan.`
        })
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: error.message || "Gagal menghubungi server" })
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (slug: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [slug]: value,
    }))
  }

  const aiForm = { kind: "contentType", slug: contentTypeSlug } as const
  const aiFields = contentType?.fields || []
  const aiContext = aiFormContext(aiFields, formData, aiForm)
  const canUseAi = roleMeets(effectiveRole, "editor")

  const handleSmartFill = (suggestions: Record<string, AiFieldValue>) => {
    setFormData((current) => applyAiSuggestions(aiFields, current, suggestions, aiForm))
  }

  const renderField = (field: Field) => {
    const value = formData[field.slug]

    const renderLabelWithAI = () => (
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-foreground flex items-center gap-1">
          {field.name}
          {field.required && <span className="text-destructive">*</span>}
        </Label>
        {canUseAi && !busy && <AIAssistantDialog
          key={locale}
          tenantSlug={tenantSlug}
          form={aiForm}
          field={field}
          value={value}
          context={aiContext}
          locale={locale}
          onApply={(suggestion) => setFormData((current) => ({
            ...current, [field.slug]: applyAiFieldValue(field, current[field.slug], suggestion),
          }))}
        />}
      </div>
    )

    switch (field.type) {
      case "text":
        return <div className="space-y-1.5">{renderLabelWithAI()}<TextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>

      case "slug":
        return (
          <div className="space-y-1.5">
            {renderLabelWithAI()}
            <SlugField
              value={value as string}
              onChange={v => handleFieldChange(field.slug, v)}
              required={field.required}
              sourceValue={formData.title as string || formData.judul as string || formData.name as string}
            />
          </div>
        )

      case "textarea":
        return <div className="space-y-1.5">{renderLabelWithAI()}<TextareaField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>

      case "richText":
        return <div className="space-y-1.5">{renderLabelWithAI()}<RichTextField value={value as string} onChange={v => handleFieldChange(field.slug, v)} /></div>

      case "markdown":
        return <div className="space-y-1.5">{renderLabelWithAI()}<MarkdownField value={value as string} onChange={v => handleFieldChange(field.slug, v)} /></div>

      case "number":
        return <div className="space-y-1.5">{renderLabelWithAI()}<NumberField value={value as number} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>

      case "currency":
        return <div className="space-y-1.5">{renderLabelWithAI()}<CurrencyField value={value as number} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>

      case "boolean":
        return <BooleanField label={field.name} value={value as boolean} onChange={v => handleFieldChange(field.slug, v)} />

      case "date":
        return <div className="space-y-1.5">{renderLabelWithAI()}<DateField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>

      case "dateRange":
        return <div className="space-y-1.5">{renderLabelWithAI()}<DateRangeField value={value as any} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>

      case "datetime":
        return <div className="space-y-1.5">{renderLabelWithAI()}<DateTimeField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} type="datetime" /></div>

      case "time":
        return <div className="space-y-1.5">{renderLabelWithAI()}<DateTimeField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} type="time" /></div>

      case "email":
        return <div className="space-y-1.5">{renderLabelWithAI()}<ValidationField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} type="email" /></div>

      case "uid":
        return <div className="space-y-1.5">{renderLabelWithAI()}<ValidationField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} type="uid" /></div>

      case "select":
        return <div className="space-y-1.5">{renderLabelWithAI()}<SelectField value={value as string} onChange={v => handleFieldChange(field.slug, v)} options={field.options?.choices || field.options?.options || field.options || []} required={field.required} /></div>

      case "multiselect":
        return <div className="space-y-1.5">{renderLabelWithAI()}<MultiSelectField value={value as string[]} onChange={v => handleFieldChange(field.slug, v)} options={field.options?.choices || field.options?.options || field.options || []} required={field.required} /></div>

      case "tags":
        return <div className="space-y-1.5">{renderLabelWithAI()}<TagsField value={Array.isArray(value) ? value : (typeof value === 'string' && value ? [value] : [])} onChange={v => handleFieldChange(field.slug, v)} /></div>

      case "media":
        return <div className="space-y-1.5">{renderLabelWithAI()}<MediaField value={value as any} onChange={v => handleFieldChange(field.slug, v)} tenantSlug={tenantSlug} type="image" /></div>

      case "file":
        return <div className="space-y-1.5">{renderLabelWithAI()}<MediaField value={value as any} onChange={v => handleFieldChange(field.slug, v)} tenantSlug={tenantSlug} type="file" /></div>

      case "mediaMultiple":
        return <div className="space-y-1.5">{renderLabelWithAI()}<MediaMultipleField value={Array.isArray(value) ? value : []} onChange={v => handleFieldChange(field.slug, v)} tenantSlug={tenantSlug} /></div>


      case "relation": {
        const isMultiple = field.options?.relationType === "oneToMany" || 
                           field.options?.relationType === "manyToMany" || 
                           field.options?.multiple === true
        const targetSlug = field.relationSlug || field.options?.targetSlug || ""
        return (
          <div className="space-y-1.5">
            {renderLabelWithAI()}
            <RelationSelectField
              value={value as any}
              onChange={v => handleFieldChange(field.slug, v)}
              targetSlug={targetSlug}
              targetModel={field.options?.targetModel}
              tenantSlug={tenantSlug}
              required={field.required}
              multiple={isMultiple}
              relationType={field.options?.relationType}
            />
          </div>
        )
      }

      case "component":
        return <div className="space-y-1.5"><ComponentField allowAi={canUseAi && !busy} locale={locale} label={field.name} componentSlug={field.options?.componentSlug} value={value} onChange={v => handleFieldChange(field.slug, v)} tenantSlug={tenantSlug} repeatable={field.options?.repeatable} /></div>

      case "repeater":
        return <div className="space-y-1.5"><DynamicZoneField allowAi={canUseAi && !busy} locale={locale} label={field.name} allowedComponents={field.options?.allowedComponents || []} value={value as any} onChange={v => handleFieldChange(field.slug, v)} tenantSlug={tenantSlug} /></div>

      case "json":
        return <div className="space-y-1.5">{renderLabelWithAI()}<AdvancedField type="json" value={value} onChange={v => handleFieldChange(field.slug, v)} label={field.name} required={field.required} /></div>

      case "color":
        return <div className="space-y-1.5">{renderLabelWithAI()}<AdvancedField type="color" value={value} onChange={v => handleFieldChange(field.slug, v)} label={field.name} required={field.required} /></div>

      case "location":
        return <div className="space-y-1.5">{renderLabelWithAI()}<AdvancedField type="location" value={value} onChange={v => handleFieldChange(field.slug, v)} label={field.name} required={field.required} /></div>

      case "url":
        return <div className="space-y-1.5">{renderLabelWithAI()}<UrlField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>

      case "phone":
        return <div className="space-y-1.5">{renderLabelWithAI()}<PhoneField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>

      case "password":
        return <div className="space-y-1.5">{renderLabelWithAI()}<PasswordField value={value as string} onChange={v => handleFieldChange(field.slug, v)} required={field.required} /></div>

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

      case "document_template":
        return (
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">{field.name}</Label>
            <DocumentTemplateField 
              field={field}
              value={value}
              onChange={v => handleFieldChange(field.slug, v)}
              tenantSlug={tenantSlug}
              contentTypeSlug={contentTypeSlug}
              entryId={entryId}
              allFields={contentType?.fields || []}
              entryData={formData}
            />
          </div>
        )
      
      default:
        return <div className="space-y-1.5"><Label className="text-xs font-bold text-foreground">{field.name}</Label><Input className="h-9 rounded-xl text-xs bg-background border-border/80" value={value as string || ""} onChange={e => handleFieldChange(field.slug, e.target.value)} /></div>
    }
  }

  const statusCfg = STATUS_CONFIG[persistedStatus] || STATUS_CONFIG.DRAFT
  const StatusIcon = statusCfg.icon

  return (
    <div className="flex flex-1 flex-col w-full">
      {confirmDialog}
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
                    Edit {contentType?.name || "Entri"}
                  </h1>
                  <Badge className={cn("text-[10px] font-bold uppercase rounded-md", statusCfg.color)}>
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {statusCfg.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  {savedEntry ? `ID: ${savedEntry.id}` : "Terjemahan baru"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {!busy && canUseAi && (
                <AISmartFill
                  key={locale}
                  form={aiForm}
                  locale={locale}
                  tenantSlug={tenantSlug}
                  contentTypeName={contentType.name}
                  schema={contentType.fields || []}
                  onApply={handleSmartFill}
                  currentValues={formData}
                />
              )}

              {livePreview && savedEntry && (
                <Button asChild variant="outline" size="sm" className="rounded-xl h-9 text-xs font-bold border-border/80">
                  <a href={livePreview} target="_blank" rel="noopener noreferrer">
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    Live Preview
                  </a>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSave()}
                disabled={busy}
                className="rounded-xl h-9 text-xs font-bold border-border/80"
              >
                {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Simpan
              </Button>

              {canPublish && persistedStatus !== "PUBLISHED" && (
                <Button
                  size="sm"
                  onClick={() => handleSave("PUBLISHED")}
                  disabled={busy}
                  className="rounded-xl h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                  Publikasikan
                </Button>
              )}
            </div>
          </div>

          {/* Main Grid: Form Left, Workflow & Meta Sidebar Right */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Form Fields Section */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
                <CardHeader className="pb-4 border-b border-border/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-foreground">Data Isian Konten</CardTitle>
                      <CardDescription className="text-xs">Ubah data atribut entri sesuai kebutuhan.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {availableLocales.length > 1 && (
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                          <Select value={locale} onValueChange={handleLocaleChange} disabled={busy}>
                            <SelectTrigger aria-label="Bahasa entri" className="h-8 w-32 text-xs font-bold rounded-xl bg-background border-border/80">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border">
                              {availableLocales.map((loc) => (
                                <SelectItem key={loc.locale} value={loc.locale} className="text-xs font-medium">
                                  {loc.name || loc.locale.toUpperCase()}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* AI Translate Dropdown Action */}
                      {translationTargets.length > 0 && <Popover open={translateOpen} onOpenChange={setTranslateOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            className="h-8 rounded-xl text-xs font-bold border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/5 hover:bg-purple-500/10 shadow-xs gap-1.5"
                          >
                            {translating ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3" />
                            )}
                            AI Auto-Translate
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2 rounded-2xl border-border bg-card shadow-xl" align="end">
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1 block">
                              Terjemahkan Ke Bahasa:
                            </span>
                            {translationTargets.map((target) => (
                              <button
                                key={target.locale}
                                type="button"
                                onClick={() => handleAiTranslate(target.locale)}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-between cursor-pointer"
                              >
                                <span>{target.name || target.locale.toUpperCase()}</span>
                                <Globe className="h-3 w-3 opacity-50" />
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-5">
                  {loadingLocale && <p role="status" className="text-xs text-muted-foreground">Memuat konten untuk bahasa pilihan…</p>}
                  <fieldset className="space-y-5" disabled={busy}>
                  {(() => {
                    const visibleFields = (contentType?.fields || []).filter((f: any) => {
                      if (f.showInCms === false) return false
                      if (typeof f.options === 'object' && f.options !== null && f.options.showInCms === false) return false
                      if (!isFieldVisible(f, formData)) return false
                      return true
                    })

                    if (visibleFields.length > 0) {
                      return visibleFields.map((field: any) => (
                        <div key={field.id} className="space-y-1">
                          {renderField(field)}
                        </div>
                      ))
                    }

                    return (
                      <div className="py-12 text-center text-muted-foreground">
                        <Layout className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-semibold">Tidak ada kolom yang ditampilkan di CMS</p>
                        <p className="text-xs mt-1">Aktifkan "Tampilkan di CMS" melalui Content Type Builder.</p>
                      </div>
                    )
                  })()}
                  </fieldset>
                </CardContent>
              </Card>
            </div>

            {/* Right Sidebar: Status, Workflow, History */}
            <div className="space-y-6">
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
                <CardHeader className="pb-3 border-b border-border/60">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" /> Pengaturan Alur Kerja (Workflow)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {/* Status Selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Status Konten</Label>
                    <Select value={entryStatus} onValueChange={setEntryStatus} disabled={busy}>
                      <SelectTrigger className="h-9 rounded-xl text-xs font-bold bg-background border-border/80">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border">
                        {availableStatuses.map((st) => (
                          <SelectItem key={st} value={st} className="text-xs font-medium">
                            {STATUS_CONFIG[st]?.label || st}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Peran Anda: <span className="capitalize font-bold text-foreground">{effectiveRole}</span>.
                    </p>
                  </div>

                  {/* Scheduled Publishing */}
                  {canSchedule && entryStatus === "SCHEDULED" && (
                    <div className="space-y-2 pt-3 border-t border-border/60">
                      <Label htmlFor="publication-schedule" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5 text-purple-500" /> Jadwal Publikasi Otomatis
                      </Label>
                      <Input
                        id="publication-schedule"
                        type="datetime-local"
                        value={scheduledAt ? format(scheduledAt, "yyyy-MM-dd'T'HH:mm") : ""}
                        onChange={(event) => setScheduledAt(event.currentTarget.value ? new Date(event.currentTarget.value) : undefined)}
                        disabled={busy}
                        className="h-9 rounded-xl text-xs border-border/80"
                      />
                    </div>
                  )}

                  {/* Quick Save Action Button */}
                  <div className="pt-3 border-t border-border/60">
                    <Button
                      className="w-full h-10 font-bold rounded-xl text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                      onClick={() => handleSave(entryStatus)}
                      disabled={busy}
                    >
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Simpan Perubahan
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Reviewer Assignment & History */}
              {savedEntry && (
                <fieldset key={savedEntry.id} className="space-y-6" disabled={busy}>
                  <ReviewerAssignment
                    tenantSlug={tenantSlug}
                    entryId={savedEntry.id}
                    entryStatus={persistedStatus}
                    onDecisionComplete={refreshAfterReview}
                  />
                  <ContentHistorySidebar
                    tenantSlug={tenantSlug}
                    contentTypeSlug={contentTypeSlug}
                    entryId={savedEntry.id}
                    currentData={formData}
                    onRestoreSuccess={(data, entry) => applyEntry({ ...savedEntry, ...entry }, readEntryData(data))}
                  />
                </fieldset>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  )
}
