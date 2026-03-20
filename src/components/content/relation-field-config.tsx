"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

// ── Relation types ────────────────────────────────────────────────────────────
const RELATION_TYPES = [
  { value: "oneToOne", label: "One to One (hasOne)" },
  { value: "oneToMany", label: "One to Many (hasMany)" },
  { value: "manyToOne", label: "Many to One (belongsTo)" },
  { value: "manyToMany", label: "Many to Many" },
]

const TARGET_MODELS = [
  { value: "content-type", label: "Content Type" },
  { value: "single-type", label: "Single Type" },
]

interface TypeItem {
  slug: string
  name: string
}

interface RelationFieldConfigProps {
  tenantSlug?: string // Optional for global admin
  context: "contentType" | "singleType" | "component"
  relationType: string
  targetModel: string
  targetSlug: string
  onRelationTypeChange: (v: string) => void
  onTargetModelChange: (v: string) => void
  onTargetSlugChange: (v: string) => void
  disabled?: boolean
}

export function RelationFieldConfig({
  tenantSlug,
  relationType,
  targetModel,
  targetSlug,
  onRelationTypeChange,
  onTargetModelChange,
  onTargetSlugChange,
  disabled,
}: RelationFieldConfigProps) {
  const [contentTypes, setContentTypes] = useState<TypeItem[]>([])
  const [singleTypes, setSingleTypes] = useState<TypeItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const fetchCT = tenantSlug 
      ? fetch(`/api/tenant/${tenantSlug}/content-types`).then(r => r.json())
      : fetch(`/api/admin/content-types`).then(r => r.json().then(data => data.contentTypes || []))
    
    const fetchST = tenantSlug
      ? fetch(`/api/tenant/${tenantSlug}/single-types`).then(r => r.json())
      : fetch(`/api/admin/single-types`).then(r => r.json().then(data => data.singleTypes || []))

    Promise.all([fetchCT, fetchST])
      .then(([cts, sts]) => {
        setContentTypes(Array.isArray(cts) ? cts : [])
        setSingleTypes(Array.isArray(sts) ? sts : [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [tenantSlug])

  const targetList = targetModel === "content-type" ? contentTypes : singleTypes

  return (
    <div className="space-y-3 border rounded-md p-3 bg-muted/30">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Konfigurasi Relasi</p>

      <div className="grid grid-cols-2 gap-3">
        {/* Relation type */}
        <div className="space-y-1">
          <Label className="text-xs">Tipe Relasi *</Label>
          <Select value={relationType} onValueChange={onRelationTypeChange} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih tipe relasi…" />
            </SelectTrigger>
            <SelectContent>
              {RELATION_TYPES.map((rt) => (
                <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Target model kind */}
        <div className="space-y-1">
          <Label className="text-xs">Target Model *</Label>
          <Select
            value={targetModel}
            onValueChange={(v) => {
              onTargetModelChange(v)
              onTargetSlugChange("")
            }}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih model…" />
            </SelectTrigger>
            <SelectContent>
              {TARGET_MODELS.map((tm) => (
                <SelectItem key={tm.value} value={tm.value}>{tm.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Target slug selector */}
      {targetModel && (
        <div className="space-y-1">
          <Label className="text-xs">Target *</Label>
          {loading ? (
            <p className="text-xs text-muted-foreground">Memuat…</p>
          ) : (
            <Select value={targetSlug} onValueChange={onTargetSlugChange} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih target…" />
              </SelectTrigger>
              <SelectContent>
                {targetList.map((item) => (
                  <SelectItem key={item.slug} value={item.slug}>
                    {item.name} ({item.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  )
}

// ── Component field config ────────────────────────────────────────────────────

interface ComponentItem {
  slug: string
  name: string
  category?: string
}

interface ComponentFieldConfigProps {
  tenantSlug?: string // Optional for global admin
  componentSlug: string
  repeatable: boolean
  onComponentSlugChange: (v: string) => void
  onRepeatableChange: (v: boolean) => void
  excludeSlug?: string
  disabled?: boolean
}

export function ComponentFieldConfig({
  tenantSlug,
  componentSlug,
  repeatable,
  onComponentSlugChange,
  onRepeatableChange,
  excludeSlug,
  disabled,
}: ComponentFieldConfigProps) {
  const [components, setComponents] = useState<ComponentItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const fetchComponents = tenantSlug
      ? fetch(`/api/tenant/${tenantSlug}/components`).then(r => r.json())
      : fetch(`/api/admin/components`).then(r => r.json().then(data => data.components || []))

    fetchComponents
      .then((data) => setComponents(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [tenantSlug])

  const filtered = excludeSlug
    ? components.filter((c) => c.slug !== excludeSlug)
    : components

  return (
    <div className="space-y-3 border rounded-md p-3 bg-muted/30">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Konfigurasi Component</p>

      <div className="space-y-1">
        <Label className="text-xs">Pilih Component *</Label>
        {loading ? (
          <p className="text-xs text-muted-foreground">Memuat…</p>
        ) : (
          <Select value={componentSlug} onValueChange={onComponentSlugChange} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih component…" />
            </SelectTrigger>
            <SelectContent>
              {filtered.length === 0 ? (
                <SelectItem value="_none" disabled>Tidak ada component tersedia</SelectItem>
              ) : (
                filtered.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name} ({c.slug})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="repeatable-component"
          checked={repeatable}
          onCheckedChange={(checked) => onRepeatableChange(!!checked)}
          disabled={disabled}
        />
        <Label htmlFor="repeatable-component" className={cn("cursor-pointer text-sm", disabled && "opacity-50 cursor-not-allowed")}>
          Repeatable (dapat diisi lebih dari satu kali)
        </Label>
      </div>
    </div>
  )
}

import { cn } from "@/lib/utils"
