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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
      
      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[60px]"></TableHead>
              <TableHead>Template Name</TableHead>
              <TableHead className="w-[150px]">Category</TableHead>
              <TableHead className="hidden md:table-cell">Description</TableHead>
              <TableHead className="text-right w-[140px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingTemplates ? (
              Array(4).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="w-10 h-10 bg-secondary animate-pulse rounded-md"></div></TableCell>
                  <TableCell><div className="h-4 w-32 bg-secondary animate-pulse rounded"></div></TableCell>
                  <TableCell><div className="h-4 w-20 bg-secondary animate-pulse rounded"></div></TableCell>
                  <TableCell className="hidden md:table-cell"><div className="h-4 w-48 bg-secondary animate-pulse rounded"></div></TableCell>
                  <TableCell className="text-right"><div className="h-8 w-24 bg-secondary animate-pulse rounded ml-auto"></div></TableCell>
                </TableRow>
              ))
            ) : filteredTemplates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-20 text-center text-muted-foreground">
                  <Globe className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium text-lg text-foreground">No templates found</p>
                  <p className="text-sm">Try adjusting your search or filter criteria</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredTemplates.map((tpl) => (
                <TableRow 
                  key={tpl.id}
                  className="group cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => { setCreationTemplateId(tpl.template_id || tpl.id); setIsCreateOpen(true); }}
                >
                  <TableCell>
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                      <Globe className="h-5 w-5 text-primary" />
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-base">
                    {tpl.name || tpl.nama_template}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {tpl.kategori_website || tpl.category || "General"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell max-w-[300px]">
                    <div className="text-sm text-muted-foreground truncate" dangerouslySetInnerHTML={{ __html: tpl.description || "" }} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="group-hover:bg-primary group-hover:text-primary-foreground">
                      Use Template
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
