"use client"

import { useEffect, useState, useMemo } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, Search, ArrowRight, Globe
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { WorkspaceCreationDialog } from "@/components/dashboard/workspace-creation-dialog"
import { cn } from "@/lib/utils"

export default function TemplatesClient({
  initialTemplates,
  initialWorkspacePlans,
  initialAddonPlans
}: {
  initialTemplates: any[]
  initialWorkspacePlans: any[]
  initialAddonPlans: any[]
}) {
  const { status } = useSession()
  const router = useRouter()
  
  const [dbTemplates, setDbTemplates] = useState<any[]>(initialTemplates)
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>("All")
  const [searchQuery, setSearchQuery] = useState("")

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [creationTemplateId, setCreationTemplateId] = useState("custom")

  const [workspacePlans, setWorkspacePlans] = useState<any[]>(initialWorkspacePlans)
  const [addonPlans, setAddonPlans] = useState<any[]>(initialAddonPlans)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
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
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Template Library</h2>
        <p className="text-muted-foreground mt-1">Kickstart your workspace with a premium pre-built template.</p>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {uniqueCategories.map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              onClick={() => setSelectedCategory(cat)}
              className="rounded-full"
            >
              {cat}
            </Button>
          ))}
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search templates..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loadingTemplates ? (
          Array(4).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse h-[280px]">
              <CardContent className="p-6 h-full flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-secondary rounded-lg"></div>
                  <div className="h-4 bg-secondary rounded w-3/4"></div>
                  <div className="h-4 bg-secondary rounded w-full"></div>
                  <div className="h-4 bg-secondary rounded w-5/6"></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredTemplates.length === 0 ? (
          <div className="col-span-full py-20 text-center border rounded-xl bg-card">
            <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-bold">No templates found</h3>
            <p className="text-muted-foreground mt-1">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          filteredTemplates.map((tpl) => (
            <Card 
              key={tpl.id} 
              onClick={() => { setCreationTemplateId(tpl.template_id || tpl.id); setIsCreateOpen(true); }}
              className="group cursor-pointer hover:border-primary transition-colors flex flex-col overflow-hidden"
            >
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                    <Globe className="h-6 w-6 text-primary" />
                  </div>
                  <Badge variant="secondary">
                    {tpl.kategori_website || tpl.category || "General"}
                  </Badge>
                </div>
                <CardTitle className="text-xl line-clamp-1">{tpl.name || tpl.nama_template}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                <div className="text-sm text-muted-foreground line-clamp-3 mb-6" dangerouslySetInnerHTML={{ __html: tpl.description || "" }} />
                <Button variant="ghost" className="w-full justify-between mt-auto group-hover:bg-primary group-hover:text-primary-foreground">
                  Use Template
                  <ArrowRight className="h-4 w-4" />
                </Button>
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
