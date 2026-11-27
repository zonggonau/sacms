"use client"

import { useId, useState, useMemo } from "react"
import {
  Loader2,
  Building2,
  Sparkles,
  Layers,
  Users,
  HardDrive,
  Plus,
  Check,
  Zap,
  Database,
  ShieldCheck,
  type LucideIcon
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { cn, formatRupiah } from "@/lib/utils"
import { resolveYearlyPrice } from "@/lib/billing/plan-price"
import { createTenantAction } from "@/actions/tenant"
import { useRouter } from "next/navigation"

export interface WorkspacePlan {
  id: string
  plan_slug?: string
  name: string
  desc: string
  priceAmount: number
  yearlyPrice: number | null
  max_content_types?: number
  max_content_entries?: number
  max_storage?: number
  max_team_members?: number
  max_api_calls?: number
  features?: string[]
}

export interface AddonPlan {
  id: string
  name: string
  desc?: string
  priceLabel?: string
  priceAmount: number
  yearlyPrice?: number | null
  isTopup?: boolean
  icon?: string
}

interface WorkspaceCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspacePlans?: WorkspacePlan[]
  addonPlans?: AddonPlan[]
  freePlanUnavailableReason: string | null
  dbTemplates?: any[]
  initialTemplateId?: string
  /** When true, `workspacePlans` is the single license-covered plan the
   *  caller already prepared (see dashboard/(global)/page.tsx) — skip the
   *  normal Standar/Pro/Business backfill and render it as-is. */
  isEnterpriseLicensed?: boolean
}

/** Visual accent per tier — purely cosmetic, keyed off plan_slug/id. */
const TIER_ACCENT: Record<string, { icon: LucideIcon; ribbon?: string }> = {
  free: { icon: Layers },
  standar: { icon: Layers },
  pro: { icon: Zap, ribbon: "Paling Populer" },
  business: { icon: ShieldCheck },
}

function getTierAccent(planSlug: string) {
  return TIER_ACCENT[planSlug] || { icon: Sparkles }
}

/** Full, static Tailwind class strings per count (Tailwind's JIT scanner
 *  needs the literal class name present in source — a template string
 *  built from a variable count wouldn't be picked up). A fixed 4-column
 *  grid left a blank 4th slot whenever a paid account hides the Free
 *  tier (3 plans instead of 4) — confirmed live — so the column count now
 *  tracks however many plans are actually being shown, filling the
 *  modal's full width either way. */
function planGridCols(count: number): string {
  switch (count) {
    case 1: return "grid-cols-1"
    case 2: return "grid-cols-1 sm:grid-cols-2"
    case 3: return "grid-cols-1 sm:grid-cols-3"
    default: return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
  }
}

/** The three guaranteed numeric limit rows shown on every plan card. */
function planLimitRows(plan: WorkspacePlan): { icon: LucideIcon; label: string }[] {
  const rows: { icon: LucideIcon; label: string }[] = []
  if (plan.max_content_entries !== undefined) {
    rows.push({ icon: Database, label: `${plan.max_content_entries.toLocaleString("id-ID")} Entri Konten` })
  }
  if (plan.max_storage !== undefined) {
    const size = plan.max_storage >= 1024 ? `${plan.max_storage / 1024} GB` : `${plan.max_storage} MB`
    rows.push({ icon: HardDrive, label: `${size} Media Storage` })
  }
  if (plan.max_team_members !== undefined) {
    rows.push({
      icon: Users,
      label: plan.max_team_members > 50 ? "Tim Unlimited" : `${plan.max_team_members} Anggota Tim`,
    })
  }
  return rows
}

function SectionHeader({
  step,
  title,
  description,
}: {
  step: number
  title: string
  description?: string
}) {
  return (
    <div className="flex items-start gap-2.5 pb-3 mb-1 border-b border-border/50">
      <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
        {step}
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
    </div>
  )
}

export function WorkspaceCreationDialog({
  open,
  onOpenChange,
  workspacePlans = [],
  addonPlans = [],
  freePlanUnavailableReason,
  isEnterpriseLicensed = false,
}: WorkspaceCreationDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const freePlanHint = useId()

  const standardPlans = useMemo(() => {
    if (isEnterpriseLicensed) {
      return workspacePlans.length > 0 ? workspacePlans : [{
        id: "enterprise-license",
        plan_slug: "enterprise",
        name: "Enterprise (Lisensi Anda)",
        desc: "Workspace ini otomatis tercakup oleh Lisensi Enterprise akun Anda.",
        priceAmount: 0,
        yearlyPrice: 0,
        features: ["Konten & Anggota Tim Tanpa Batas", "Storage dari Pool Lisensi Enterprise"],
      }]
    }

    return workspacePlans.filter(p => {
      const s = `${p.plan_slug || ""} ${p.id || ""} ${p.name || ""}`.toLowerCase()
      return !s.includes("vps") && !s.includes("vds") && !s.includes("storage") && !s.includes("enterprise")
    })
  }, [workspacePlans, isEnterpriseLicensed])

  const [newWorkspace, setNewWorkspace] = useState({
    name: "",
    description: "",
    plan: null as string | null,
    selectedAddons: [] as string[]
  })

  const freePlan = standardPlans.find(plan => (plan.plan_slug || plan.id) === "free")
  const defaultPlan = isEnterpriseLicensed ? standardPlans[0] : freePlanUnavailableReason ? undefined : freePlan
  const selectedPlanObj = standardPlans.find(plan => {
    const slug = plan.plan_slug || plan.id
    return slug === newWorkspace.plan && (slug !== "free" || !freePlanUnavailableReason)
  }) ?? defaultPlan
  const selectedPlanSlug = selectedPlanObj?.plan_slug ?? selectedPlanObj?.id
  const monthlyPrice = selectedPlanObj?.priceAmount ?? 0
  const yearlyPrice = resolveYearlyPrice(monthlyPrice, selectedPlanObj?.yearlyPrice)
  const useYearlyPrice = yearlyPrice > 0 || monthlyPrice === 0
  const getAddonPrice = (addon: AddonPlan) => addon.isTopup || !useYearlyPrice
    ? addon.priceAmount
    : resolveYearlyPrice(addon.priceAmount, addon.yearlyPrice)
  const addonTotal = addonPlans
    .filter(addon => newWorkspace.selectedAddons.includes(addon.id))
    .reduce((total, addon) => total + getAddonPrice(addon), 0)
  const estimatedTotal = (useYearlyPrice ? yearlyPrice : monthlyPrice) + addonTotal

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlanSlug || isSubmitting) return
    if (!newWorkspace.name.trim()) {
      toast({ variant: "destructive", title: "Validasi Gagal", description: "Nama workspace wajib diisi." })
      return
    }

    setIsSubmitting(true)
    try {
      const res = await createTenantAction({
        name: newWorkspace.name.trim(),
        description: newWorkspace.description.trim(),
        plan: selectedPlanSlug,
        addons: newWorkspace.selectedAddons
      })

      if ("success" in res && res.success) {
        toast({ title: "Workspace Berhasil Dibuat!", description: "Mengalihkan ke dashboard workspace baru Anda..." })
        onOpenChange(false)
        router.push(`/dashboard/${res.tenantId}`)
      } else {
        toast({ variant: "destructive", title: "Pembuatan Gagal", description: ("error" in res && res.error) || "Gagal membuat workspace" })
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: err.message || "Terjadi kesalahan jaringan." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleAddon = (addonId: string) => {
    setNewWorkspace(prev => {
      const exists = prev.selectedAddons.includes(addonId)
      return {
        ...prev,
        selectedAddons: exists
          ? prev.selectedAddons.filter(id => id !== addonId)
          : [...prev.selectedAddons, addonId]
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl p-0 overflow-hidden max-h-[92vh] flex flex-col rounded-3xl border-border/80 bg-card shadow-2xl gap-0">
        <form onSubmit={handleCreateTenant} className="flex flex-col h-full max-h-[92vh] overflow-hidden">

          {/* Header */}
          <DialogHeader className="p-6 border-b border-border/60 bg-gradient-to-r from-primary/[0.06] via-transparent to-transparent shrink-0 text-left">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs shrink-0">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-xl font-black text-foreground tracking-tight">
                    Inisialisasi Workspace Baru
                  </DialogTitle>
                  <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full border-primary/20 bg-primary/5 text-primary">
                    Multi-Tenant CMS
                  </Badge>
                </div>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Buat ruang kerja headless CMS terisolasi lengkap dengan REST API, GraphQL, dan media storage.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Form Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-muted/10">

            {/* Bagian 1: Identitas Workspace */}
            <Card className="rounded-2xl border-border/70 shadow-xs py-5 gap-4">
              <CardContent className="px-5 space-y-4">
                <SectionHeader step={1} title="Identitas & Akses Workspace" />

                <div className="space-y-1.5">
                  <Label htmlFor="ws-name" className="text-xs font-semibold text-foreground flex items-center gap-1">
                    Nama Workspace <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="ws-name"
                    placeholder="Contoh: Portal Informasi Papua, Toko Online, dll."
                    value={newWorkspace.name}
                    onChange={e => setNewWorkspace(prev => ({ ...prev, name: e.target.value }))}
                    className="text-sm rounded-xl border-border/80 bg-background"
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ws-desc" className="text-xs font-semibold text-foreground">
                    Deskripsi Workspace <span className="text-muted-foreground font-normal">(Opsional)</span>
                  </Label>
                  <Textarea
                    id="ws-desc"
                    placeholder="Deskripsikan tujuan atau ruang lingkup proyek konten workspace ini..."
                    value={newWorkspace.description}
                    onChange={e => setNewWorkspace(prev => ({ ...prev, description: e.target.value }))}
                    className="text-sm resize-none rounded-xl border-border/80 bg-background"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Bagian 2: Pilih Paket Cloud */}
            <Card className="rounded-2xl border-border/70 shadow-xs py-5 gap-4">
              <CardContent className="px-5 space-y-4">
                <SectionHeader
                  step={2}
                  title={isEnterpriseLicensed ? "Paket Workspace" : "Pilih Paket Cloud"}
                  description={isEnterpriseLicensed
                    ? "Workspace ini otomatis memakai Lisensi Enterprise akun Anda — tidak perlu memilih paket."
                    : "Pilih paket yang akan digunakan workspace ini."}
                />

                {freePlan && freePlanUnavailableReason && (
                  <p id={freePlanHint} className="text-xs text-muted-foreground">{freePlanUnavailableReason}</p>
                )}
                {standardPlans.length === 0 && (
                  <p className="text-sm text-muted-foreground" role="status">Katalog paket workspace belum tersedia.</p>
                )}
                <RadioGroup
                  value={selectedPlanSlug}
                  onValueChange={(value) => setNewWorkspace(prev => ({ ...prev, plan: value }))}
                  aria-label="Paket Workspace"
                  className={cn("grid gap-4 pt-1", isEnterpriseLicensed ? "grid-cols-1 sm:max-w-sm" : planGridCols(standardPlans.length))}
                >
                    {standardPlans.map((plan) => {
                      const planSlug = plan.plan_slug || plan.id
                      const isSelected = selectedPlanSlug === planSlug
                      const isUnavailable = planSlug === "free" && !!freePlanUnavailableReason
                      const annualPrice = resolveYearlyPrice(plan.priceAmount, plan.yearlyPrice)
                      const displayPrice = annualPrice > 0 ? annualPrice : plan.priceAmount
                      const accent = getTierAccent(planSlug)
                      const AccentIcon = accent.icon
                      const limitRows = planLimitRows(plan)
                      const extraFeatures = (plan.features || []).slice(0, 4)

                      return (
                        <Card
                          key={plan.id}
                          className={cn(
                            "relative flex flex-col overflow-hidden rounded-2xl border bg-card py-0 transition-all duration-200 focus-within:ring-2 focus-within:ring-ring",
                            isUnavailable && "opacity-70",
                            isSelected
                              ? "border-primary ring-2 ring-primary shadow-sm"
                              : !isUnavailable && "border-border/80 hover:border-primary/50"
                          )}
                        >
                          <RadioGroupItem
                            value={planSlug}
                            aria-label={plan.name}
                            aria-describedby={isUnavailable ? freePlanHint : undefined}
                            disabled={isUnavailable}
                            className="absolute inset-0 z-10 m-0 h-full w-full size-full cursor-pointer opacity-0 disabled:cursor-not-allowed rounded-none border-0 shadow-none"
                          />
                          {accent.ribbon && (
                            <div className="bg-primary text-primary-foreground text-[10px] font-black uppercase py-1 text-center tracking-wider">
                              {accent.ribbon}
                            </div>
                          )}

                          <CardHeader className="p-4 pb-0 gap-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="font-black text-sm text-foreground tracking-tight">{plan.name}</h4>
                                {plan.desc && (
                                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                                    {plan.desc}
                                  </p>
                                )}
                              </div>
                              <div className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
                                isSelected ? "bg-primary/10 border-primary/20 text-primary" : "bg-muted/60 border-border/70 text-muted-foreground"
                              )}>
                                <AccentIcon className="h-4 w-4" />
                              </div>
                            </div>

                            {isSelected && (
                              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                                <Check className="h-3 w-3" />
                              </div>
                            )}

                            {/* Price */}
                            <div className="mt-3 pt-3 border-t border-border/50">
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-foreground">
                                  {isEnterpriseLicensed ? "Termasuk dalam Lisensi" : formatRupiah(displayPrice)}
                                </span>
                                {!isEnterpriseLicensed && displayPrice > 0 && (
                                  <span className="text-xs text-muted-foreground font-semibold">/{annualPrice > 0 ? "tahun" : "bulan"}</span>
                                )}
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="p-4 pt-3 space-y-1.5 flex-1">
                            {limitRows.map((row) => {
                              const RowIcon = row.icon
                              return (
                                <div key={row.label} className="flex items-center gap-2 text-xs text-foreground/90 font-medium">
                                  <RowIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                                  <span>{row.label}</span>
                                </div>
                              )
                            })}

                            {extraFeatures.length > 0 && (
                              <div className="space-y-1.5 pt-2 mt-1 border-t border-border/40">
                                {extraFeatures.map((feat, idx) => (
                                  <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                    <span className="leading-snug">{feat}</span>
                                  </div>
                                ))}
                                {(plan.features?.length || 0) > extraFeatures.length && (
                                  <p className="text-[11px] text-muted-foreground/80 font-medium pl-5">
                                    +{(plan.features!.length - extraFeatures.length)} fitur lainnya
                                  </p>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Bagian 3: Add-on Ekstra */}
            {addonPlans.length > 0 && (
              <Card className="rounded-2xl border-border/70 shadow-xs py-5 gap-4">
                <CardContent className="px-5 space-y-4">
                  <SectionHeader
                    step={3}
                    title="Add-on & Fitur Ekstra (Opsional)"
                    description="Tambahkan fitur atau kuota sesuai kebutuhan workspace."
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {addonPlans.map(addon => {
                      const isChecked = newWorkspace.selectedAddons.includes(addon.id)
                      const displayPrice = getAddonPrice(addon)
                      const period = addon.isTopup ? "sekali bayar" : useYearlyPrice ? "per tahun" : "per bulan"

                      return (
                        <div
                          key={addon.id}
                          onClick={() => toggleAddon(addon.id)}
                          className={cn(
                            "cursor-pointer p-3.5 rounded-xl border transition-all flex items-start gap-2.5 bg-card",
                            isChecked
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border/80 hover:border-primary/50"
                          )}
                        >
                          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <Sparkles className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="font-bold text-xs text-foreground truncate">{addon.name}</h5>
                            {addon.desc && (
                              <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{addon.desc}</p>
                            )}
                            <p className="text-xs font-bold text-primary mt-1">
                              {displayPrice === 0 ? "Gratis" : `+${formatRupiah(displayPrice)} ${period}`}
                            </p>
                          </div>
                          <div className={cn(
                            "w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5",
                            isChecked ? "bg-primary border-primary text-primary-foreground" : "border-border"
                          )}>
                            {isChecked && <Check className="h-2.5 w-2.5" />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Total & Summary Sticky Bottom Bar */}
          <div className="p-4 sm:px-6 bg-muted/30 border-t border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Zap className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  {isEnterpriseLicensed ? "Status Billing" : "Estimasi sebelum pajak"}
                </p>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="text-lg font-black text-foreground truncate">
                    {isEnterpriseLicensed
                      ? "Tidak Ada Tagihan Tambahan"
                      : selectedPlanObj ? formatRupiah(estimatedTotal) : "Pilih paket terlebih dahulu"}
                  </h3>
                  {selectedPlanObj && (
                    <Badge variant="outline" className="text-[10px] font-bold uppercase rounded-md border-border/80 shrink-0">
                      Paket {selectedPlanObj.name}
                      {!isEnterpriseLicensed && (yearlyPrice > 0 || monthlyPrice > 0) && (
                        <> &bull; {useYearlyPrice ? "Tahunan" : "Bulanan"}</>
                      )}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs font-bold h-9 rounded-xl border-border/80"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !selectedPlanSlug || !newWorkspace.name.trim()}
                size="sm"
                className="text-xs font-bold gap-1.5 h-9 rounded-xl shadow-xs cursor-pointer px-4 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Menginisialisasi Workspace...
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    Buat &amp; Buka Workspace
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
