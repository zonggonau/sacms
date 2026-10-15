"use client"

import { useState, useMemo } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { createTenantAction } from "@/actions/tenant"
import { useRouter } from "next/navigation"

export interface WorkspacePlan {
  id: string
  plan_slug?: string
  name: string
  desc: string
  priceAmount: number
  yearlyPrice: number
  max_content_types?: number
  max_content_entries?: number
  max_storage?: number
  max_team_members?: number
  max_locales?: number
  max_api_calls?: number
  features?: string[]
}

export interface AddonPlan {
  id: string
  name: string
  desc?: string
  priceLabel?: string
  priceAmount: number
  icon?: string
}

interface WorkspaceCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspacePlans?: WorkspacePlan[]
  addonPlans?: AddonPlan[]
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
  isEnterpriseLicensed = false,
}: WorkspaceCreationDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Filter rencana paket standar: HANYA Standar, Pro, dan Business
  const standardPlans = useMemo(() => {
    // Enterprise-licensed account: show exactly the one plan the server
    // already prepared, not the normal 3-tier backfill below.
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

    const cleanPlans = workspacePlans.filter(p => {
      const s = `${p.plan_slug || ""} ${p.id || ""} ${p.name || ""}`.toLowerCase()
      return !s.includes("vps") && !s.includes("vds") && !s.includes("storage")
    })

    let standar = cleanPlans.find(p => p.plan_slug === "free" || p.plan_slug === "standar" || p.id === "free")
    let pro = cleanPlans.find(p => p.plan_slug === "pro")
    let business = cleanPlans.find(p => p.plan_slug === "business")

    if (!standar) {
      standar = {
        id: "free",
        plan_slug: "free",
        name: "Standar",
        desc: "Paket dasar terjangkau untuk memulai proyek CMS profesional Anda.",
        priceAmount: 250000,
        yearlyPrice: 1500000,
        max_content_types: 999999,
        max_content_entries: 500,
        max_team_members: 1,
        max_storage: 100,
        features: [
          "Unlimited Content Schemas",
          "500 Entri Konten",
          "1 Anggota Tim",
          "100 MB Object Storage",
          "1.000 API Calls / bulan"
        ]
      }
    } else {
      standar = { ...standar, name: "Standar" }
    }

    if (!pro) {
      pro = {
        id: "pro",
        plan_slug: "pro",
        name: "Pro",
        desc: "Paket lengkap all-inclusive untuk bisnis, media, dan startup modern.",
        priceAmount: 500000,
        yearlyPrice: 3000000,
        max_content_types: 999999,
        max_content_entries: 10000,
        max_team_members: 10,
        max_storage: 5120,
        features: [
          "10.000 Entri Konten",
          "10 Anggota Tim & RBAC",
          "5 GB Cloud Storage Media",
          "100.000 API Requests / bulan",
          "Gratis 1 Custom Domain (.com/.id)",
          "SSL HTTPS Otomatis"
        ]
      }
    } else {
      pro = { ...pro, name: "Pro" }
    }

    if (!business) {
      business = {
        id: "business",
        plan_slug: "business",
        name: "Business",
        desc: "Platform CMS andalan untuk korporasi, portal media nasional, dan traffic tinggi.",
        priceAmount: 830000,
        yearlyPrice: 5000000,
        max_content_types: 999999,
        max_content_entries: 50000,
        max_team_members: 25,
        max_storage: 10240,
        features: [
          "50.000 Entri Konten",
          "25 Anggota Tim",
          "10 GB Cloud Storage Media",
          "1.000.000 API Requests / bulan",
          "Custom SMTP & Extended Audit Log",
          "24/7 Prioritas Support & SLA 99.9%"
        ]
      }
    } else {
      business = { ...business, name: "Business" }
    }

    return [standar, pro, business]
  }, [workspacePlans, isEnterpriseLicensed])

  const defaultPlanSlug = standardPlans[0]?.plan_slug || standardPlans[0]?.id || "free"

  const [newWorkspace, setNewWorkspace] = useState({
    name: "",
    description: "",
    plan: defaultPlanSlug,
    selectedAddons: [] as string[]
  })

  const selectedPlanObj = useMemo(() => {
    return standardPlans.find(p => (p.plan_slug || p.id) === newWorkspace.plan) || standardPlans[0]
  }, [standardPlans, newWorkspace.plan])

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWorkspace.name.trim()) {
      toast({ variant: "destructive", title: "Validasi Gagal", description: "Nama workspace wajib diisi." })
      return
    }

    setIsSubmitting(true)
    try {
      const res = await createTenantAction({
        name: newWorkspace.name.trim(),
        description: newWorkspace.description.trim(),
        plan: newWorkspace.plan,
        addons: newWorkspace.selectedAddons
      })

      if (res.success) {
        toast({ title: "Workspace Berhasil Dibuat!", description: "Mengalihkan ke dashboard workspace baru Anda..." })
        onOpenChange(false)
        router.push(`/dashboard/${res.tenantId}`)
      } else {
        toast({ variant: "destructive", title: "Pembuatan Gagal", description: res.error || "Gagal membuat workspace" })
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

  const calculateTotalPrice = () => {
    if (!selectedPlanObj) return 0

    let basePrice = Number(selectedPlanObj.priceAmount) || 0
    let yearlyPrice = selectedPlanObj.yearlyPrice !== undefined && selectedPlanObj.yearlyPrice > 0
      ? Number(selectedPlanObj.yearlyPrice)
      : basePrice * 10

    let addonPrice = newWorkspace.selectedAddons.reduce((sum, addonId) => {
      const addon = addonPlans.find(a => a.id === addonId)
      const aPrice = Number(addon?.priceAmount) || 0
      return sum + (aPrice * 12)
    }, 0)

    return yearlyPrice + addonPrice
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
                    : "Pilih salah satu dari 3 paket Cloud bawaan (Standar, Pro, Business). Butuh kapasitas storage lebih besar? Upgrade kapan saja dari dashboard workspace setelah dibuat."}
                />

                <div className={cn("grid gap-4 pt-1", isEnterpriseLicensed ? "grid-cols-1 sm:max-w-sm" : "grid-cols-1 sm:grid-cols-3")}>
                    {standardPlans.map((plan) => {
                      const planSlug = plan.plan_slug || plan.id
                      const isSelected = newWorkspace.plan === planSlug
                      const price = Number(plan.priceAmount) || 0
                      const displayPrice = plan.yearlyPrice !== undefined && plan.yearlyPrice > 0
                        ? Number(plan.yearlyPrice)
                        : price * 10
                      const accent = getTierAccent(planSlug)
                      const AccentIcon = accent.icon
                      const limitRows = planLimitRows(plan)
                      const extraFeatures = (plan.features || []).slice(0, 4)

                      return (
                        <Card
                          key={plan.id}
                          onClick={() => setNewWorkspace(prev => ({ ...prev, plan: planSlug }))}
                          className={cn(
                            "cursor-pointer rounded-2xl border py-0 overflow-hidden transition-all duration-200 flex flex-col bg-card hover:shadow-sm relative",
                            isSelected
                              ? "border-primary ring-2 ring-primary shadow-sm"
                              : "border-border/80 hover:border-primary/50"
                          )}
                        >
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
                                  {isEnterpriseLicensed ? "Termasuk dalam Lisensi" : displayPrice === 0 ? "Gratis" : `Rp ${displayPrice.toLocaleString('id-ID')}`}
                                </span>
                                {!isEnterpriseLicensed && displayPrice > 0 && (
                                  <span className="text-xs text-muted-foreground font-semibold">/thn</span>
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
                </div>
              </CardContent>
            </Card>

            {/* Bagian 3: Add-on Ekstra */}
            {addonPlans.length > 0 && (
              <Card className="rounded-2xl border-border/70 shadow-xs py-5 gap-4">
                <CardContent className="px-5 space-y-4">
                  <SectionHeader
                    step={3}
                    title="Add-on & Fitur Ekstra (Opsional)"
                    description="Tingkatkan performa workspace dengan fitur tambahan (tahunan)."
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {addonPlans.map(addon => {
                      const isChecked = newWorkspace.selectedAddons.includes(addon.id)
                      const price = Number(addon.priceAmount) || 0
                      const displayPrice = price * 12

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
                              {displayPrice === 0 ? "Gratis" : `+Rp ${displayPrice.toLocaleString('id-ID')}/thn`}
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
                  {isEnterpriseLicensed ? "Status Billing" : "Total Estimasi Tagihan"}
                </p>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="text-lg font-black text-foreground truncate">
                    {isEnterpriseLicensed
                      ? "Tidak Ada Tagihan Tambahan"
                      : calculateTotalPrice() === 0 ? "Rp 0 (Gratis Selamanya)" : `Rp ${calculateTotalPrice().toLocaleString('id-ID')}`}
                  </h3>
                  {selectedPlanObj && (
                    <Badge variant="outline" className="text-[10px] font-bold uppercase rounded-md border-border/80 shrink-0">
                      {isEnterpriseLicensed ? `Paket ${selectedPlanObj.name}` : <>Paket {selectedPlanObj.name} &bull; Tahunan</>}
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
                disabled={isSubmitting || !newWorkspace.name.trim()}
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
