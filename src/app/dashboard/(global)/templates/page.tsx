"use client"

import { useEffect, useState, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, Search, ArrowRight, Zap, LayoutDashboard, Settings, Building2, Layout, Globe, FileText, CheckCircle2
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function TemplatesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [dbTemplates, setDbTemplates] = useState<any[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>("All")
  const [searchQuery, setSearchQuery] = useState("")

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [workspacePlans, setWorkspacePlans] = useState<any[]>([
    { 
      id: "free", name: "Free", price: "Rp 0", priceAmount: 0,
      desc: "For small personal projects", 
      features: ["Unlimited Content Types", "500 Entries"]
    }
  ])
  const [addonPlans, setAddonPlans] = useState<any[]>([])

  const [newTenant, setNewMember] = useState({
    name: "",
    description: "",
    plan: "free",
    websiteType: "custom",
    isAnnual: false,
    selectedAddons: [] as string[]
  })

  // Icon mapping
  const IconMap: Record<string, any> = {
    Zap, LayoutDashboard, Search, Settings, Building2, Layout, Globe, FileText
  }

  const fetchTemplates = async () => {
    setLoadingTemplates(true)
    try {
      const token = process.env.NEXT_PUBLIC_SYSTEM_API_KEY || "internal"
      const res = await fetch("/api/public/content/templates", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Cache-Control": "no-cache"
        }
      })
      
      if (res.ok) {
        const json = await res.json()
        setDbTemplates(json.data || [])
      } else {
        const resNoAuth = await fetch("/api/public/content/templates")
        if (resNoAuth.ok) {
          const json = await resNoAuth.json()
          setDbTemplates(json.data || [])
        }
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error)
    } finally {
      setLoadingTemplates(false)
    }
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (status === "authenticated") {
      fetchTemplates()
      
      const globalToken = process.env.NEXT_PUBLIC_SYSTEM_API_KEY || "internal"

      // Fetch dynamic workspace plans
      fetch("/api/public/sacms-global/content/sacms-workspace-pricing?sort=price:asc", {
        headers: { "Authorization": `Bearer ${globalToken}` }
      })
        .then(res => res.json())
        .then(json => {
          if (json.data && Array.isArray(json.data)) {
            const mapped = json.data.map((p: any) => ({
              id: p.plan_slug || p.name.toLowerCase().replace(/\s+/g, '-'),
              name: p.name,
              price: `Rp ${(p.price / 1000).toLocaleString('id-ID')}k`,
              priceAmount: p.price,
              desc: p.description || "",
              features: p.features || []
            }))
            if (mapped.length > 0) setWorkspacePlans(mapped)
          }
        })
        .catch(err => console.error("Failed to fetch workspace plans:", err))

      // Fetch dynamic addons
      fetch("/api/public/sacms-global/content/sacms-addons?sort=price:asc", {
        headers: { "Authorization": `Bearer ${globalToken}` }
      })
        .then(res => res.json())
        .then(json => {
          if (json.data && Array.isArray(json.data)) {
            const mapped = json.data.map((p: any) => ({
              id: p.addon_slug || p.name.toLowerCase().replace(/\s+/g, '-'),
              name: p.name,
              price: `Rp ${(p.price / 1000).toLocaleString('id-ID')}k`,
              priceAmount: p.price,
              desc: p.description || "",
              icon: p.icon || "Zap"
            }))
            if (mapped.length > 0) setAddonPlans(mapped)
          }
        })
        .catch(err => console.error("Failed to fetch addons:", err))
    }
  }, [session, status, router])

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>()
    dbTemplates.forEach(tpl => {
      if (tpl.kategori_website) cats.add(tpl.kategori_website)
    })
    return ["All", ...Array.from(cats)]
  }, [dbTemplates])

  const filteredTemplates = useMemo(() => {
    return dbTemplates.filter(tpl => {
      const matchesCategory = selectedCategory === "All" || tpl.kategori_website === selectedCategory
      const matchesSearch = (tpl.name || tpl.nama_template || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (tpl.description || "").toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [dbTemplates, selectedCategory, searchQuery])

  const openTemplateDialog = (templateId: string) => {
    setNewMember({...newTenant, websiteType: templateId}); 
    setIsCreateOpen(true);
  }

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTenant),
      })

      if (res.ok) {
        const data = await res.json()
        toast({ title: "Workspace Created!", description: "Launching your dashboard..." })
        window.location.href = `/dashboard/${data.tenant.id}`
      } else {
        const data = await res.json()
        toast({ variant: "destructive", title: "Creation Failed", description: data.error })
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
    
    let basePrice = basePlan.priceAmount || 0
    if (newTenant.isAnnual) basePrice = basePrice * 10 
    
    let addonPrice = newTenant.selectedAddons.reduce((sum, addonId) => {
      const addon = addonPlans.find(a => a.id === addonId)
      return sum + (addon?.priceAmount || 0)
    }, 0)
    
    if (newTenant.isAnnual) addonPrice = addonPrice * 10

    return basePrice + addonPrice
  }

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search templates..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-background"
          />
        </div>

        {/* Category Filter Bar */}
        <div className="flex flex-wrap gap-2">
          {uniqueCategories.map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              onClick={() => setSelectedCategory(cat)}
              className="rounded-full text-xs h-8 px-4"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loadingTemplates ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="animate-pulse space-y-4 border border-border p-6 rounded-xl bg-card">
              <div className="h-12 w-12 bg-muted rounded-lg" />
              <div className="h-4 w-2/3 bg-muted rounded" />
              <div className="h-10 w-full bg-muted rounded" />
            </div>
          ))
        ) : filteredTemplates.length > 0 ? (
          filteredTemplates.map((tpl) => {
            const Icon = IconMap[tpl.icon] || Globe
            
            return (
              <Card 
                key={tpl.id} 
                onClick={() => openTemplateDialog(tpl.template_id || tpl.id)}
                className="bg-card rounded-xl shadow-sm hover:shadow-md hover:border-primary/50 cursor-pointer transition-all flex flex-col justify-between overflow-hidden relative min-h-[280px]"
              >
                <CardContent className="p-0 flex flex-col justify-between h-full relative z-10">
                  <div className="p-6 space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                          {tpl.kategori_website || "General"}
                        </Badge>
                        {tpl.is_popular && (
                          <Badge className="text-[10px] uppercase tracking-wider bg-orange-500 text-white border-none">
                            <Zap className="h-3 w-3 mr-1 fill-white" /> Popular
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-lg font-bold tracking-tight text-foreground line-clamp-2">
                        {tpl.name || tpl.nama_template}
                      </h3>
                      <div 
                        className="text-sm text-muted-foreground line-clamp-3"
                        dangerouslySetInnerHTML={{ __html: tpl.description || "" }}
                      />
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <span className="text-xs font-semibold uppercase tracking-wider">Use Template</span>
                    <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            )
          })
        ) : (
          <div className="col-span-full py-16 bg-card rounded-xl border border-dashed flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold">No templates found</h3>
              <p className="text-muted-foreground max-w-sm mx-auto text-sm">
                Try adjusting your search query or category filters.
              </p>
            </div>
            <Button 
              onClick={() => { setSelectedCategory("All"); setSearchQuery(""); }}
              variant="outline" 
            >
              Clear All Filters
            </Button>
          </div>
        )}
      </div>

      {/* Workspace Creation Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b border-border bg-muted/30">
            <DialogTitle className="text-xl font-bold">
              {newTenant.websiteType === 'custom' 
                ? "Launch New Workspace" 
                : `Launch ${dbTemplates.find(t => t.template_id === newTenant.websiteType)?.name || dbTemplates.find(t => t.template_id === newTenant.websiteType)?.nama_template || "Workspace"}`}
            </DialogTitle>
            <DialogDescription>
              {newTenant.websiteType === 'custom' 
                ? "Start fresh or choose from a selection of templates later." 
                : "We'll bootstrap your workspace with the selected premium template."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[60vh] overflow-y-auto">
            <form id="create-workspace-form" onSubmit={handleCreateTenant} className="p-6 space-y-6">
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
                <div className="flex items-center justify-between">
                  <Label>Select a Subscription Plan</Label>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-medium", !newTenant.isAnnual ? "text-primary" : "text-muted-foreground")}>Monthly</span>
                    <Checkbox 
                      checked={newTenant.isAnnual} 
                      onCheckedChange={(checked) => setNewMember({...newTenant, isAnnual: checked as boolean})}
                    />
                    <span className={cn("text-xs font-medium", newTenant.isAnnual ? "text-primary" : "text-muted-foreground")}>Yearly <span className="text-emerald-500">(2 Months Free)</span></span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {workspacePlans.map((plan) => (
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
                            : `Rp ${(newTenant.isAnnual ? (plan.priceAmount! * 10 / 1000) : (plan.priceAmount! / 1000))}k${newTenant.isAnnual ? "/yr" : "/mo"}`}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">{plan.desc}</p>
                      <div className="flex flex-wrap gap-1">
                        {plan.features.map((f: string) => (
                          <Badge key={f} variant="secondary" className="text-[10px] font-normal">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {addonPlans.length > 0 && (
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" /> Premium Add-ons
                  </h4>
                  
                  <div className="space-y-4">
                    {addonPlans.map((addon, idx) => {
                      const IconComp = IconMap[addon.icon] || Zap
                      const isSelected = newTenant.selectedAddons.includes(addon.id)
                      return (
                        <div key={addon.id} className={cn("flex items-center justify-between gap-4", idx > 0 && "pt-4 border-t border-border")}>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <IconComp className="h-4 w-4 text-muted-foreground" />
                              <Label className="font-medium">{addon.name}</Label>
                            </div>
                            <p className="text-xs text-muted-foreground">{addon.price}/month. {addon.desc}</p>
                          </div>
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setNewMember({...newTenant, selectedAddons: [...newTenant.selectedAddons, addon.id]})
                              } else {
                                setNewMember({...newTenant, selectedAddons: newTenant.selectedAddons.filter(a => a !== addon.id)})
                              }
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </form>
          </div>
          
          <div className="p-4 bg-primary text-primary-foreground flex items-center justify-between">
            <div>
              <p className="text-xs opacity-90">Total Due Today</p>
              <h3 className="text-xl font-bold">
                Rp {(calculateTotalPrice() / 1000).toLocaleString()}k
              </h3>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-90">Billing Cycle</p>
              <p className="text-sm font-bold uppercase">{newTenant.isAnnual ? "Annual" : "Monthly"}</p>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit" form="create-workspace-form" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
