"use client"

import { useEffect, useState, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, Search, ArrowRight, Zap, Globe
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { WorkspaceCreationDialog } from "@/components/dashboard/workspace-creation-dialog"
import { cn } from "@/lib/utils"

export default function TemplatesPage() {
  const { status } = useSession()
  const router = useRouter()
  
  const [dbTemplates, setDbTemplates] = useState<any[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>("All")
  const [searchQuery, setSearchQuery] = useState("")

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [creationTemplateId, setCreationTemplateId] = useState("custom")

  const [workspacePlans, setWorkspacePlans] = useState<any[]>([])
  const [addonPlans, setAddonPlans] = useState<any[]>([])

  const fetchTemplates = async () => {
    setLoadingTemplates(true)
    try {
      const token = process.env.NEXT_PUBLIC_SYSTEM_API_KEY || "cf_cc0045e6f75d9cb58a5a81a4b03dbc5602258b70c06c5c6ce8be304e9474b5fd"
      const res = await fetch("/api/public/content/templates", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok) {
        const json = await res.json()
        const rawTemplates = json.data || []
        const parsed = rawTemplates.map((t: any) => {
          const d = typeof t.data === 'string' ? JSON.parse(t.data) : t.data
          return { ...d, id: t.id }
        })
        setDbTemplates(parsed)
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
      
      const globalToken = process.env.NEXT_PUBLIC_SYSTEM_API_KEY || "cf_cc0045e6f75d9cb58a5a81a4b03dbc5602258b70c06c5c6ce8be304e9474b5fd"

      fetch("/api/public/plans?type=workspace", {
        headers: { "Authorization": `Bearer ${globalToken}` }
      })
        .then(res => res.json())
        .then(json => {
          if (json.plans) {
            const mapped = json.plans.map((p: any) => ({
              id: p.id,
              name: p.name,
              priceAmount: p.price,
              yearlyPrice: p.yearlyPrice,
              desc: p.description || "",
              features: p.features || []
            }))
            setWorkspacePlans(mapped)
          }
        })

      fetch("/api/public/content/sacms-addons", {
        headers: { "Authorization": `Bearer ${globalToken}` }
      })
        .then(res => res.json())
        .then(json => {
          if (json.data) {
            const mapped = json.data.map((entry: any) => ({
              id: entry.data?.id || entry.id,
              name: entry.data?.name || "Add-on",
              priceAmount: entry.data?.price || 0
            }))
            setAddonPlans(mapped)
          }
        })
    }
  }, [status, router])

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>()
    dbTemplates.forEach(tpl => {
      const cat = tpl.kategori_website || tpl.category
      if (cat) cats.add(cat)
    })
    return ["All", ...Array.from(cats)]
  }, [dbTemplates])

  const filteredTemplates = useMemo(() => {
    return dbTemplates.filter(tpl => {
      const cat = tpl.kategori_website || tpl.category
      const matchesCategory = selectedCategory === "All" || cat === selectedCategory
      const matchesSearch = (tpl.name || tpl.nama_template || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (tpl.description || "").toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [dbTemplates, selectedCategory, searchQuery])

  if (status === "loading") return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary/50" /></div>

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 pb-20">
      <div>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">Template Library</h2>
        <p className="text-sm md:text-base text-muted-foreground mt-1 font-medium">Kickstart your workspace with a premium pre-built template.</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 relative z-10">
        <div className="relative w-full md:w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search templates..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-11 bg-card/40 backdrop-blur-xl border-white/10 rounded-xl text-sm font-medium focus-visible:ring-primary/30 shadow-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {uniqueCategories.map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "rounded-xl text-xs h-9 px-5 font-bold shadow-sm transition-all",
                selectedCategory === cat 
                  ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-primary/20 border-transparent"
                  : "bg-card/40 backdrop-blur-xl border-white/10 text-muted-foreground hover:bg-card/60 hover:text-foreground border-transparent"
              )}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loadingTemplates ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="animate-pulse h-[280px] border border-white/5 rounded-[1.5rem] bg-card/20 shadow-xl" />
          ))
        ) : filteredTemplates.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-card/30 backdrop-blur-md border border-white/10 rounded-[2rem] shadow-xl">
            <Globe className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-black tracking-tight text-foreground">No templates found</h3>
            <p className="text-sm font-medium text-muted-foreground mt-1">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          filteredTemplates.map((tpl) => (
            <Card 
              key={tpl.id} 
              onClick={() => { setCreationTemplateId(tpl.template_id || tpl.id); setIsCreateOpen(true); }}
              className="group bg-card/40 backdrop-blur-xl border-white/10 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 rounded-[1.5rem] overflow-hidden flex flex-col cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardContent className="p-0 flex flex-col justify-between h-full relative z-10">
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 rounded-[1rem] bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shadow-inner border border-white/5">
                      <Globe className="h-6 w-6 text-primary" />
                    </div>
                    <Badge variant="outline" className="border-white/10 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-background/50 text-muted-foreground">
                      {tpl.kategori_website || tpl.category || "General"}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-black tracking-tight text-foreground">{tpl.name || tpl.nama_template}</h3>
                  <div className="text-sm text-muted-foreground line-clamp-3 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: tpl.description || "" }} />
                </div>
                <div className="px-6 py-4 border-t border-white/5 bg-muted/20 flex items-center justify-between text-muted-foreground group-hover:bg-primary/5 transition-colors">
                  <span className="text-xs font-bold uppercase tracking-widest text-foreground">Use Template</span>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <WorkspaceCreationDialog 
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        dbTemplates={dbTemplates}
        workspacePlans={workspacePlans}
        addonPlans={addonPlans}
        initialTemplateId={creationTemplateId}
      />
    </div>
  )
}
