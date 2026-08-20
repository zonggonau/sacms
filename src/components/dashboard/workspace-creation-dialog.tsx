"use client"

import { useState } from "react"
import { 
  Loader2, 
  Building2, 
  CheckCircle2, 
  Check,
  Sparkles,
  Layers,
  Users,
  HardDrive,
  Plus
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  workspacePlans: WorkspacePlan[]
  addonPlans: AddonPlan[]
  dbTemplates?: any[]
  initialTemplateId?: string
}

export function WorkspaceCreationDialog({
  open,
  onOpenChange,
  workspacePlans = [],
  addonPlans = [],
}: WorkspaceCreationDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [newWorkspace, setNewWorkspace] = useState({
    name: "",
    description: "",
    plan: "free",
    isAnnual: true,
    selectedAddons: [] as string[]
  })

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
        toast({ title: "Workspace Berhasil Dibuat!", description: "Membuka dashboard workspace baru Anda..." })
        router.push(`/dashboard/${res.tenantId}`)
        onOpenChange(false)
      } else {
        toast({ variant: "destructive", title: "Pembuatan Gagal", description: res.error })
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Terjadi kesalahan jaringan." })
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
    const basePlan = workspacePlans.find(p => (p.plan_slug || p.id) === newWorkspace.plan)
    if (!basePlan) return 0
    
    let basePrice = Number(basePlan.priceAmount) || 0
    if (newWorkspace.isAnnual) {
      basePrice = basePlan.yearlyPrice !== undefined ? Number(basePlan.yearlyPrice) : basePrice * 10
    }
    
    let addonPrice = newWorkspace.selectedAddons.reduce((sum, addonId) => {
      const addon = addonPlans.find(a => a.id === addonId)
      return sum + (Number(addon?.priceAmount) || 0)
    }, 0)
    
    if (newWorkspace.isAnnual) addonPrice = addonPrice * 10

    return basePrice + addonPrice
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[850px] p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <form onSubmit={handleCreateTenant} className="flex flex-col h-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-6 border-b border-border bg-muted/30 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  Launch New Workspace
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Mulai workspace headless CMS baru dengan arsitektur data terisolasi dan performa tinggi.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          {/* Form Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Workspace Info */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ws-name" className="text-xs font-semibold">
                  Nama Workspace <span className="text-destructive">*</span>
                </Label>
                <Input 
                  id="ws-name"
                  placeholder="Contoh: Portal Informasi Papua, E-Commerce Store, dll." 
                  value={newWorkspace.name}
                  onChange={e => setNewWorkspace(prev => ({ ...prev, name: e.target.value }))}
                  className="text-xs h-9"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ws-desc" className="text-xs font-semibold">
                  Deskripsi Singkat <span className="text-muted-foreground font-normal">(Opsional)</span>
                </Label>
                <Textarea 
                  id="ws-desc"
                  placeholder="Jelaskan tujuan atau cakupan proyek workspace ini..." 
                  value={newWorkspace.description}
                  onChange={e => setNewWorkspace(prev => ({ ...prev, description: e.target.value }))}
                  className="text-xs resize-none"
                  rows={2}
                />
              </div>
            </div>

            {/* Plan Selection */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b">
                <div>
                  <Label className="text-xs font-bold text-foreground">
                    Pilih Paket Kapasitas Workspace
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Harga dan batasan disinkronkan langsung dari SaCMS Global.
                  </p>
                </div>

                {/* Monthly / Yearly Toggle */}
                <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      setNewWorkspace(prev => ({ ...prev, isAnnual: false }))
                    }}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md transition-all font-medium",
                      !newWorkspace.isAnnual 
                        ? "bg-background text-foreground shadow-sm font-bold" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Bulanan
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      setNewWorkspace(prev => ({ ...prev, isAnnual: true }))
                    }}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-md transition-all font-medium flex items-center gap-1",
                      newWorkspace.isAnnual 
                        ? "bg-background text-foreground shadow-sm font-bold" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Tahunan
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded">
                      Hemat 2 Bln
                    </span>
                  </button>
                </div>
              </div>
              
              {/* Plans Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {workspacePlans.length === 0 ? (
                  <div className="col-span-full py-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center bg-muted/20 text-xs text-muted-foreground">
                    Memuat paket workspace...
                  </div>
                ) : (
                  workspacePlans.map((plan) => {
                    const planSlug = plan.plan_slug || plan.id
                    const isSelected = newWorkspace.plan === planSlug
                    const price = plan.priceAmount || 0
                    const yearlyPrice = plan.yearlyPrice !== undefined ? plan.yearlyPrice : price * 10
                    const displayPrice = newWorkspace.isAnnual ? yearlyPrice : price
                    const periodLabel = newWorkspace.isAnnual ? "/thn" : "/bln"

                    return (
                      <div 
                        key={plan.id}
                        onClick={() => setNewWorkspace(prev => ({ ...prev, plan: planSlug }))}
                        className={cn(
                          "cursor-pointer p-4 rounded-xl border transition-all duration-150 flex flex-col justify-between relative bg-card",
                          isSelected 
                            ? "border-primary bg-primary/5 ring-1.5 ring-primary shadow-sm" 
                            : "border-border hover:border-primary/50 hover:bg-muted/30"
                        )}
                      >
                        {isSelected && (
                          <div className="absolute top-3 right-3 text-primary">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                        )}

                        <div>
                          <div className="pr-5">
                            <h4 className="font-bold text-sm text-foreground">{plan.name}</h4>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                              {plan.desc}
                            </p>
                          </div>

                          <div className="mt-3 mb-3">
                            <span className="text-base font-extrabold text-foreground">
                              {displayPrice === 0 ? "Gratis" : `Rp ${displayPrice.toLocaleString('id-ID')}`}
                            </span>
                            {displayPrice > 0 && (
                              <span className="text-[10px] text-muted-foreground ml-1">
                                {periodLabel}
                              </span>
                            )}
                          </div>

                          {/* Limits Badges */}
                          <div className="space-y-1 pt-2 border-t border-border/60">
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <Layers className="h-3 w-3 text-primary shrink-0" />
                              <span>{plan.max_content_types && plan.max_content_types < 9999 ? `${plan.max_content_types} Tipe Konten` : "Schema Unlimited"}</span>
                            </div>
                            {plan.max_storage && (
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <HardDrive className="h-3 w-3 text-primary shrink-0" />
                                <span>{plan.max_storage >= 1024 ? `${plan.max_storage / 1024}GB` : `${plan.max_storage}MB`} Storage</span>
                              </div>
                            )}
                            {plan.max_team_members && (
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <Users className="h-3 w-3 text-primary shrink-0" />
                                <span>{plan.max_team_members > 50 ? "Tim Unlimited" : `${plan.max_team_members} Anggota Tim`}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Features List */}
                        {plan.features && plan.features.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-border/40 flex flex-wrap gap-1">
                            {plan.features.slice(0, 2).map((feat, idx) => (
                              <Badge key={idx} variant="secondary" className="text-[9px] px-1.5 py-0 font-normal">
                                {feat}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
          
          {/* Total & Due Today Bar */}
          <div className="p-4 bg-muted/40 border-t border-border flex items-center justify-between shrink-0">
            <div>
              <p className="text-[11px] text-muted-foreground">Total Estimasi Tagihan</p>
              <h3 className="text-lg font-bold text-foreground">
                {calculateTotalPrice() === 0 ? "Rp 0 (Gratis)" : `Rp ${calculateTotalPrice().toLocaleString('id-ID')}`}
              </h3>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">Siklus Penagihan</p>
              <Badge variant="outline" className="text-xs font-bold uppercase mt-0.5">
                {newWorkspace.isAnnual ? "Tahunan (Hemat 2 Bln)" : "Bulanan"}
              </Badge>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="p-4 border-t border-border bg-background shrink-0 flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
              Batal
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              size="sm"
              className="text-xs font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Menginisialisasi Workspace...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Buat Workspace Sekarang
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
