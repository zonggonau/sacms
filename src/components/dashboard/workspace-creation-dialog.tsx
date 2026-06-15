"use client"

import { useState, useEffect } from "react"
import { 
  Loader2, Zap, CheckCircle2 
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
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { createTenantAction } from "@/actions/tenant"
import { useRouter } from "next/navigation"

interface WorkspaceCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dbTemplates: any[]
  workspacePlans: any[]
  addonPlans: any[]
  initialTemplateId?: string
}

export function WorkspaceCreationDialog({
  open,
  onOpenChange,
  dbTemplates,
  workspacePlans,
  addonPlans,
  initialTemplateId = "custom"
}: WorkspaceCreationDialogProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [newTenant, setNewMember] = useState({
    name: "",
    description: "",
    plan: "free",
    websiteType: initialTemplateId,
    isAnnual: true,
    selectedAddons: [] as string[]
  })

  // Update websiteType if initialTemplateId changes
  useEffect(() => {
    if (initialTemplateId) {
      setNewMember(prev => ({ ...prev, websiteType: initialTemplateId }))
    }
  }, [initialTemplateId])

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await createTenantAction(newTenant)

      if (res.success) {
        toast({ title: "Workspace Created!", description: "Launching your dashboard..." })
        router.push(`/dashboard/${res.tenantId}`)
        onOpenChange(false)
      } else {
        toast({ variant: "destructive", title: "Creation Failed", description: res.error })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Network error occurred." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const calculateTotalPrice = () => {
    const basePlan = workspacePlans.find(p => p.id === newTenant.plan)
    if (!basePlan) return 0
    
    let basePrice = Number(basePlan.priceAmount) || 0
    if (newTenant.isAnnual) {
      basePrice = basePlan.yearlyPrice !== undefined ? Number(basePlan.yearlyPrice) : basePrice * 10
    }
    
    let addonPrice = newTenant.selectedAddons.reduce((sum, addonId) => {
      const addon = addonPlans.find(a => a.id === addonId)
      return sum + (Number(addon?.priceAmount) || 0)
    }, 0)
    
    if (newTenant.isAnnual) addonPrice = addonPrice * 10

    const selectedTemplate = dbTemplates.find(t => (t.template_id || t.id) === newTenant.websiteType)
    const templateFee = (selectedTemplate?.is_premium && newTenant.plan === 'free') ? 99000 : 0

    return basePrice + addonPrice + templateFee
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b border-border bg-muted/30">
          <DialogTitle className="text-xl font-bold">
            {newTenant.websiteType === 'custom' 
              ? "Launch New Workspace" 
              : `Launch ${dbTemplates.find(t => (t.template_id || t.id) === newTenant.websiteType)?.name || dbTemplates.find(t => (t.template_id || t.id) === newTenant.websiteType)?.nama_template || "Workspace"}`}
          </DialogTitle>
          <DialogDescription>
            {newTenant.websiteType === 'custom' 
              ? "Start fresh or choose from a selection of templates later." 
              : "We'll bootstrap your workspace with the selected premium template."}
            <span className="block text-[9px] mt-1 opacity-50">
              Debug: {dbTemplates.length} templates, {workspacePlans.length} plans loaded.
            </span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="max-h-[60vh] overflow-y-auto">
          <form id="create-workspace-form" onSubmit={handleCreateTenant} className="p-6 space-y-6">
            {workspacePlans.length === 0 && (
              <div className="p-4 bg-orange-50 border border-orange-200 text-orange-700 text-xs rounded-lg">
                <strong>Warning:</strong> No subscription plans were loaded from the database. Please ensure "Seed Global Data" has been run in Admin.
              </div>
            )}
            <div className="space-y-2">
              <Label>Workspace Name</Label>
              <Input 
                placeholder="e.g. My Awesome Project" 
                value={newTenant.name}
                onChange={e => setNewMember({...newTenant, name: e.target.value})}
                required
              />
            </div>

            <div className="space-y-4">
              <Label>Choose a Starting Point</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div 
                  onClick={() => setNewMember({...newTenant, websiteType: 'custom'})}
                  className={cn(
                    "cursor-pointer p-4 rounded-lg border transition-all flex flex-col gap-2",
                    newTenant.websiteType === 'custom' 
                      ? "border-primary bg-primary/5 ring-1 ring-primary" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">Blank Workspace</span>
                    {newTenant.websiteType === 'custom' && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Start with a clean slate and build your own architecture.</p>
                </div>

                {dbTemplates.map((tpl) => (
                  <div 
                    key={tpl.template_id || tpl.id}
                    onClick={() => setNewMember({...newTenant, websiteType: tpl.template_id || tpl.id})}
                    className={cn(
                      "cursor-pointer p-4 rounded-lg border transition-all flex flex-col gap-2",
                      newTenant.websiteType === (tpl.template_id || tpl.id)
                        ? "border-primary bg-primary/5 ring-1 ring-primary" 
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{tpl.name || tpl.nama_template}</span>
                      {newTenant.websiteType === (tpl.template_id || tpl.id) && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                      <p className="text-[10px] text-muted-foreground truncate mr-2">{tpl.category || tpl.kategori_website || "Premium"}</p>
                      {tpl.is_premium ? (
                        <Badge variant="outline" className="text-[9px] h-4 bg-orange-50 text-orange-600 border-orange-200">Premium</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] h-4 bg-emerald-50 text-emerald-600 border-emerald-200">Free</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <Label>Select a Subscription Plan</Label>
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-medium", !newTenant.isAnnual ? "text-primary" : "text-muted-foreground")}>Monthly</span>
                    <Checkbox 
                      checked={newTenant.isAnnual} 
                      onCheckedChange={(checked) => setNewMember({...newTenant, isAnnual: checked as boolean})}
                    />
                    <span className={cn("text-xs font-medium", newTenant.isAnnual ? "text-primary" : "text-muted-foreground")}>Yearly <span className="text-emerald-500">(2 Months Free)</span></span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {workspacePlans.length === 0 ? (
                  <div className="col-span-full py-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center bg-muted/20">
                    <Zap className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm font-bold text-muted-foreground">No plans found</p>
                  </div>
                ) : (
                  workspacePlans.map((plan) => (
                    <div 
                      key={plan.id}
                      onClick={() => setNewMember({...newTenant, plan: plan.id})}
                      className={cn(
                        "cursor-pointer p-4 rounded-lg border transition-all relative",
                        newTenant.plan === plan.id 
                          ? "border-primary bg-primary/5 ring-1 ring-primary" 
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {newTenant.plan === plan.id && (
                        <div className="absolute top-3 right-3 text-primary">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-1 pr-4">
                        <span className="font-semibold text-sm">{plan.name}</span>
                        <span className="font-bold text-sm text-primary">
                          {plan.id === "enterprise" 
                            ? "Custom" 
                            : plan.yearlyPrice === 0 
                              ? "Free" 
                              : `Rp ${(newTenant.isAnnual ? (plan.yearlyPrice || plan.priceAmount! * 10) : plan.priceAmount!).toLocaleString('id-ID')}`}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mb-3 line-clamp-2">{plan.desc}</p>
                      <div className="flex flex-wrap gap-1">
                        {plan.features.slice(0, 3).map((f: string) => (
                          <Badge key={f} variant="secondary" className="text-[8px] px-1 py-0 h-3.5 font-normal">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </form>
        </div>
        
        <div className="p-4 bg-primary text-primary-foreground flex items-center justify-between">
          <div>
            <p className="text-xs opacity-90">Total Due Today</p>
            <h3 className="text-xl font-bold">
              {calculateTotalPrice() === 0 ? "Free" : `Rp ${calculateTotalPrice().toLocaleString('id-ID')}`}
            </h3>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-90">Billing Cycle</p>
            <p className="text-sm font-bold uppercase">{newTenant.isAnnual ? "Annual" : "Monthly"}</p>
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-border">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="create-workspace-form" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
